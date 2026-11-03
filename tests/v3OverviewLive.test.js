// tests/v3OverviewLive.test.js
//
// Overview live row + headline tiles: the pure helpers and the rendered tiles (server render).
// The rule under test throughout: unknown is shown as an em dash, never as 0.

import { describe, it, expect } from 'vitest';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import {
  DASH, fmtNum, shortDate, longDate, monthsBetween, lkrCompact, energyCompact, targetProgress, gaugeFraction,
  liveState, freshness, openPeriodView, FRESH_WINDOW_MIN, clockAt, readingNote, liveStatusInfo, errorLabel
} from '../src/v3/overview/format.js';
import { TotalsRow } from '../src/v3/overview/TotalsRow.jsx';
import { CebCompare } from '../src/v3/ceb/CebCompare.jsx';
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

  it('an inverter alarm shows its SolisCloud state code', () => {
    expect(liveState({ status: 'alarm', faultCode: 1011 })).toMatchObject({ key: 'fault', label: 'Fault · code 1011', tone: 'bad' });
    expect(liveState({ status: 'alarm', faultCode: null }).label).toBe('Fault');
    expect(liveStatusInfo({ status: 'alarm', faultCode: 1011 }, null, liveState({ status: 'alarm', faultCode: 1011 })).title).toBe('Inverter fault, state code 1011');
    // Online and Asleep say it all: no info icon
    expect(liveStatusInfo({ status: 'online' }, null, liveState({ status: 'online' }))).toBeNull();
    expect(liveStatusInfo({ status: 'offline' }, null, liveState({ status: 'offline' }))).toBeNull();
  });

  it('a SolisCloud failure is named as such, not as an inverter problem', () => {
    const none = liveState(null, { code: 'upstream_unavailable' });
    expect(none).toMatchObject({ key: 'upstream', label: 'SolisCloud not responding', tone: 'warn' });
    expect(liveStatusInfo(null, { code: 'upstream_unavailable' }, none)).toMatchObject({ title: 'SolisCloud did not answer' });
    expect(liveStatusInfo(null, { code: 'upstream_unavailable' }, none).text).toContain('No reading from today is saved yet');
    expect(liveState(null, { code: 'internal' }).key).toBe('unknown');

    const saved = { status: 'alarm', faultCode: 1011, stale: true, upstream: 'unavailable', source: 'saved', dataTimestamp: Date.parse('2026-11-03T06:20:00Z') };
    const s = liveState(saved);
    expect(s).toMatchObject({ key: 'upstream', label: 'SolisCloud not responding', tone: 'warn' });
    expect(s.inverter.label).toBe('Fault · code 1011'); // what the inverter last said is kept for the tip
    const tip = liveStatusInfo(saved, null, s).text;
    expect(tip).toContain('last saved reading at 11:50');
    expect(tip).toContain('Fault · code 1011');
    expect(tip).toContain('not a live value');
  });

  it('says which reading is on screen when it is not current', () => {
    const at = Date.parse('2026-11-03T06:20:00Z'); // 11:50 in Colombo
    expect(clockAt(at)).toBe('11:50');
    expect(clockAt(null)).toBeNull();
    expect(readingNote({ stale: true, source: 'saved', dataTimestamp: at })).toBe('last saved reading at 11:50');
    expect(readingNote({ stale: true, source: 'memory', dataTimestamp: at })).toBe('last reading at 11:50');
    expect(readingNote({ stale: true, source: 'saved', dataTimestamp: null })).toBe('last saved reading');
    expect(readingNote({ stale: false, dataTimestamp: at })).toBeNull();
    expect(errorLabel('upstream_unavailable')).toBe('live reading: SolisCloud not responding');
    expect(errorLabel('rate_limited')).toBe('rate_limited');
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
  it('reads totals.openPeriod and keeps null as null', () => {
    const openPeriod = { status: 'provisional', month: 'Aug', year: 2036, inverter: null, periodStart: '2036-09-04', daysPresent: 0, daysInPeriod: 11 };
    expect(openPeriodView(openPeriod)).toEqual({ startKey: '2036-09-04', endKey: null, kwh: null, daysPresent: 0, daysInPeriod: 11, month: 'Aug', year: 2036 });
    expect(openPeriodView({ status: 'finalized' })).toBeNull();
    expect(openPeriodView(undefined)).toBeNull();
  });
});

describe('rendered tiles', () => {
  const totals = {
    generation: { totalKwh: 78471, dayCount: 618, firstDay: '2035-01-01', lastDay: '2036-09-14', missingDays: 5 },
    earnings: { totalLkr: 3067844, billCount: 20, billsWithoutEarnings: 0, firstBillDate: '2035-02-03', lastBillDate: '2036-09-03' }
  };
  const withOpen = (openPeriod) => ({ ...totals, openPeriod: { status: 'provisional', month: 'Sep', year: 2036, lastBillDate: '2036-09-03', ...openPeriod } });

  it('headline tiles show the three figures with their context', () => {
    const html = renderToString(h(TotalsRow, { totals: withOpen({ inverter: 1464, periodStart: '2036-09-04', daysPresent: 11, daysInPeriod: 12 }), todayKey: '2036-09-15', loading: false }));
    expect(html).toContain('This billing period');
    expect(html).toContain('1,464');
    expect(html).toContain('78.5');
    expect(html).toContain('MWh');
    expect(html).toContain('LKR 3.07');
    expect(html).toContain('20 CEB bills');
    expect(html).toContain('awaiting bill');
  });

  it('headline tiles: an info icon only where the tile does not already say it', () => {
    const html = renderToString(h(TotalsRow, { totals: withOpen({ inverter: 1464, periodStart: '2036-09-04', daysPresent: 11, daysInPeriod: 12 }), todayKey: '2036-09-15', loading: false }));
    expect(html).toContain('aria-label="About this billing period"');
    expect(html).toContain('Bill date to bill date');
    expect(html).toContain('Starts the day after the latest CEB bill');
    expect(html).not.toContain('About all-time earnings'); // every bill has earnings: nothing to add
    const leftOut = renderToString(h(TotalsRow, { totals: { ...totals, earnings: { ...totals.earnings, billsWithoutEarnings: 2 } }, todayKey: '2036-09-15', loading: false }));
    expect(leftOut).toContain('About all-time earnings');
    expect(leftOut).toContain('2 bills left out');
  });

  it('the billing tile starts the day after the latest bill, not on the 1st of the month', () => {
    const todayKey = '2026-11-03';
    const html = renderToString(h(TotalsRow, {
      totals: { ...totals, openPeriod: { status: 'provisional', month: 'Oct', year: 2026, lastBillDate: '2026-10-03', periodStart: '2026-10-04', periodEnd: todayKey, inverter: 3100, daysPresent: 31, daysInPeriod: 31 } },
      todayKey, loading: false
    }));
    expect(html).toContain(`since ${shortDate('2026-10-04')}`);
    expect(html).not.toContain(`since ${shortDate('2026-11-01')}`);
    expect(html).toContain('3,100');
  });

  it('the open chart column matches the billing tile when today is still live-only', () => {
    const todayKey = '2036-09-15';
    const live = { todayKwh: 98.2 };
    const t = withOpen({ periodStart: '2036-09-04', periodEnd: todayKey, inverter: 1464.1, daysPresent: 11, daysInPeriod: 12 });
    const tile = renderToString(h(TotalsRow, { totals: t, live, todayKey, loading: false }));
    const chart = renderToString(h(CebCompare, {
      bills: { bills: [] }, openPeriod: t.openPeriod, live, lastStoredDay: totals.generation.lastDay,
      todayKey, loading: false, error: null
    }));
    expect(tile).toContain('1,562');
    expect(chart).toContain('>1,562</td>');
    expect(chart).not.toContain('>1,464</td>');
    expect(chart).toContain('4 Sep – today'); // the table states the real span, not just the month
  });

  it('does not add the live reading again when today is already stored', () => {
    const todayKey = '2036-09-15';
    const t = withOpen({ periodStart: '2036-09-04', periodEnd: todayKey, inverter: 1562.3, daysPresent: 12, daysInPeriod: 12 });
    const storedToday = { ...t, generation: { ...totals.generation, lastDay: todayKey } };
    const live = { todayKwh: 98.2 };
    const tile = renderToString(h(TotalsRow, { totals: storedToday, live, todayKey, loading: false }));
    const chart = renderToString(h(CebCompare, {
      bills: { bills: [] }, openPeriod: t.openPeriod, live, lastStoredDay: todayKey,
      todayKey, loading: false, error: null
    }));
    expect(tile).toContain('1,562');
    expect(chart).toContain('>1,562</td>');
    expect(chart).not.toContain('>1,660</td>');
  });

  it('shows a live-only first day in the open chart without inventing a CEB value', () => {
    const todayKey = '2036-09-15';
    const t = withOpen({ periodStart: todayKey, periodEnd: todayKey, inverter: null, daysPresent: 0, daysInPeriod: 1 });
    const chart = renderToString(h(CebCompare, {
      bills: { bills: [] }, openPeriod: t.openPeriod, live: { todayKwh: 98.2 }, lastStoredDay: null,
      todayKey, loading: false, error: null
    }));
    expect(chart).toContain('>98</td><td>awaiting bill</td>');
    expect(chart).not.toContain('>0</td>');
  });

  it('missing data renders dashes, never zeros', () => {
    const html = renderToString(h(TotalsRow, { totals: null, todayKey: null, loading: false }));
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

  it('live row when SolisCloud fails: the saved reading is labelled with its time, never shown as current', () => {
    const at = Date.parse('2026-11-03T06:20:00Z');
    const saved = { status: 'online', currentPowerKw: 30.1, todayKwh: 75.4, stale: true, upstream: 'unavailable', source: 'saved', dataTimestamp: at };
    const gauge = renderToString(h(LiveGauge, { live: saved, maxKw: 40 }));
    expect(gauge).toContain('SolisCloud not responding');
    expect(gauge).toContain('Last saved reading at 11:50');
    expect(gauge).toContain('kW then');
    expect(gauge).toContain('30.1');
    const today = renderToString(h(TodayTile, { live: saved, targetKwh: 150, now: at + 40 * 60000 }));
    expect(today).toContain('as of 11:50');
    expect(today).toContain('75.4');
  });

  it('live row when SolisCloud fails and nothing is saved today: dashes, and the cause named', () => {
    const gauge = renderToString(h(LiveGauge, { live: null, error: { code: 'upstream_unavailable' }, maxKw: 40, loading: false }));
    expect(gauge).toContain('SolisCloud not responding');
    expect(gauge).toContain('No reading saved today yet');
    expect(gauge).toMatch(new RegExp(`v3-gauge-kw">${DASH}<`)); // the reading is a dash, never 0 kW
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
