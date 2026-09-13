// api/health.js
//
// Liveness and readiness probes, behind two paths served by ONE function.
//
// ============================================================================
// WHY ONE FUNCTION AND NOT TWO
// ============================================================================
// Vercel's Hobby plan caps this project at 12 serverless functions and we are at
// 10. Two probe endpoints would take the count to 12 — the cap exactly, leaving
// no room for the next real endpoint. `vercel.json` therefore rewrites
// /healthz and /ready onto this single handler and distinguishes them with a
// `probe` query parameter. The public contract is still two separate URLs.
//
// ============================================================================
// THE DISTINCTION THAT MATTERS
// ============================================================================
// liveness  (/healthz) — "is this process running?" No dependency checks, ever.
//                        It must not fail because Supabase is down, or a load
//                        balancer would recycle healthy instances during someone
//                        else's outage.
//
// readiness (/ready)   — "can this instance actually serve requests?" Checks
//                        configuration and reaches Supabase. Returns 503 when
//                        the answer is no, so the failure is machine-readable
//                        rather than a 200 with sad JSON inside it.
//
// Neither probe requires authentication — that is the point of a probe — so
// neither may disclose anything sensitive. Key *roles* are reported, key values
// and connection strings never are.

import {
  supabase,
  readKeyRole,
  describeConfigProblem,
  SUPABASE_SERVICE_KEY
} from './_lib/supabaseServer.js';
import { handlePreflightAndMethod } from './_lib/httpSecurity.js';

// A readiness probe that hangs is worse than one that fails: the caller waits
// out its own timeout and learns nothing. Supabase gets a hard ceiling.
const DEPENDENCY_TIMEOUT_MS = 3000;

/** Commit this build came from. Vercel injects it; empty in local dev. */
const REVISION = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local';

/**
 * Race a promise against a timeout.
 *
 * `Promise.race` alone leaves the loser running, which on a serverless runtime
 * can keep the invocation alive past the response. The timer is always cleared.
 */
async function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Can we reach Postgres and read a row?
 *
 * `system_settings` is deliberate: it is tiny, always populated, and readable
 * with either key role — so a failure here means the database is genuinely
 * unreachable rather than that permissions are misconfigured. Configuration
 * problems are reported separately by describeConfigProblem().
 */
async function checkDatabase() {
  const startedAt = Date.now();
  try {
    const { error } = await withTimeout(
      supabase.from('system_settings').select('setting_name').limit(1),
      DEPENDENCY_TIMEOUT_MS,
      'supabase'
    );
    if (error) return { ok: false, latency_ms: Date.now() - startedAt, error: error.message };
    return { ok: true, latency_ms: Date.now() - startedAt };
  } catch (err) {
    return { ok: false, latency_ms: Date.now() - startedAt, error: err.message };
  }
}

export default async function handler(req, res) {
  if (handlePreflightAndMethod(req, res, ['GET'])) return;

  // Probes are polled continuously; a cached answer is a useless answer.
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  const probe = req.query?.probe === 'ready' ? 'ready' : 'live';

  // ---- liveness ----------------------------------------------------------
  // Reached this line => the runtime booted and modules imported successfully.
  // That is the whole claim. Nothing else is checked on purpose.
  if (probe === 'live') {
    return res.status(200).json({
      status: 'ok',
      probe: 'live',
      revision: REVISION,
      uptime_s: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    });
  }

  // ---- readiness ---------------------------------------------------------
  // describeConfigProblem() returns { error, details } or null. Only `error` is
  // echoed: `details` spells out which environment variables to set and where,
  // which is guidance for an operator reading logs, not for anonymous callers.
  const configProblem = describeConfigProblem();
  const database = await checkDatabase();

  // An anon key in SUPABASE_SERVICE_KEY is the specific misconfiguration that
  // caused a five-month silent outage here: every write fails RLS while every
  // read still succeeds, so the app looks healthy from the outside. Readiness
  // reports the key's ROLE — never the key — so that state is observable.
  // `null` means an opaque sb_secret_/sb_publishable_ key whose role cannot be
  // read without calling Supabase.
  const keyRole = readKeyRole(SUPABASE_SERVICE_KEY);

  const ready = !configProblem && database.ok;

  return res.status(ready ? 200 : 503).json({
    status: ready ? 'ok' : 'unavailable',
    probe: 'ready',
    revision: REVISION,
    checks: {
      config: configProblem ? { ok: false, error: configProblem.error } : { ok: true },
      supabase: database,
      service_key_role: keyRole
    },
    timestamp: new Date().toISOString()
  });
}
