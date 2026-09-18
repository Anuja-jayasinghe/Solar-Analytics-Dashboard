// tests/dashboardV2Data.test.js
//
// Pure-logic coverage for the redesigned dashboard's data reshaping
// (src/lib/dashboardV2Data.js). These functions never touch the network; the async fetchers
// in the same file are thin wrappers around Supabase/Open-Meteo calls and are exercised
// manually against the real anon-readable tables instead (see the RUNBOOK-style verification
// in the PR description), the same way tests/pdfText.test.js leaves the pdfjs call itself
// untested and pins the reduction logic around it.
//
// The recurring theme, same as tests/energyAlignment.test.js: null must stay null. A day
// with no live samples is not a day with 0 kWh, and a month with no bill yet is not a month
// CEB paid nothing for.

import { describe, it, expect } from 'vitest';
import {
  buildDailySeries,
  buildOverlapSeries,
  computeIncomeComparison,
  weatherCodeToKind
} from '../src/lib/dashboardV2Data.js';

describe('buildDailySeries', () => {
  it('returns exactly `days` consecutive dates ending today', () => {
    const today = new Date('2026-09-18T12:00:00');
    const series = buildDailySeries([], [], 5, today, null);
    expect(series.map((d) => d.date)).toEqual([
      '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18'
    ]);
    expect(series[4].isToday).toBe(true);
    expect(series[0].isToday).toBe(false);
  });

  it('buckets live samples onto their local calendar day, sorted by hour', () => {
    const today = new Date('2026-09-18T12:00:00');
    const liveRows = [
      { data_timestamp: '2026-09-17T12:56:00Z', power_ac: 3.5 }, // 18:26 Colombo
      { data_timestamp: '2026-09-17T01:36:00Z', power_ac: 1.2 }, // 07:06 Colombo
    ];
    const series = buildDailySeries(liveRows, [], 5, today, null);
    const day = series.find((d) => d.date === '2026-09-17');
    expect(day.points.map((p) => p.kw)).toEqual([1.2, 3.5]); // sorted by hour, not insertion order
    expect(day.sampleCount).toBe(2);
  });

  it('takes total/peak from the daily summary for past days, not from sparse live samples', () => {
    const today = new Date('2026-09-18T12:00:00');
    const summaryRows = [{ summary_date: '2026-09-17', total_generation_kwh: 83.9, peak_power_kw: 8.59 }];
    const liveRows = [{ data_timestamp: '2026-09-17T07:00:00Z', power_ac: 2.1 }];
    const series = buildDailySeries(liveRows, summaryRows, 5, today, null);
    const day = series.find((d) => d.date === '2026-09-17');
    expect(day.totalKwh).toBe(83.9);
    expect(day.peakKw).toBe(8.59); // from the summary, not max(live samples) = 2.1
  });

  it('a day with no summary row and no live samples reports null, never 0', () => {
    const today = new Date('2026-09-18T12:00:00');
    const series = buildDailySeries([], [], 3, today, null);
    const pastDay = series[0];
    expect(pastDay.totalKwh).toBeNull();
    expect(pastDay.peakKw).toBeNull();
  });

  it("today's total comes from the live daily-generation reading, not the (absent) summary row", () => {
    const today = new Date('2026-09-18T12:00:00');
    const series = buildDailySeries([], [], 1, today, { value: 42.3 });
    expect(series[0].totalKwh).toBe(42.3);
  });

  it("today's peak is computed from live samples when there is no summary row yet", () => {
    const today = new Date('2026-09-18T12:00:00');
    const liveRows = [
      { data_timestamp: '2026-09-18T04:00:00Z', power_ac: 5 },
      { data_timestamp: '2026-09-18T08:00:00Z', power_ac: 9.2 }
    ];
    const series = buildDailySeries(liveRows, [], 1, today, { value: 10 });
    expect(series[0].peakKw).toBe(9.2);
  });
});

describe('buildOverlapSeries', () => {
  const rows = [
    { month: 'Jun', inverter: 3980, ceb: 3912, status: 'finalized' },
    { month: 'Jul', inverter: 4205, ceb: 4180, status: 'finalized' },
    { month: 'Aug', inverter: 3120, ceb: null, status: 'provisional' },
    { month: 'Sep', inverter: null, ceb: null, status: 'pending' }
  ];

  it('drops pending months with no inverter figure at all', () => {
    const { points } = buildOverlapSeries(rows);
    expect(points.map((p) => p.month ?? p.label)).not.toContain(undefined);
    expect(points).toHaveLength(3);
    expect(points.at(-1).label).toBe('Aug');
  });

  it('keeps ceb as null for the provisional month rather than 0', () => {
    const { points } = buildOverlapSeries(rows);
    const aug = points.find((p) => p.label === 'Aug');
    expect(aug.ceb).toBeNull();
    expect(aug.inverter).toBe(3120);
  });

  it('computes a max spanning both series', () => {
    const { maxKwh } = buildOverlapSeries(rows);
    expect(maxKwh).toBe(4205);
  });

  it('returns an empty series (not a throw) when nothing has inverter data yet', () => {
    const { points, maxKwh } = buildOverlapSeries([{ month: 'Jan', inverter: null, ceb: null, status: 'pending' }]);
    expect(points).toEqual([]);
    expect(maxKwh).toBe(0);
  });
});

describe('computeIncomeComparison', () => {
  it('computes expected/actual/diff for a settled last period', () => {
    const result = computeIncomeComparison({
      lastFinalizedRow: { inverter: 4180, periodLabel: '5 Jul – 4 Aug' },
      lastBillEarnings: 148259,
      tariff: 37,
      lifetimeExpected: 3_690_000,
      lifetimeActual: 3_650_000
    });
    expect(result.expectedLast).toBe(4180 * 37);
    expect(result.actualLast).toBe(148259);
    expect(result.diffLast).toBeCloseTo(148259 - 4180 * 37, 5);
    expect(result.diffLast).toBeLessThan(0); // under-paid
    expect(result.lifetimeDiff).toBe(-40_000);
  });

  it('returns nulls rather than NaN or 0 when there is no settled period yet', () => {
    const result = computeIncomeComparison({
      lastFinalizedRow: null,
      lastBillEarnings: null,
      tariff: 37,
      lifetimeExpected: 100,
      lifetimeActual: 90
    });
    expect(result.expectedLast).toBeNull();
    expect(result.actualLast).toBeNull();
    expect(result.diffLast).toBeNull();
    expect(result.periodLabel).toBeNull();
    // Lifetime is independent of the last-period figures and should still resolve.
    expect(result.lifetimeDiff).toBe(-10);
  });

  it('leaves lifetime null when either lifetime input is missing, rather than computing against 0', () => {
    const result = computeIncomeComparison({
      lastFinalizedRow: null,
      lastBillEarnings: null,
      tariff: 37,
      lifetimeExpected: undefined,
      lifetimeActual: 90
    });
    expect(result.lifetimeExpected).toBeNull();
    expect(result.lifetimeActual).toBeNull();
    expect(result.lifetimeDiff).toBeNull();
  });
});

describe('weatherCodeToKind', () => {
  it('maps clear-sky WMO codes to clear', () => {
    expect(weatherCodeToKind(0)).toBe('clear');
    expect(weatherCodeToKind(1)).toBe('clear');
  });

  it('maps thunderstorm codes to storm, not rain', () => {
    expect(weatherCodeToKind(95)).toBe('storm');
    expect(weatherCodeToKind(99)).toBe('storm');
  });

  it('falls back to cloudy for an unrecognised code rather than throwing', () => {
    expect(weatherCodeToKind(9999)).toBe('cloudy');
  });
});
