// api/_lib/ops/watch.js — served at POST /api/ops/watch by api/ops/[action].js
//
// The watchdog (issue #241). Supabase pg_cron calls it every 15 minutes
// (scripts/sql/2026-11-24_observability_schedule.sql) with `Authorization: Bearer <OPS_WATCH_SECRET>`.
// GitHub's own scheduler is not used: here it runs the 5-minute job only a few times a day and the daily
// check hours late. Each check below raises or resolves ONE alert key through api/_lib/alerts.js, which
// deduplicates, so a long outage is one email on open and one on resolve.
//
//   data:live-stale    no live reading for LIVE_STALE_MINUTES (default 60) inside today's operating window
//   collector:failed   the newest run of any collector job failed (collector_runs)
//   api:5xx-rate       10 or more unexpected API 5xx in the past hour (request_log; 502/503 excluded)
//   error:<group>      an error group (browser or API) seen for the first time in the past hour; resolves
//                      itself, without an email, a day later
//
// What it cannot see is covered elsewhere: the site being down (UptimeRobot on /ready), and this
// watchdog itself not running (the daily Data Freshness Check fails when request_log has no successful
// `ops/watch` in 2 hours).
//
//   200  { checks: [...] }   every check ran; each says what it found and whether it emailed
//   401  missing or wrong secret
//   503  OPS_WATCH_SECRET is not set
//
// A check that throws (a table missing, the database down) is reported in the response as
// { key, action: 'error' } and the others still run.

import { createHash, timingSafeEqual } from 'node:crypto';
import { handlePreflightAndMethod } from '../httpSecurity.js';
import { supabase } from '../supabaseServer.js';
import { isUnexpectedStatus, withRequestLog } from '../log.js';
import { alertConfigFromEnv, createAlerter, mailerFromEnv, supabaseAlertStore } from '../alerts.js';
import { evaluateLiveFreshness } from '../../../shared/domain/freshness.js';
import { localDateKey, operatingWindow } from '../../../shared/domain/time.js';

export const API_5XX_THRESHOLD = 10;
const HOUR_MS = 3_600_000;

/** Constant-time comparison of the bearer token with the configured secret. */
export function isAuthorized(header, secret) {
  if (!secret || typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const a = createHash('sha256').update(header.slice(7)).digest();
  const b = createHash('sha256').update(secret).digest();
  return timingSafeEqual(a, b);
}

/** The queries the checks need, against the service-role client. Each throws a named error. */
export function supabaseWatchRepo(db) {
  const fail = (what, error) => { throw new Error(`${what}: ${error.message}`); };
  return {
    async latestLiveTimestamp() {
      const { data, error } = await db.from('inverter_data_live').select('data_timestamp').order('data_timestamp', { ascending: false }).limit(1);
      if (error) fail('inverter_data_live', error);
      return data?.[0]?.data_timestamp ?? null;
    },
    /** The newest run of each job seen in the past `days` days. */
    async latestRunPerJob(sinceIso) {
      const { data, error } = await db.from('collector_runs').select('job,status,started_at,error').gte('started_at', sinceIso).order('started_at', { ascending: false }).limit(200);
      if (error) fail('collector_runs', error);
      const latest = new Map();
      for (const r of data ?? []) if (!latest.has(r.job)) latest.set(r.job, r);
      return [...latest.values()];
    },
    async server5xxSince(sinceIso) {
      const { data, error } = await db.from('request_log').select('route,status').gte('at', sinceIso).gte('status', 500).limit(1000);
      if (error) fail('request_log', error);
      return (data ?? []).filter((r) => isUnexpectedStatus(r.status));
    },
    async errorGroupsFirstSeenSince(sinceIso) {
      const { data, error } = await db.from('error_events').select('fingerprint,source,message,route,release,occurrences,first_seen_at').gte('first_seen_at', sinceIso).order('first_seen_at', { ascending: true }).limit(20);
      if (error) fail('error_events', error);
      return data ?? [];
    }
  };
}

const short = (s, n) => (String(s ?? '').length > n ? `${String(s).slice(0, n - 1)}…` : String(s ?? ''));

/**
 * Run every check and act on it. Pure apart from `repo`, `alerter` and `store`, so it is tested with fakes.
 * @returns {Promise<Array<{ key: string, action: string, sent?: boolean, reason?: string, detail?: string }>>}
 */
export async function runChecks({ repo, alerter, store, nowMs, appUrl, liveStaleMinutes = 60 }) {
  const out = [];
  const admin = `${appUrl}/admin`;

  async function check(key, fn) {
    try {
      const r = await fn();
      out.push(...(Array.isArray(r) ? r : [{ key, ...r }]));
    } catch (err) {
      out.push({ key, action: 'error', detail: short(err?.message, 200) });
    }
  }

  const act = async (key, problem, alert, resolveOpts = {}) => {
    if (problem) {
      const r = await alerter.raise(key, alert);
      return { key, action: 'raise', sent: r.sent, reason: r.reason };
    }
    const r = await alerter.resolve(key, resolveOpts);
    return { key, action: r.phase === 'resolved' ? 'resolve' : 'ok', sent: r.sent };
  };

  await check('data:live-stale', async () => {
    const latestIso = await repo.latestLiveTimestamp();
    const verdict = evaluateLiveFreshness({ latestIso, nowMs, window: operatingWindow(localDateKey(nowMs)), maxAgeMinutes: liveStaleMinutes });
    if (verdict.state === 'night') return { action: 'skip', detail: verdict.reason };
    const r = await act('data:live-stale', verdict.state === 'stale', {
      title: 'Live inverter data has stopped',
      detail: verdict.reason,
      lines: [
        verdict.reason,
        `Newest reading: ${latestIso ?? 'none'}`,
        'Check the Fetch Live Inverter Data workflow runs, the SOLIS_* secrets and SolisCloud itself.'
      ],
      link: admin
    });
    return { ...r, detail: verdict.reason };
  });

  await check('collector:failed', async () => {
    const runs = await repo.latestRunPerJob(new Date(nowMs - 48 * HOUR_MS).toISOString());
    const failed = runs.filter((r) => r.status === 'failed');
    return act('collector:failed', failed.length > 0, {
      title: failed.length === 1 ? `Collector job "${failed[0]?.job}" failed` : `${failed.length} collector jobs failed`,
      lines: failed.map((r) => `${r.job} at ${r.started_at}: ${short(r.error || 'no error recorded', 160)}`),
      link: admin
    });
  });

  await check('api:5xx-rate', async () => {
    const rows = await repo.server5xxSince(new Date(nowMs - HOUR_MS).toISOString());
    const byRoute = {};
    for (const r of rows) byRoute[r.route] = (byRoute[r.route] ?? 0) + 1;
    return act('api:5xx-rate', rows.length >= API_5XX_THRESHOLD, {
      title: `${rows.length} API errors in the past hour`,
      lines: Object.entries(byRoute).sort((a, b) => b[1] - a[1]).map(([route, n]) => `${route}: ${n}`),
      link: admin
    });
  });

  await check('error:new', async () => {
    const groups = await repo.errorGroupsFirstSeenSince(new Date(nowMs - HOUR_MS).toISOString());
    const results = [];
    for (const g of groups) {
      const key = `error:${g.fingerprint}`;
      const r = await alerter.raise(key, {
        title: `New ${g.source} error: ${short(g.message, 80)}`,
        lines: [short(g.message, 300), `Where: ${g.route || 'unknown'}`, `Release: ${g.release || 'unknown'}`, `Seen ${g.occurrences} time(s) since ${g.first_seen_at}`],
        link: admin
      });
      results.push({ key, action: 'raise', sent: r.sent, reason: r.reason });
    }
    // Error alerts are "this appeared", not "this is ongoing": close them quietly after a day.
    const open = (await store.listOpen()).filter((a) => a.key.startsWith('error:') && Date.parse(a.opened_at) < nowMs - 24 * HOUR_MS);
    for (const a of open) {
      await alerter.resolve(a.key, { quiet: true });
      results.push({ key: a.key, action: 'resolve', sent: false });
    }
    return results.length ? results : [{ key: 'error:new', action: 'ok' }];
  });

  return out;
}

/** @param {{ env?: object, db?: object, mailer?: object, now?: () => number }} [overrides]  for tests */
export function createWatchHandler(overrides = {}) {
  return async function watch(req, res) {
    if (handlePreflightAndMethod(req, res, ['POST'])) return;
    res.setHeader('Cache-Control', 'no-store');
    const env = overrides.env ?? process.env;
    if (!env.OPS_WATCH_SECRET) return res.status(503).json({ error: 'The watchdog is not configured' });
    if (!isAuthorized(req.headers?.authorization, env.OPS_WATCH_SECRET)) return res.status(401).json({ error: 'Unauthorized' });

    const db = overrides.db ?? supabase;
    const store = supabaseAlertStore(db);
    const now = overrides.now ?? (() => Date.now());
    const alerter = createAlerter({ mailer: overrides.mailer ?? mailerFromEnv(env), store, now });
    const minutes = Number(env.LIVE_STALE_MINUTES);
    const checks = await runChecks({
      repo: supabaseWatchRepo(db),
      alerter,
      store,
      nowMs: now(),
      appUrl: alertConfigFromEnv(env).appUrl,
      liveStaleMinutes: Number.isFinite(minutes) && minutes > 0 ? minutes : 60
    });
    console.log('[WATCH]', JSON.stringify({ type: 'watch', at: new Date().toISOString(), checks }));
    return res.status(200).json({ checks });
  };
}

export default withRequestLog('ops/watch', createWatchHandler());
