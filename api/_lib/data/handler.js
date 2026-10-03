// api/_lib/data/handler.js
//
// The read API's request pipeline, built from injected dependencies so it is tested end to end
// without Clerk, Supabase or Solis (api/data/[resource].js wires the real ones).
//
// Order matters and is deliberate:
//   1. CORS / method (GET only)          cheap, reveals nothing
//   2. authenticate + authorise (viewer)  BEFORE touching any data or even validating the resource
//   3. rate limit per user                after auth, so anonymous traffic cannot fill the table
//   4. resource lookup (allowlist)
//   5. validation + query (resources.js)
//   6. response, with no-store-style private caching
//
// Errors: HttpError → its status and message; anything else → a generic 500 (the detail is
// logged, never returned: error text from a database or upstream API is not for callers).

import { handlePreflightAndMethod } from '../httpSecurity.js';
import { localDateKey } from '../../../shared/domain/time.js';
import { HttpError } from './query.js';
import { resolveResource } from './resources.js';

const CACHE_SECONDS = 30;

export function createDataHandler({ verify, repo, live, limiter, ready = () => true, now = () => Date.now() }) {
  return async function handler(req, res) {
    if (handlePreflightAndMethod(req, res, ['GET'])) return;

    const user = await verify(req, res); // sends 401/403 itself
    if (!user) return;

    if (!ready(res)) return;

    const limit = limiter.check(user.id);
    res.setHeader('X-RateLimit-Remaining', String(limit.remaining));
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSec));
      return res.status(429).json({ error: 'Too many requests', code: 'rate_limited' });
    }

    try {
      const name = Array.isArray(req.query?.resource) ? req.query.resource[0] : req.query?.resource;
      const run = resolveResource(name);
      const result = await run(repo, req.query ?? {}, { todayKey: localDateKey(now()), live });

      // Private data: a shared cache (CDN) must never serve one user's response to another.
      res.setHeader('Cache-Control', `private, max-age=${CACHE_SECONDS}`);
      res.setHeader('Vary', 'Authorization');

      if (typeof result.csv === 'string') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        return res.status(200).send(result.csv);
      }
      return res.status(200).json(result.body);
    } catch (err) {
      if (err instanceof HttpError) {
        return res.status(err.status).json({ error: err.message, code: err.code });
      }
      console.error('data handler: unexpected error', err?.message);
      return res.status(500).json({ error: 'Internal error', code: 'internal' });
    }
  };
}
