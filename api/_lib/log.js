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
// The platform log is the audit trail for now; Vercel keeps it for a limited time on Hobby. A
// durable `admin_audit_log` table would be written from here, and only here.

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
    // `finish` fires once the response has been handed off — for every outcome, including the
    // 401/403 that verifyAdminToken sends itself. Test doubles may not be emitters.
    res?.on?.('finish', () => {
      console.log('[REQUEST]', JSON.stringify({
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
      }));
    });
    return handler(req, res);
  };
}
