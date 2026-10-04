// tests/v3OverviewLive.test.js
//
// Overview live row + headline tiles: the pure helpers and the rendered tiles (server render).
// The rule under test throughout: unknown is shown as an em dash, never as 0.

import { describe, it, expect } from 'vitest';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import {
  DASH, fmtNum, shortDate, longDate, monthsBetween, lkrCompact, energyCompact, targetProgress, gaugeFraction,
  liveState, freshness, openBillPeriod, FRESH_WINDOW_MIN
} from '../src/v3/overview/format.js';
import { TotalsRow } from '../src/v3/overview/TotalsRow.jsx';
import { TodayTile } from '../src/v3/overview/TodayTile.jsx';
import { LiveGauge } from '../src/v3/overview/LiveGauge.jsx';

describe('number and date formatting', () => {
  it('unknown is a dash, a real zero is 0', () => {
    expect(fmtNum(null)).toBe(DASH);
    expect(fmtNum(undefined)).toBe(DASH);
    expect(fmtNum(NaN)).toBe(DASH);
    expect(fmtNum(0)).toBe('0');
    expect(fmtNum(1234.56, 1)).toBe('1,234.6');
  });
  it('formats date keys from their parts, never through a Date', () => {
    expect(shortDate('2036-09-06')).toBe('6 Sep');
    expect(longDate('2035-01-01')).toBe('1 Jan 2035');
    expect(shortDate(null)).toBe(DASH);
    expect(shortDate('nonsense')).toBe(DASH);
    expect(longDate(undefined)).toBe(DASH);
  });
  it('counts months between two keys', () => {
    expect(monthsBetween('2035-01-01', '2036-09-15')).toBe(21);
    expect(monthsBetween('2036-09-14', '2036-09-15')).toBe(1);
    expect(monthsBetween('2035-02-03', '2036-09-03')).toBe(20);
    expect(monthsBetween('2036-09-15', '2035-01-01')).toBeNull();
    expect(monthsBetween(null, '2036-01-01')).toBeNull();
  });
  it('compacts rupees and energy', () => {
    expect(lkrCompact(3067844)).toEqual({ value: 'LKR 3.07', unit: 'M' });
    expect(lkrCompact(86446)).toEqual({ value: 'LKR 86.4', unit: 'K' });
    expect(lkrCompact(950)).toEqual({ value: 'LKR 950', unit: '' });
    expect(lkrCompact(null)).toEqual({ value: DASH, unit: '' });
    expect(energyCompact(78471)).toEqual({ value: '78.5', unit: 'MWh' });
    expect(energyCompact(1464)).toEqual({ value: '1,464', unit: 'kWh' });
    expect(energyCompact(null)).toEqual({ value: DASH, unit: 'kWh' });
  });
});

describe('target progress and gauge', () => {
  it('computes the share, clamps the fill, and flags overshoot', () => {
    expect(targetProgress(98.2, 150)).toMatchObject({ pct: 65, level: 65, reached: false });
    expect(targetProgress(98.2, 150).toGoKwh).toBeCloseTo(51.8, 6);
    expect(targetProgress(180, 150)).toMatchObject({ pct: 120, level: 100, reached: true, toGoKwh: 0 });
    expect(targetProgress(0, 150)).toMatchObject({ pct: 0, level: 0 });
  });
  it('is null (unknown) when today, the target, or a positive target is missing', () => {
    expect(targetProgress(null, 150)).toBeNull();
    expect(targetProgress(98, null)).toBeNull();
    expect(targetProgress(98, 0)).toBeNull();
    expect(targetProgress(-1, 150)).toBeNull();
  });
  it('gauge fraction is clamped and unknown stays unknown', () => {
    expect(gaugeFraction(21.4, 40)).toBeCloseTo(0.535, 6);
    expect(gaugeFraction(55, 40)).toBe(1);
    expect(gaugeFraction(0, 40)).toBe(0);
    expect(gaugeFraction(null, 40)).toBeNull();
    expect(gaugeFraction(10, null)).toBeNull();
  });
});

describe('live status', () => {
  it('night offline is asleep, not a fault; abnormal offline and alarm are faults', () => {
    expect(liveState({ status: 'online' })).toEqual({ key: 'online', label: 'Online', tone: 'good' });
    expect(liveState({ status: 'offline', abnormalOffline: false })).toMatchObject({ key: 'asleep', tone: 'neutral' });
    expect(liveState({ status: 'offline', abnormalOffline: true })).toMatchObject({ key: 'offline', tone: 'bad' });
    expect(liveState({ status: 'alarm' })).toMatchObject({ key: 'fault', tone: 'bad' });
    expect(liveState({ status: 'weird' })).toMatchObject({ key: 'unknown' });
    expect(liveState(null)).toMatchObject({ key: 'unknown' });
  });
  it('a stale reading is flagged and never shown as current', () => {
    const s = liveState({ status: 'online', stale: true });
    expect(s.label).toBe('Online · last known');
    expect(s.tone).toBe('warn');
  });
  it('freshness drains over the window and prefers the inverter timestamp', () => {
    const now = 10_000_000;
    expect(freshness({ dataTimestamp: now - 2 * 60000 }, now)).toMatchObject({ label: '2 min ago' });
    expect(freshness({ dataTimestamp: now - 2 * 60000 }, now).fraction).toBeCloseTo(1 - 2 / FRESH_WINDOW_MIN, 6);
    expect(freshness({ dataTimestamp: now - 30 * 60000 }, now).fraction).toBe(0);
    expect(freshness({ fetchedAt: now - 10_000 }, now).label).toBe('just now');
    expect(freshness({ dataTimestamp: now - 3 * 3600000 }, now).label).toBe('3 h ago');
    expect(freshness({ dataTimestamp: now - 2 * 86400000 }, now).label).toBe('2 d ago');
    expect(freshness({ dataTimestamp: now + 5000 }, now).ageMin).toBe(0);
    expect(freshness({ dataTimestamp: null, fetchedAt: null }, now)).toBeNull();
  });
});

describe('open bill period', () => {
  it('picks the provisional row and keeps null as null', () => {
    const rows = [{ status: 'finalized', inverter: 4100 }, { status: 'provisional', inverter: null, periodStart: '2036-09-04', daysPresent: 0, daysInPeriod: 11 }];
    expect(openBillPeriod(rows)).toEqual({ startKey: '2036-09-04', kwh: null, daysPresent: 0, daysInPeriod: 11 });
    expect(openBillPeriod([{ status: 'finalized' }])).toBeNull();
    expect(openBillPeriod(undefined)).toBeNull();
  });
});

describe('rendered tiles', () => {
  const totals = {
    generation: { totalKwh: 78471, dayCount: 618, firstDay: '2035-01-01', lastDay: '2036-09-14', missingDays: 5 },
    earnings: { totalLkr: 3067844, billCount: 20, billsWithoutEarnings: 0, firstBillDate: '2035-02-03', lastBillDate: '2036-09-03' }
  };
  const comparison = { rows: [{ status: 'provisional', inverter: 1464, periodStart: '2036-09-04', daysPresent: 11, daysInPeriod: 12 }] };

  it('headline tiles show the three figures with their context', () => {
    const html = renderToString(h(TotalsRow, { totals, comparison, todayKey: '2036-09-15', loading: false }));
    expect(html).toContain('This billing period');
    expect(html).toContain('1,464');
    expect(html).toContain('78.5');
    expect(html).toContain('MWh');
    expect(html).toContain('LKR 3.07');
    expect(html).toContain('20 CEB bills');
    expect(html).toContain('awaiting bill');
  });

  it('missing data renders dashes, never zeros', () => {
    const html = renderToString(h(TotalsRow, { totals: null, comparison: null, todayKey: null, loading: false }));
    expect(html).toContain(DASH);
    expect(html).not.toMatch(/>0</);
  });

  it('today tile: percentage, peak, and a percent-free state when there is no target', () => {
    const live = { status: 'online', todayKwh: 98.2, peakTodayKw: 26.3, peakTodayAt: '11:55', fetchedAt: 1000 };
    const withTarget = renderToString(h(TodayTile, { live, targetKwh: 150, now: 1000 }));
    expect(withTarget).toContain('65%');
    expect(withTarget).toContain('98.2');
    expect(withTarget).toContain('26.3 kW');
    expect(withTarget).toContain('11:55');
    const noTarget = renderToString(h(TodayTile, { live, targetKwh: null, now: 1000 }));
    expect(noTarget).not.toContain('65%');
    expect(noTarget).toContain('Set a daily target in Settings');
    const noPeak = renderToString(h(TodayTile, { live: { ...live, peakTodayKw: undefined, peakTodayAt: undefined }, targetKwh: 150, now: 1000 }));
    expect(noPeak).toMatch(/Peak\s*(<!-- -->)?\s*<b[^>]*>—<\/b>/);
  });

  it('live gauge: shows kW and share, or a dash when power is unknown', () => {
    const on = renderToString(h(LiveGauge, { live: { status: 'online', currentPowerKw: 21.4 }, maxKw: 40 }));
    expect(on).toContain('21.4');
    expect(on).toContain('Online');
    expect(on).toContain('53%');
    expect(on).toContain('role="meter"');
    const unknown = renderToString(h(LiveGauge, { live: { status: 'offline', abnormalOffline: true, currentPowerKw: null }, maxKw: 40 }));
    expect(unknown).toContain(DASH);
    expect(unknown).toContain('Offline');
    expect(unknown).not.toContain('aria-valuenow');
    const zero = renderToString(h(LiveGauge, { live: { status: 'online', currentPowerKw: 0 }, maxKw: 40 }));
    expect(zero).toContain('aria-valuenow="0"');
  });
});
