// api/_lib/errorEvents.js
//
// Self-hosted error tracking (issue #241; replaces decision D4, Rollbar). Browser errors arrive at
// POST /api/ops/error (api/_lib/ops/clientError.js); unexpected API 5xx come from withRequestLog in
// api/_lib/log.js. Both end in the private `error_events` table, ONE ROW PER DISTINCT ERROR with a
// count, through record_error_event() (scripts/sql/2026-11-24_observability_tables.sql), which also
// refuses a new group once 50 appeared in the past hour. Tests: tests/errorEvents.test.js
//
// PRIVACY (WORKING_RULES §3): nothing here identifies a person. Browser reports carry no user id at all
// (sendBeacon cannot send the Clerk token, and an error does not need one); API errors carry the Clerk
// user id the request log already has. Text is redacted before it is stored: e-mail addresses, bearer
// tokens and JWTs, and long digit runs (account numbers) are replaced. URLs are stored as paths only.

import { createHash } from 'node:crypto';

export const LIMITS = Object.freeze({ message: 500, stack: 4000, route: 200, release: 40, source: 40, body: 8 * 1024 });

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JWT = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]+/g;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const SECRET_PARAM = /([?&](?:token|key|code|secret|signature|__clerk_[a-z_]*)=)[^&\s#]+/gi;
const LONG_DIGITS = /\d{9,}/g;

/** Replace anything that could identify a person or unlock something. */
export function redact(text) {
  return String(text ?? '')
    .replace(EMAIL, '[email]')
    .replace(JWT, '[token]')
    .replace(BEARER, 'Bearer [token]')
    .replace(SECRET_PARAM, '$1[redacted]')
    .replace(LONG_DIGITS, '[number]');
}

/** A URL or path reduced to its path: no origin, query string or fragment. */
export function pathOnly(value) {
  if (typeof value !== 'string' || !value) return null;
  let path = value;
  try {
    path = new URL(value, 'https://x.invalid').pathname;
  } catch {
    path = value.split(/[?#]/)[0];
  }
  return path.slice(0, LIMITS.route) || null;
}

/**
 * Group by what the error IS, not where or when: the message with numbers and quoted values blanked,
 * plus the first stack frame's function name. Bundle hashes, line and column numbers change with every
 * release and are left out, so one bug stays one group across deploys.
 */
export function fingerprintOf({ source, message, stack }) {
  const msg = String(message ?? '').replace(/(["'`]).*?\1/g, '"…"').replace(/\d+/g, '#').trim().slice(0, 200);
  const frame = String(stack ?? '').split('\n').map((l) => l.trim()).find((l) => /^at\s|@/.test(l)) || '';
  const fn = (frame.match(/^at\s+([^\s(]+)\s*\(/) || frame.match(/^([^@\s]+)@/) || [])[1] || '';
  return createHash('sha256').update(`${source}|${msg}|${fn}`).digest('hex').slice(0, 32);
}

const str = (v, max) => (typeof v === 'string' && v.trim() ? redact(v).slice(0, max) : null);

/**
 * Validate a browser report. Unknown fields are dropped; nothing is trusted to be short or clean.
 * @returns {{ ok: true, event: object } | { ok: false, reason: string }}
 */
export function parseClientError(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, reason: 'not an object' };
  const message = str(body.message, LIMITS.message);
  if (!message) return { ok: false, reason: 'message is required' };
  const stack = str(body.stack, LIMITS.stack);
  const where = typeof body.source === 'string' ? body.source.replace(/[^\w.:-]/g, '').slice(0, LIMITS.source) : 'unknown';
  const event = {
    source: 'browser',
    message,
    stack,
    route: pathOnly(body.route),
    release: typeof body.release === 'string' ? body.release.replace(/[^\w.+-]/g, '').slice(0, LIMITS.release) || null : null,
    context: { where: where || 'unknown', ...(typeof body.file === 'string' ? { file: pathOnly(body.file) } : {}), ...(Number.isInteger(body.line) ? { line: body.line } : {}) },
    actor: null
  };
  event.fingerprint = fingerprintOf({ source: `browser:${event.context.where}`, message, stack });
  return { ok: true, event };
}

/** An API response that ended in 5xx. Grouped by route, method and status. */
export function apiErrorEvent({ route, method, status, error, actor, release }) {
  const name = error?.name && error.name !== 'Error' ? `${error.name}: ` : '';
  const message = redact(`${status} on ${method || '?'} ${route}${error?.message ? `: ${name}${error.message}` : ''}`).slice(0, LIMITS.message);
  return {
    fingerprint: createHash('sha256').update(`api|${route}|${method}|${status}`).digest('hex').slice(0, 32),
    source: 'api',
    message,
    stack: error?.stack ? redact(error.stack).slice(0, LIMITS.stack) : null,
    route: String(route).slice(0, LIMITS.route),
    release: release ? String(release).slice(0, LIMITS.release) : null,
    context: { status, method: method || null },
    actor: actor || null
  };
}

// Skipped for 10 minutes after it was found missing, then tried again (see MISSING_RETRY_MS in log.js).
const MISSING_RETRY_MS = 10 * 60 * 1000;
let functionMissing = null; // when it was found missing

const isMissingFunction = (error) => error?.code === 'PGRST202' || error?.code === '42883' || error?.code === '42P01' || /could not find the function|does not exist/i.test(error?.message || '');

/**
 * Store one error. Never throws. Returns the group's count after this one, 0 when a new group was
 * refused (50 new groups in the past hour), or null when it could not be stored.
 */
export async function recordErrorEvent(db, e) {
  if (functionMissing !== null && Date.now() - functionMissing < MISSING_RETRY_MS) return null;
  try {
    const { data, error } = await db.rpc('record_error_event', {
      p_fingerprint: e.fingerprint,
      p_source: e.source,
      p_message: e.message,
      p_stack: e.stack,
      p_route: e.route,
      p_release: e.release,
      p_context: e.context ?? null,
      p_actor: e.actor ?? null
    });
    if (!error) return typeof data === 'number' ? data : null;
    if (isMissingFunction(error)) {
      const first = functionMissing === null;
      functionMissing = Date.now();
      if (first) console.warn('[ERRORS] record_error_event() does not exist yet (migration 2026-11-24_observability_tables.sql): not storing errors');
      return null;
    }
    console.warn('[ERRORS] could not store an error event:', error.message);
    return null;
  } catch (err) {
    console.warn('[ERRORS] could not store an error event:', err?.message);
    return null;
  }
}

export const __test = { reset: () => { functionMissing = null; } };
