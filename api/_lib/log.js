// api/_lib/log.js
//
// Structured log lines for the serverless API. One JSON object per line, so the platform log
// can be filtered and parsed instead of grepped.
//
// Lives under `_lib/` so Vercel does not count it against the 12-function limit on Hobby.
//
// AUDIT LINES
// Privileged changes — role grants, user deletions, bill approvals and deletes, settings edits —
// each emit one `[AUDIT]` line naming who did what to what. Until 2026-10-29 the user-management
// endpoint logged nothing at all, so a role change or an account deletion left no trace.
//
// What a line may carry (docs/WORKING_RULES.md §3, "no secrets, tokens or user metadata in logs"):
// Clerk user ids, row ids, setting names, the NAMES of changed fields, and role/access levels.
// Never e-mail addresses, account numbers, meter readings or other bill contents — for record
// writes, log which fields changed, not their values.
//
// DURABLE COPIES (issue #241)
// Vercel's Hobby plan keeps the platform log only briefly. Every line is therefore also written to
// Supabase, from here and only here: `[REQUEST]` → `request_log` (kept 30 days), `[AUDIT]` →
// `admin_audit_log` (kept 2 years). The write happens AFTER the response, through Vercel's
// `waitUntil`, so it adds no latency, and it can never fail a request: an error is one console
// warning, and a missing table (migration not applied yet) is reported once and then skipped.
// Only deployed functions write (VERCEL=1); local dev and tests do not.

// Unexpected API 5xx (and anything a handler throws) also become an error group in `error_events`
// (api/_lib/errorEvents.js), the same table the browser reports go to.

import { supabase } from './supabaseServer.js';
import { apiErrorEvent, recordErrorEvent } from './errorEvents.js';

/** Vercel's request id, for correlating a log line with the platform's request log. */
export function requestIdOf(req) {
  return req?.headers?.['x-vercel-id'] || null;
}

/** Who made the request: a verified Clerk user from verifyAdminToken. Id only — no e-mail. */
export function actorOf(adminUser) {
  return { id: adminUser?.id || null };
}

/**
 * Emit one audit line.
 *
 * @param {import('http').IncomingMessage} req
 * @param {{ action: string, actor: object, target?: object, changes?: object }} entry
 * @returns {object} the entry as logged (for tests)
 */
export function audit(req, { action, actor, target = null, changes = null }) {
  const entry = {
    type: 'audit',
    at: new Date().toISOString(),
    requestId: requestIdOf(req),
    action,
    actor,
    target,
    changes
  };
  console.log('[AUDIT]', JSON.stringify(entry));
  persist('admin_audit_log', {
    at: entry.at,
    request_id: entry.requestId,
    action: String(action).slice(0, 80),
    actor_id: actor?.id ?? null,
    target,
    changes
  }, waitUntilOf());
  return entry;
}

// REQUEST LINES
// One `[REQUEST]` line per API request, written when the response finishes: route, method,
// status, latency, the signed-in user and access level (once verifyAccess has run) and the
// request id. Before this, each handler logged — or did not log — in its own format, and
// nothing recorded how long a request took or which status it ended with.

/**
 * Wrap a handler so its request is logged once, on completion.
 *
 * @param {string | ((req) => string)} route  stable name, e.g. 'ceb-bills/records' — not the URL,
 *        which carries ids. A function derives it from the request (e.g. the data resource).
 * @param {(req, res) => unknown} handler
 */
export function withRequestLog(route, handler) {
  return async function loggedHandler(req, res) {
    const startedAt = Date.now();
    // Captured now, inside the request: Vercel's request context is what keeps the function alive
    // for the write after the response.
    const waitUntil = waitUntilOf();
    let thrown = null;
    // `finish` fires once the response has been handed off — for every outcome, including the
    // 401/403 that verifyAdminToken sends itself. Test doubles may not be emitters.
    res?.on?.('finish', () => {
      const line = {
        type: 'request',
        at: new Date().toISOString(),
        requestId: requestIdOf(req),
        // A derived name comes from the URL: bound its length so a hostile path cannot bloat the log.
        route: typeof route === 'function' ? String(route(req)).slice(0, 60) : route,
        method: req?.method || null,
        status: res.statusCode ?? null,
        latencyMs: Date.now() - startedAt,
        // verifyAccess sets authUser (viewer or admin); verifyAdminToken also sets adminUser.
        actor: req?.authUser?.id || req?.adminUser?.id || null,
        accessLevel: req?.accessLevel || null
      };
      console.log('[REQUEST]', JSON.stringify(line));
      if (isUnexpectedStatus(line.status) || thrown) {
        persist('error_events', apiErrorEvent({
          route: line.route,
          method: line.method,
          status: line.status,
          error: thrown,
          actor: line.actor,
          release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null
        }), waitUntil);
      }
      persist('request_log', {
        at: line.at,
        request_id: line.requestId,
        route: line.route,
        method: line.method,
        status: line.status,
        latency_ms: line.latencyMs,
        actor: line.actor,
        access_level: line.accessLevel
      }, waitUntil);
    });
    try {
      return await handler(req, res);
    } catch (err) {
      thrown = err; // the platform answers 500; `finish` then records it with this message
      throw err;
    }
  };
}

// ---------------------------------------------------------------------------------------------
// Durable copies
// ---------------------------------------------------------------------------------------------

/**
 * A 5xx that means OUR code failed. 502 (SolisCloud failed upstream) and 503 (/ready: not ready) are
 * deliberate answers about someone else's outage; they stay in request_log and the uptime monitor
 * covers them.
 */
export const isUnexpectedStatus = (status) => Number.isInteger(status) && status >= 500 && status !== 502 && status !== 503;

const SYMBOL_FOR_REQ_CONTEXT = Symbol.for('@vercel/request-context');

/**
 * Vercel's `waitUntil` for the current request, or null outside Vercel. This is what
 * `@vercel/functions` does internally; reading it directly saves a dependency with 15 transitive
 * packages for one function.
 */
export function waitUntilOf() {
  const fn = globalThis[SYMBOL_FOR_REQ_CONTEXT]?.get?.()?.waitUntil;
  return typeof fn === 'function' ? fn : null;
}

// A missing table is skipped for a while, then tried again: a warm instance that saw "missing" before the
// migration was applied must not keep skipping until Vercel happens to recycle it.
export const MISSING_RETRY_MS = 10 * 60 * 1000;
const missingTables = new Map(); // table -> when it was found missing

/** Is this error "the table does not exist" (migration not applied yet)? */
export function isMissingTable(error) {
  const code = error?.code;
  return code === '42P01' || code === 'PGRST205' || /does not exist|could not find the table/i.test(error?.message || '');
}

async function insertRow(table, row) {
  const missingSince = missingTables.get(table);
  if (missingSince !== undefined && Date.now() - missingSince < MISSING_RETRY_MS) return;
  missingTables.delete(table);
  try {
    const { error } = await supabase.from(table).insert(row);
    if (!error) return;
    if (isMissingTable(error)) {
      if (missingSince === undefined) console.warn(`[LOG] ${table} does not exist yet (migration 2026-11-24_observability_tables.sql): not persisting`);
      missingTables.set(table, Date.now());
      return;
    }
    console.warn(`[LOG] could not persist to ${table}:`, error.message);
  } catch (err) {
    console.warn(`[LOG] could not persist to ${table}:`, err?.message);
  }
}

const defaultSink = (table, row) => {
  if (process.env.VERCEL !== '1') return null;
  return table === 'error_events' ? recordErrorEvent(supabase, row) : insertRow(table, row);
};
let sink = defaultSink;

/** Tests replace where durable copies go; `null` restores the default. */
export function setLogSink(fn) {
  sink = typeof fn === 'function' ? fn : defaultSink;
  missingTables.clear();
}

/** Write one durable row without delaying or failing anything. */
function persist(table, row, waitUntil) {
  let pending;
  try {
    pending = sink(table, row);
  } catch (err) {
    console.warn(`[LOG] could not persist to ${table}:`, err?.message);
    return;
  }
  if (pending && typeof pending.then === 'function') {
    const safe = Promise.resolve(pending).catch(() => {});
    if (waitUntil) {
      try { waitUntil(safe); } catch { /* not in a request context */ }
    }
  }
}

export const __test = { insertRow, missingTables };
