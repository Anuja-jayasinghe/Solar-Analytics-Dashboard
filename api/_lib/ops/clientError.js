// api/_lib/ops/clientError.js — served at POST /api/ops/error by api/ops/[action].js
//
// Browser error reports (issue #241). The one write the browser may make without signing in, because
// errors happen to signed-out visitors too. What keeps that safe:
//   - same origin only: the request must come from this site (Origin, or Sec-Fetch-Site: same-origin);
//   - small: 8 KB at most, and every field is cut to length and redacted (api/_lib/errorEvents.js);
//   - rate-limited: 10 reports a minute per address in this instance, and the database refuses a NEW
//     error group once 50 appeared in the past hour, so made-up errors cannot fill the table;
//   - write-only and blind: the answer is 204 whatever happened, and nothing can be read back.
//
//   204  received (stored, counted, or dropped by a limit; the browser does not need to know)
//   400  not JSON, or no message
//   403  not from this site
//   413  too large
//   429  too many reports from this address

import { handlePreflightAndMethod, isOriginAllowed } from '../httpSecurity.js';
import { supabase } from '../supabaseServer.js';
import { withRequestLog } from '../log.js';
import { createRateLimiter } from '../data/rateLimit.js';
import { LIMITS, parseClientError, recordErrorEvent } from '../errorEvents.js';

const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

/** The caller's address, for rate limiting only; never stored. */
export const clientKey = (req) => String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';

export function isSameSite(req) {
  if (isOriginAllowed(req.headers?.origin)) return true;
  return !req.headers?.origin && req.headers?.['sec-fetch-site'] === 'same-origin';
}

function bodyOf(req) {
  let b;
  try {
    b = req.body; // Vercel parses lazily and throws on malformed JSON
  } catch {
    return { ok: false, size: 0 };
  }
  if (b && typeof b === 'object' && !Buffer.isBuffer(b)) return { ok: true, value: b, size: JSON.stringify(b).length };
  const text = Buffer.isBuffer(b) ? b.toString('utf8') : typeof b === 'string' ? b : '';
  try {
    return { ok: true, value: JSON.parse(text), size: text.length };
  } catch {
    return { ok: false, size: text.length };
  }
}

/** @param {{ db?: object, limiter?: object, record?: Function }} [overrides]  for tests */
export function createClientErrorHandler(overrides = {}) {
  const rate = overrides.limiter ?? limiter;
  const record = overrides.record ?? ((event) => recordErrorEvent(overrides.db ?? supabase, event));

  return async function clientError(req, res) {
    if (handlePreflightAndMethod(req, res, ['POST'])) return;
    res.setHeader('Cache-Control', 'no-store');
    if (!isSameSite(req)) return res.status(403).json({ error: 'Reports are accepted from this site only' });
    if (Number(req.headers?.['content-length']) > LIMITS.body) return res.status(413).json({ error: 'Report too large' });

    const { allowed, retryAfterSec } = rate.check(clientKey(req));
    if (!allowed) {
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({ error: 'Too many reports' });
    }

    const body = bodyOf(req);
    if (body.size > LIMITS.body) return res.status(413).json({ error: 'Report too large' });
    if (!body.ok) return res.status(400).json({ error: 'Report is not JSON' });
    const parsed = parseClientError(body.value);
    if (!parsed.ok) return res.status(400).json({ error: `Invalid report: ${parsed.reason}` });

    await record(parsed.event);
    return res.status(204).end();
  };
}

export default withRequestLog('ops/error', createClientErrorHandler());
