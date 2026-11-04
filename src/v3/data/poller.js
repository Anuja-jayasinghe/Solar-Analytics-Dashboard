// src/v3/data/poller.js
//
// When a live resource re-reads. A figure that looks wrong makes the whole page feel broken, so:
//   - every `pollMs` while the tab is visible; nothing while it is hidden (no one is looking, and it spends
//     SolisCloud calls), and a read that fell due while hidden happens the moment the tab is back
//   - on return (tab shown, window focused, network back) at once, unless a read started in the last few seconds
//   - after a failed read, sooner than the normal interval: 15 s, then 30 s, ... up to `pollMs`
// Pure scheduling: the reading itself, the clock, the timers and "is the tab hidden" are injected, so it is testable.

export const RETRY_MS = 15_000;
/** A return within this long of the last read does not read again (focus and visibilitychange often fire together). */
export const RETURN_MIN_MS = 5_000;

/** The wait before the next read: the interval, or a shorter, growing one after failures. */
export function nextDelay(pollMs, failures, retryMs = RETRY_MS) {
  if (failures <= 0) return pollMs;
  return Math.min(pollMs, retryMs * 2 ** (failures - 1));
}

/**
 * @param {object} a
 * @param {(force:boolean) => Promise<boolean>} a.run  one read; resolves true on success
 * @param {number} a.pollMs  0 = read once, never again
 */
export function createPoller({
  run, pollMs, retryMs = RETRY_MS, returnMinMs = RETURN_MIN_MS,
  now = () => Date.now(), isHidden = () => false, setTimer = setTimeout, clearTimer = clearTimeout
}) {
  let timer = null;
  let failures = 0;
  let lastStart = -Infinity;
  let inFlight = false;
  let dueWhileHidden = false;
  let stopped = false;

  function schedule() {
    if (!pollMs || stopped) return;
    timer = setTimer(() => {
      timer = null;
      if (isHidden()) { dueWhileHidden = true; return; } // read when the tab is back, not in the background
      read(true);
    }, nextDelay(pollMs, failures, retryMs));
  }

  async function read(force) {
    if (stopped) return;
    if (timer) { clearTimer(timer); timer = null; }
    inFlight = true;
    lastStart = now();
    let ok = false;
    try { ok = await run(force); } catch { ok = false; }
    inFlight = false;
    if (stopped) return;
    failures = ok ? 0 : failures + 1;
    schedule();
  }

  return {
    /** The first read may come from the cache (a remounted view paints at once); later ones never do. */
    start() { read(false); },
    /** The tab is visible again, the window has focus, or the network is back. */
    onReturn() {
      if (stopped || !pollMs || isHidden() || inFlight) return;
      if (dueWhileHidden || now() - lastStart >= returnMinMs) { dueWhileHidden = false; read(true); }
    },
    stop() { stopped = true; if (timer) clearTimer(timer); timer = null; },
    get failures() { return failures; }
  };
}
