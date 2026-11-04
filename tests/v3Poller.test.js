// tests/v3Poller.test.js
// When live figures re-read: on an interval while the tab is visible, never in the background, at once on return,
// and sooner after a failure. A wrong-looking live figure makes the whole page feel broken.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPoller, nextDelay, RETRY_MS, RETURN_MIN_MS } from '../src/v3/data/poller.js';

function setup({ pollMs = 60_000, results = [] } = {}) {
  let hidden = false;
  const reads = [];
  const run = vi.fn(async (force) => { reads.push(force); return results.length ? results.shift() : true; });
  const p = createPoller({ run, pollMs, now: () => Date.now(), isHidden: () => hidden });
  return { p, run, reads, hide: (v) => { hidden = v; } };
}

describe('live re-reads', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(Date.parse('2026-11-04T04:00:00Z')); });
  afterEach(() => vi.useRealTimers());

  it('reads at start (cache allowed), then every interval with a forced read', async () => {
    const { p, reads } = setup();
    p.start(); await vi.advanceTimersByTimeAsync(0);
    expect(reads).toEqual([false]);
    await vi.advanceTimersByTimeAsync(60_000);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(reads).toEqual([false, true, true]);
    p.stop();
  });

  it('does not read while the tab is hidden, and reads at once when it is back', async () => {
    const { p, reads, hide } = setup();
    p.start(); await vi.advanceTimersByTimeAsync(0);
    hide(true);
    await vi.advanceTimersByTimeAsync(10 * 60_000); // ten minutes in the background
    expect(reads).toHaveLength(1);
    hide(false);
    p.onReturn(); await vi.advanceTimersByTimeAsync(0);
    expect(reads).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(60_000); // and the interval carries on from there
    expect(reads).toHaveLength(3);
    p.stop();
  });

  it('a return reads at once unless a read just started (focus and visibilitychange fire together)', async () => {
    const { p, reads } = setup();
    p.start(); await vi.advanceTimersByTimeAsync(0);
    p.onReturn(); await vi.advanceTimersByTimeAsync(0);
    expect(reads).toHaveLength(1); // the start was a moment ago
    await vi.advanceTimersByTimeAsync(RETURN_MIN_MS);
    p.onReturn(); p.onReturn(); await vi.advanceTimersByTimeAsync(0);
    expect(reads).toHaveLength(2); // once, not twice
    p.stop();
  });

  it('retries a failed read sooner, backing off up to the interval; a success goes back to the interval', async () => {
    expect([0, 1, 2, 3, 4].map((f) => nextDelay(60_000, f))).toEqual([60_000, 15_000, 30_000, 60_000, 60_000]);
    const { p, reads } = setup({ results: [false, false, true] });
    p.start(); await vi.advanceTimersByTimeAsync(0); // fails
    await vi.advanceTimersByTimeAsync(RETRY_MS); // retry 1 (fails)
    expect(reads).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(2 * RETRY_MS); // retry 2 (succeeds)
    expect(reads).toHaveLength(3);
    expect(p.failures).toBe(0);
    await vi.advanceTimersByTimeAsync(59_000);
    expect(reads).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(reads).toHaveLength(4);
    p.stop();
  });

  it('a read that throws counts as a failure; stop ends everything; pollMs 0 reads once', async () => {
    const run = vi.fn(async () => { throw new Error('boom'); });
    const p = createPoller({ run, pollMs: 60_000 });
    p.start(); await vi.advanceTimersByTimeAsync(0);
    expect(p.failures).toBe(1);
    p.stop();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(run).toHaveBeenCalledTimes(1);

    const once = setup({ pollMs: 0 });
    once.p.start(); await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    once.p.onReturn(); await vi.advanceTimersByTimeAsync(0);
    expect(once.reads).toEqual([false]);
  });
});
