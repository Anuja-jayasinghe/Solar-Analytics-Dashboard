// api/_lib/alerts.js
//
// The one alert path (issue #241). Every email the app sends to its owner goes through createMailer():
// the bill intake's "needs you" emails (LR-005, api/_lib/notify.js) and the operational alerts below
// (site, data freshness, errors, collectors). Tests: tests/alerts.test.js
//
// DEDUPLICATION
// An operational alert is a KEY that is either open or resolved, kept in the `alert_state` table:
//   raise(key)    first time, or after it was resolved: opens it and sends ONE email.
//                 While it stays open: counts the occurrence, and sends a reminder at most once a day.
//   resolve(key)  if open: marks it resolved and sends one "resolved" email (unless the alert said not to).
// So an outage checked every 15 minutes for six hours sends two emails (open, resolved), not 24.
// On top of that, at most DAILY_CAP alerts are emailed per 24 hours, whatever happens, so a bug cannot burn
// the Resend free quota (100 a day, shared with the bill intake).
//
// Two checks running at once may both see a key as new. The Resend Idempotency-Key is derived from the key
// and the time the alert opened, rounded to the check interval, so the second send is a no-op.
//
// FAILURE IS QUIET, NEVER SILENT
// Alerting must never become the next outage: nothing here throws. Every decision is logged as one
// `[ALERT]` line, so an alert that could not be emailed (no API key, Resend down, table missing) is still in
// the platform log.
//
// PRIVACY (WORKING_RULES §3): alert text names routes, tables, counts and times. Never an e-mail address, a
// name, an account number or bill contents. The recipient comes only from the environment.

import { createResendApi } from './resendApi.js';

export const DEFAULT_ALERT_FROM = 'Solar Analytics <alerts@mail.solaredge.anujajay.com>';
export const DEFAULT_APP_URL = 'https://solaredge.anujajay.com';
export const DAILY_CAP = 20;
export const REMIND_AFTER_MS = 24 * 60 * 60 * 1000;
const IDEMPOTENCY_BUCKET_MS = 15 * 60 * 1000;

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Where alerts go. ALERT_TO falls back to the bill intake's BILL_ALERT_TO, so one address serves both. */
export function alertConfigFromEnv(env = process.env) {
  return {
    resendApiKey: env.RESEND_API_KEY || null,
    to: (env.ALERT_TO || env.BILL_ALERT_TO || '').trim() || null,
    from: (env.ALERT_FROM || '').trim() || DEFAULT_ALERT_FROM,
    appUrl: (env.APP_URL || '').trim().replace(/\/+$/, '') || DEFAULT_APP_URL
  };
}

const logAlert = (entry) => console.log('[ALERT]', JSON.stringify({ type: 'alert', at: new Date().toISOString(), ...entry }));

/**
 * The single sending function. A message is { subject, text, html }; it always goes to the one configured
 * address. Returns { id } from Resend. Throws only for the caller that wants to know (the bill intake records
 * a failed send); createAlerter() catches.
 *
 * @param {{ resend: { sendEmail: Function }, from: string, to: string }} deps
 */
export function createMailer({ resend, from, to }) {
  return {
    configured: Boolean(resend && from && to),
    async send({ subject, text, html }, idempotencyKey) {
      if (!resend || !to) throw new Error('Alert email is not configured (RESEND_API_KEY and ALERT_TO or BILL_ALERT_TO)');
      return resend.sendEmail({ from, to: [to], subject, text, html }, idempotencyKey);
    }
  };
}

/** A mailer from the environment, or one that reports "not configured" without throwing at build time. */
export function mailerFromEnv(env = process.env, { fetchImpl } = {}) {
  const c = alertConfigFromEnv(env);
  const resend = c.resendApiKey ? createResendApi({ apiKey: c.resendApiKey, fetchImpl }) : null;
  return createMailer({ resend, from: c.from, to: c.to });
}

/**
 * One alert email.
 * @param {{ phase: 'open'|'reminder'|'resolved', title: string, lines?: string[], link?: string|null,
 *           openedAt?: string|null, occurrences?: number }} a
 */
export function composeAlertEmail({ phase, title, lines = [], link = null, openedAt = null, occurrences = 1 }) {
  const prefix = phase === 'resolved' ? 'Resolved' : phase === 'reminder' ? 'Still failing' : 'Alert';
  const subject = `[Solar ${prefix}] ${title}`;
  const paragraphs = [];
  if (phase === 'reminder') paragraphs.push(`This alert has been open since ${openedAt} (${occurrences} checks so far). You get at most one reminder a day.`);
  if (phase === 'resolved') paragraphs.push(`This is back to normal${openedAt ? ` (it opened at ${openedAt})` : ''}.`);
  const textParts = [...paragraphs];
  if (lines.length) textParts.push(lines.map((l) => `- ${l}`).join('\n'));
  if (link) textParts.push(`More: ${link}`);
  textParts.push('Runbook: docs/RUNBOOK.md, "Signals and alerts".');
  const html = [
    ...paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`),
    lines.length ? `<ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>` : '',
    link ? `<p><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>` : '',
    '<p>Runbook: docs/RUNBOOK.md, "Signals and alerts".</p>'
  ].join('');
  return { subject, text: textParts.join('\n\n'), html };
}

/**
 * Alert state in Supabase (`alert_state`). A missing table is reported once as "not set up" by the caller.
 * @param {object} db  a supabase-js client with the service role
 */
export function supabaseAlertStore(db) {
  return {
    async get(key) {
      const { data, error } = await db.from('alert_state').select('*').eq('key', key).maybeSingle();
      if (error) throw new Error(`alert_state read failed: ${error.message}`);
      return data ?? null;
    },
    async save(row) {
      const { error } = await db.from('alert_state').upsert(row, { onConflict: 'key' });
      if (error) throw new Error(`alert_state write failed: ${error.message}`);
    },
    async countSentSince(sinceIso) {
      const { count, error } = await db.from('alert_state').select('key', { count: 'exact', head: true }).gte('last_sent_at', sinceIso);
      if (error) throw new Error(`alert_state count failed: ${error.message}`);
      return count ?? 0;
    },
    async listOpen() {
      const { data, error } = await db.from('alert_state').select('*').eq('status', 'open').order('opened_at', { ascending: false });
      if (error) throw new Error(`alert_state read failed: ${error.message}`);
      return data ?? [];
    }
  };
}

/**
 * @param {{ mailer: ReturnType<typeof createMailer>, store: ReturnType<typeof supabaseAlertStore>,
 *           now?: () => number, dailyCap?: number, remindAfterMs?: number }} deps
 */
export function createAlerter({ mailer, store, now = () => Date.now(), dailyCap = DAILY_CAP, remindAfterMs = REMIND_AFTER_MS }) {
  async function underCap(t) {
    const sent = await store.countSentSince(new Date(t - 24 * 60 * 60 * 1000).toISOString());
    return sent < dailyCap;
  }

  async function deliver(phase, row, { lines, link }, t) {
    if (!(await underCap(t))) return { sent: false, reason: 'daily_cap' };
    const bucket = Math.floor(Date.parse(row.opened_at) / IDEMPOTENCY_BUCKET_MS);
    const day = Math.floor(t / remindAfterMs);
    const idem = `alert:${row.key}:${bucket}:${phase}${phase === 'reminder' ? `:${day}` : ''}`.slice(0, 256);
    try {
      await mailer.send(composeAlertEmail({ phase, title: row.title, lines, link, openedAt: row.opened_at, occurrences: row.occurrences }), idem);
      return { sent: true };
    } catch (err) {
      return { sent: false, reason: 'send_failed', error: String(err?.message || err).slice(0, 200) };
    }
  }

  return {
    /**
     * Something is wrong. Safe to call on every check.
     * @param {string} key  stable, e.g. 'site:ready', 'data:live-stale', 'error:<fingerprint>'
     * @param {{ title: string, lines?: string[], link?: string, detail?: string }} alert
     * @returns {Promise<{ key: string, phase: string|null, sent: boolean, reason?: string }>}
     */
    async raise(key, alert) {
      const t = now();
      const at = new Date(t).toISOString();
      try {
        const prev = await store.get(key);
        let row;
        let phase = null;
        if (!prev || prev.status !== 'open') {
          row = { key, status: 'open', title: alert.title, detail: alert.detail ?? null, opened_at: at, last_seen_at: at, last_sent_at: null, resolved_at: null, occurrences: 1 };
          phase = 'open';
        } else {
          row = { ...prev, title: alert.title, detail: alert.detail ?? prev.detail ?? null, last_seen_at: at, occurrences: (prev.occurrences ?? 1) + 1 };
          const lastSent = prev.last_sent_at ? Date.parse(prev.last_sent_at) : 0;
          if (t - lastSent >= remindAfterMs) phase = 'reminder';
        }
        let result = { sent: false, reason: 'deduplicated' };
        if (phase) {
          result = await deliver(phase, row, alert, t);
          if (result.sent) row.last_sent_at = at;
        }
        await store.save(row);
        logAlert({ key, action: 'raise', phase, ...result });
        return { key, phase, ...result };
      } catch (err) {
        const out = { key, phase: null, sent: false, reason: 'state_failed', error: String(err?.message || err).slice(0, 200) };
        logAlert({ action: 'raise', ...out });
        return out;
      }
    },

    /**
     * Back to normal. A no-op unless the key is open.
     * @param {string} key
     * @param {{ lines?: string[], link?: string, quiet?: boolean }} [opts]  quiet: resolve without an email
     */
    async resolve(key, opts = {}) {
      const t = now();
      const at = new Date(t).toISOString();
      try {
        const prev = await store.get(key);
        if (!prev || prev.status !== 'open') return { key, phase: null, sent: false, reason: 'not_open' };
        const row = { ...prev, status: 'resolved', resolved_at: at, last_seen_at: at };
        let result = { sent: false, reason: 'quiet' };
        if (!opts.quiet) {
          result = await deliver('resolved', row, opts, t);
          if (result.sent) row.last_sent_at = at;
        }
        await store.save(row);
        logAlert({ key, action: 'resolve', phase: 'resolved', ...result });
        return { key, phase: 'resolved', ...result };
      } catch (err) {
        const out = { key, phase: null, sent: false, reason: 'state_failed', error: String(err?.message || err).slice(0, 200) };
        logAlert({ action: 'resolve', ...out });
        return out;
      }
    }
  };
}
