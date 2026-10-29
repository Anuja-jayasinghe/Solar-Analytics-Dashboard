// tests/v3Today.test.js — which day a page uses, when SolisCloud is slow or down.

import { describe, it, expect } from 'vitest';
import { pageTodayKey } from '../src/v3/data/today.js';
import { demoRequest } from '../shared/demo/demoApi.js';
import { DEMO } from '../shared/demo/demoData.js';

describe('pageTodayKey()', () => {
  it('prefers the live reading\'s server date', () => {
    expect(pageTodayKey({ data: { todayKey: '2026-10-29' } }, { data: { todayKey: '2026-10-28' } })).toBe('2026-10-29');
  });

  it('falls back to totals when live failed or has not answered — the Pro page used to stay empty', () => {
    expect(pageTodayKey({ error: { code: 'upstream_unavailable' } }, { data: { todayKey: '2026-10-29' } })).toBe('2026-10-29');
    expect(pageTodayKey({ loading: true }, { data: { todayKey: '2026-10-29' } })).toBe('2026-10-29');
  });

  it('is null until either answers (never the browser\'s own clock)', () => {
    expect(pageTodayKey({}, {})).toBeNull();
    expect(pageTodayKey(undefined, undefined)).toBeNull();
  });

  it('on the demo source, totals carries the demo\'s fixed date, not today\'s', async () => {
    const res = await demoRequest('totals', {});
    const body = res?.body ?? res;
    expect(body.todayKey).toBe(DEMO.today);
  });
});
