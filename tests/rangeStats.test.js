// tests/rangeStats.test.js
//
// LR-003 (docs/logic-registry/LR-003-custom-range-aggregation.md) acceptance criteria, executable.
// The theme: a missing day is UNKNOWN, never 0, and no rupee figure appears without an
// applicable, stated rate.

import { describe, it, expect } from 'vitest';
import {
  computeRangeStats, compareRanges, previousPeriod, sameRangeLastYear, buildBillRatePeriods, MAX_RANGE_DAYS
} from '../shared/domain/rangeStats.js';

const CAP = { capacityKwp: 41.76, acRatedKw: 40 };
const row = (date, kwh, peakKw = null) => ({ date, kwh, peakKw });

describe('LR-003 core figures', () => {
  const rows = [row('2026-10-01', 150, 28), row('2026-10-02', 100, 31), row('2026-10-04', 200, 30)]; // 10-03 missing
  const s = computeRangeStats({ from: '2026-10-01', to: '2026-10-04', rows, ...CAP });

  it('1. totals and averages ignore missing days; completeness reflects them', () => {
    expect(s.daysInRange).toBe(4);
    expect(s.presentDays).toBe(3);
    expect(s.missingDates).toEqual(['2026-10-03']);
    expect(s.completeness).toBeCloseTo(0.75, 10);
    expect(s.totalKwh).toBe(450);
    expect(s.avgPerDayKwh).toBe(150);
  });

  it('best, worst and peak', () => {
    expect(s.best).toEqual({ date: '2026-10-04', kwh: 200 });
    expect(s.worst).toEqual({ date: '2026-10-02', kwh: 100 });
    expect(s.peak).toEqual({ date: '2026-10-02', kw: 31 });
    expect(s.peakKnownDays).toBe(3);
  });

  it('5. specific yield uses the DC array size, capacity factor uses the AC rating', () => {
    expect(s.specificYield).toBeCloseTo(450 / 41.76, 10);
    expect(s.capacityFactor).toBeCloseTo(450 / (40 * 24 * 3), 10);
  });
});

describe('LR-003 null vs zero', () => {
  it('2. a measured zero is included and flagged; a missing day is not', () => {
    const s = computeRangeStats({
      from: '2026-10-01', to: '2026-10-03',
      rows: [row('2026-10-01', 0), row('2026-10-02', 120)], ...CAP
    });
    expect(s.presentDays).toBe(2);
    expect(s.zeroDays).toEqual(['2026-10-01']);
    expect(s.missingDates).toEqual(['2026-10-03']);
    expect(s.totalKwh).toBe(120);
    expect(s.worst).toEqual({ date: '2026-10-01', kwh: 0 });
  });

  it('3. nothing present → every figure is null (never 0)', () => {
    const s = computeRangeStats({ from: '2026-10-01', to: '2026-10-03', rows: [], ...CAP });
    expect(s.totalKwh).toBeNull();
    expect(s.avgPerDayKwh).toBeNull();
    expect(s.best).toBeNull();
    expect(s.worst).toBeNull();
    expect(s.peak).toBeNull();
    expect(s.specificYield).toBeNull();
    expect(s.capacityFactor).toBeNull();
    expect(s.completeness).toBe(0);
    expect(s.series.every((x) => x.kwh === null && x.cumulativeKwh === null)).toBe(true);
  });

  it('treats null, negative and non-finite generation as missing', () => {
    const s = computeRangeStats({
      from: '2026-10-01', to: '2026-10-04',
      rows: [row('2026-10-01', null), row('2026-10-02', -5), row('2026-10-03', NaN), row('2026-10-04', 80)], ...CAP
    });
    expect(s.presentDays).toBe(1);
    expect(s.totalKwh).toBe(80);
  });

  it('keeps peak null when no day has one', () => {
    const s = computeRangeStats({ from: '2026-10-01', to: '2026-10-01', rows: [row('2026-10-01', 90)], ...CAP });
    expect(s.peak).toBeNull();
    expect(s.peakKnownDays).toBe(0);
  });
});

describe('LR-003 ties, duplicates and bounds', () => {
  it('4. best/worst tie-break to the earliest date', () => {
    const s = computeRangeStats({
      from: '2026-10-01', to: '2026-10-03',
      rows: [row('2026-10-01', 100), row('2026-10-02', 100), row('2026-10-03', 100)], ...CAP
    });
    expect(s.best.date).toBe('2026-10-01');
    expect(s.worst.date).toBe('2026-10-01');
  });

  it('last duplicate wins and out-of-range rows are ignored', () => {
    const s = computeRangeStats({
      from: '2026-10-01', to: '2026-10-02',
      rows: [row('2026-10-01', 10), row('2026-10-01', 20), row('2026-09-30', 999), row('2026-10-03', 999)], ...CAP
    });
    expect(s.totalKwh).toBe(20);
  });

  it('11. rejects invalid ranges', () => {
    expect(() => computeRangeStats({ from: '2026-10-03', to: '2026-10-01', rows: [], ...CAP })).toThrow(RangeError);
    expect(() => computeRangeStats({ from: 'x', to: '2026-10-01', rows: [], ...CAP })).toThrow(RangeError);
    expect(() => computeRangeStats({ from: '2000-01-01', to: '2026-10-01', rows: [], ...CAP })).toThrow(/exceeds/);
    expect(MAX_RANGE_DAYS).toBe(3660);
  });

  it('guards divisions when capacity inputs are invalid', () => {
    const s = computeRangeStats({ from: '2026-10-01', to: '2026-10-01', rows: [row('2026-10-01', 90)], capacityKwp: 0, acRatedKw: -1 });
    expect(s.specificYield).toBeNull();
    expect(s.capacityFactor).toBeNull();
  });
});

describe('LR-003 series', () => {
  it('6. cumulative does not move on missing days and never interpolates; null before the first day', () => {
    const s = computeRangeStats({
      from: '2026-10-01', to: '2026-10-05',
      rows: [row('2026-10-02', 100), row('2026-10-03', 50), row('2026-10-05', 25)], ...CAP
    });
    expect(s.series.map((x) => x.kwh)).toEqual([null, 100, 50, null, 25]);
    expect(s.series.map((x) => x.cumulativeKwh)).toEqual([null, 100, 150, 150, 175]);
  });
});

describe('LR-003 revenue', () => {
  const rows = [row('2026-10-01', 100), row('2026-10-02', 100), row('2026-10-03', 100)];

  it('7a. fixed rate = total × rate and says so', () => {
    const s = computeRangeStats({ from: '2026-10-01', to: '2026-10-03', rows, ...CAP, rate: { mode: 'fixed', ratePerKwh: 37 } });
    expect(s.revenue).toEqual({ lkr: 11100, basis: 'fixed', ratedDays: 3, unratedDays: 0 });
  });

  it('7b. effective rate picks the bill period containing each day', () => {
    const periods = [
      { startDate: '2026-09-04', endDate: '2026-10-02', ratePerKwh: 37 },
      { startDate: '2026-10-03', endDate: '2026-11-02', ratePerKwh: 40 }
    ];
    const s = computeRangeStats({ from: '2026-10-01', to: '2026-10-03', rows, ...CAP, rate: { mode: 'effective', periods } });
    expect(s.revenue.lkr).toBe(100 * 37 + 100 * 37 + 100 * 40);
    expect(s.revenue.basis).toBe('effective');
    expect(s.revenue.unratedDays).toBe(0);
  });

  it('8. unrated days are excluded and counted; revenue is null when none are rated', () => {
    const periods = [{ startDate: '2026-10-01', endDate: '2026-10-01', ratePerKwh: 37 }];
    const part = computeRangeStats({ from: '2026-10-01', to: '2026-10-03', rows, ...CAP, rate: { mode: 'effective', periods } });
    expect(part.revenue).toEqual({ lkr: 3700, basis: 'effective', ratedDays: 1, unratedDays: 2 });

    const none = computeRangeStats({ from: '2026-10-01', to: '2026-10-03', rows, ...CAP, rate: { mode: 'effective', periods: [] } });
    expect(none.revenue.lkr).toBeNull();
    expect(none.revenue.unratedDays).toBe(3);
  });

  it('a fallback rate is used only where no bill applies, and the basis becomes "mixed"', () => {
    const periods = [{ startDate: '2026-10-01', endDate: '2026-10-01', ratePerKwh: 37 }];
    const s = computeRangeStats({ from: '2026-10-01', to: '2026-10-03', rows, ...CAP, rate: { mode: 'effective', periods, fallbackRatePerKwh: 37 } });
    expect(s.revenue).toEqual({ lkr: 11100, basis: 'mixed', ratedDays: 3, unratedDays: 0 });
  });

  it('no rate supplied → no LKR at all', () => {
    const s = computeRangeStats({ from: '2026-10-01', to: '2026-10-03', rows, ...CAP });
    expect(s.revenue.lkr).toBeNull();
    expect(s.revenue.basis).toBeNull();
  });

  it('rejects an unusable fixed rate instead of computing nonsense', () => {
    const s = computeRangeStats({ from: '2026-10-01', to: '2026-10-03', rows, ...CAP, rate: { mode: 'fixed', ratePerKwh: -1 } });
    expect(s.revenue.lkr).toBeNull();
  });
});

describe('buildBillRatePeriods', () => {
  const bills = [
    { bill_date: '2026-08-04', earnings: 143893, units_exported: 3889 },
    { bill_date: '2026-09-03', earnings: 148259, units_exported: 4007 },
    { bill_date: '2026-10-03', earnings: 139971, units_exported: 3783 }
  ];
  it('uses the LR-001 window (previous bill date + 1) and earnings ÷ units', () => {
    const p = buildBillRatePeriods([...bills].reverse());
    expect(p[1]).toMatchObject({ startDate: '2026-08-05', endDate: '2026-09-03' });
    expect(p[1].ratePerKwh).toBeCloseTo(37, 6);
    expect(p[2].startDate).toBe('2026-09-04');
  });
  it('falls back to bill_date − 30 days for the first bill', () => {
    expect(buildBillRatePeriods(bills)[0].startDate).toBe('2026-07-05');
  });
  it('omits a bill with no usable rate instead of dividing by zero', () => {
    expect(buildBillRatePeriods([{ bill_date: '2026-10-03', earnings: 0, units_exported: 0 }])).toEqual([]);
  });
});

describe('LR-003 comparisons', () => {
  const mk = (rows, from, to) => computeRangeStats({ from, to, rows, ...CAP });

  it('9. compares averages per day, so a different number of missing days is not a trend', () => {
    const current = mk([row('2026-10-02', 150), row('2026-10-03', 150)], '2026-10-01', '2026-10-04'); // 2 of 4 days
    const baseline = mk([row('2026-09-27', 100), row('2026-09-28', 100), row('2026-09-29', 100), row('2026-09-30', 100)], '2026-09-27', '2026-09-30');
    const c = compareRanges(current, baseline);
    expect(c.deltaAvgKwh).toBe(50);
    expect(c.deltaAvgPct).toBe(50);
    expect(c.currentCompleteness).toBe(0.5);
    expect(c.baselineCompleteness).toBe(1);
  });

  it('baseline average 0 → pct is null; missing baseline → everything null', () => {
    const cur = mk([row('2026-10-01', 100)], '2026-10-01', '2026-10-01');
    const zero = mk([row('2026-09-30', 0)], '2026-09-30', '2026-09-30');
    expect(compareRanges(cur, zero).deltaAvgPct).toBeNull();
    expect(compareRanges(cur, zero).deltaAvgKwh).toBe(100);
    const none = mk([], '2026-09-30', '2026-09-30');
    expect(compareRanges(cur, none).deltaAvgKwh).toBeNull();
  });

  it('10. previousPeriod and sameRangeLastYear', () => {
    expect(previousPeriod('2026-10-01', '2026-10-07')).toEqual({ from: '2026-09-24', to: '2026-09-30' });
    expect(previousPeriod('2026-03-01', '2026-03-01')).toEqual({ from: '2026-02-28', to: '2026-02-28' });
    expect(sameRangeLastYear('2026-10-01', '2026-10-07')).toEqual({ from: '2025-10-01', to: '2025-10-07' });
    expect(sameRangeLastYear('2028-02-29', '2028-03-02')).toEqual({ from: '2027-02-28', to: '2027-03-02' });
    expect(() => previousPeriod('2026-10-07', '2026-10-01')).toThrow(RangeError);
  });
});
