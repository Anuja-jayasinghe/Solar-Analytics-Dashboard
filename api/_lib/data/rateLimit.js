// api/_lib/data/rateLimit.js
//
// A small fixed-window rate limiter keyed by caller. HONEST LIMITS: on serverless the counters
// live in one instance's memory, so this bounds a runaway client or a tight loop, not a
// distributed attack. It is a seatbelt, not a firewall; real abuse protection is the platform's
// (Vercel firewall) and the fact that every request already needs a valid Clerk token.

export function createRateLimiter({ limit = 120, windowMs = 60_000, maxKeys = 2000, now = () => Date.now() } = {}) {
  const buckets = new Map();

  function prune(t) {
    if (buckets.size <= maxKeys) return;
    for (const [k, b] of buckets) if (t - b.start >= windowMs) buckets.delete(k);
    // Still too many live keys: drop the oldest rather than grow without bound.
    while (buckets.size > maxKeys) buckets.delete(buckets.keys().next().value);
  }

  return {
    /** @returns {{allowed:boolean, remaining:number, retryAfterSec:number}} */
    check(key) {
      const t = now();
      let b = buckets.get(key);
      if (!b || t - b.start >= windowMs) {
        b = { start: t, count: 0 };
        buckets.set(key, b);
        prune(t);
      }
      b.count++;
      const allowed = b.count <= limit;
      return {
        allowed,
        remaining: Math.max(0, limit - b.count),
        retryAfterSec: allowed ? 0 : Math.max(1, Math.ceil((b.start + windowMs - t) / 1000))
      };
    }
  };
}
