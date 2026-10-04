// src/v3/data/cache.js
//
// A tiny request cache: de-duplicates in-flight calls and reuses a result for `ttlMs`. Entries
// are scoped by an `epoch` (the data mode and user), so signing in or out never serves the other
// mode's data. Pure and clock-injectable so it is testable without timers.

export function createResourceCache({ ttlMs = 30_000, now = () => Date.now() } = {}) {
  const entries = new Map(); // key -> { promise, at, settled, value, error }
  let epoch = '';

  function setEpoch(next) {
    if (next !== epoch) {
      epoch = next;
      entries.clear();
    }
  }

  /** @returns {{promise:Promise<any>, cached:boolean}} */
  function get(key, load, { force = false } = {}) {
    const hit = entries.get(key);
    if (hit && !force) {
      const fresh = !hit.settled || now() - hit.at < ttlMs;
      if (fresh && !hit.error) return { promise: hit.promise, cached: true };
    }
    const entry = { at: now(), settled: false, value: undefined, error: undefined, promise: null };
    entry.promise = Promise.resolve()
      .then(load)
      .then(
        (value) => {
          entry.settled = true;
          entry.value = value;
          entry.at = now();
          return value;
        },
        (error) => {
          entry.settled = true;
          entry.error = error;
          // A failure is never cached: the next caller retries.
          if (entries.get(key) === entry) entries.delete(key);
          throw error;
        }
      );
    entries.set(key, entry);
    return { promise: entry.promise, cached: false };
  }

  /** Synchronous read of an already-loaded value, or undefined. Lets a remounted view paint instantly. */
  function peek(key) {
    const e = entries.get(key);
    return e && e.settled && !e.error ? e.value : undefined;
  }

  function clear() {
    entries.clear();
  }

  return { get, peek, clear, setEpoch, get size() { return entries.size; } };
}
