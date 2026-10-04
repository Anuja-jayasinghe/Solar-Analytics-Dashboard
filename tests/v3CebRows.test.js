// tests/v3CebRows.test.js
//
// The CEB vs Inverter tile's pure logic (src/v3/ceb/rows.js) and the shared chart maths
// (src/v3/charts/scale.js). Specs: LR-001 alignment labels, LR-004 money gap.

import { describe, it, expect } from 'vitest';
import {
  niceMax, axisTicks, maxOf, linePath, areaPath, yPct, xPct, valueFromPointer, clamp
} from '../src/v3/charts/scale.js';
import {
  generationMonth, buildCebRows, isPartial, windowOf, stepEnd, defaultThreshold, aboveSummary, varianceTag, gapSummary
} from '../src/v3/ceb/rows.js';

describe('chart scale', () => {
  it('rounds a maximum up to a tidy axis end', () => {
    expect(niceMax(4300)).toBe(5000);
    expect(niceMax(4100 * 1.06)).toBe(5000);
    expect(niceMax(5090)).toBe(6000);
    expect(niceMax(10)).toBe(10);
    expect(niceMax(1.8)).toBe(2);
    expect(niceMax(0.3)).toBeCloseTo(0.3, 10);
    expect(niceMax(0)).toBe(1);
    expect(niceMax(NaN)).toBe(1);
    expect(niceMax(-5)).toBe(1);
  });
  it('builds five ticks, top first, with percent positions', () => {
    const t = axisTicks(100);
    expect(t.map((x) => x.label)).toEqual(['100', '75', '50', '25', '0']);
    expect(t.map((x) => x.pct)).toEqual([100, 75, 50, 25, 0]);
  });
  it('maxOf ignores unknowns and has a fallback', () => {
    expect(maxOf([1, null, 5, undefined, NaN, 3])).toBe(5);
    expect(maxOf([null, null], 7)).toBe(7);
  });
  it('a null point breaks the line instead of dipping to zero', () => {
    expect(linePath([[0, 10], [50, 20], null, [100, 30]])).toBe('M 0.00 10.00 L 50.00 20.00 M 100.00 30.00');
    expect(linePath([null, null])).toBe('');
  });
  it('the area spans the known points down to the baseline, or is empty', () => {
    expect(areaPath([null, [10, 40], [90, 60], null])).toBe('M 10.00 100 L 10.00 40.00 L 90.00 60.00 L 90.00 100 Z');
    expect(areaPath([null])).toBe('');
  });
  it('positions values and columns', () => {
    expect(yPct(50, 100)).toBe(50);
    expect(yPct(500, 100)).toBe(0);
    expect(yPct(-5, 100)).toBe(100);
    expect(xPct(0, 4)).toBe(12.5);
    expect(xPct(3, 4)).toBe(87.5);
    expect(clamp(5, 0, 3)).toBe(3);
  });
  it('turns a pointer position into a snapped value', () => {
    expect(valueFromPointer(100, 0, 200, 4000, 10)).toBe(2000);
    expect(valueFromPointer(-50, 0, 200, 4000, 10)).toBe(4000);
    expect(valueFromPointer(999, 0, 200, 4000, 10)).toBe(0);
    expect(valueFromPointer(100, 0, 200, 4003, 50)).toBe(2000);
    expect(valueFromPointer(10, 0, 0, 4000)).toBeNull();
  });
});

const bill = (billDate, o = {}) => ({
  billDate, periodStart: '2036-08-06', periodEnd: billDate, cebKwh: 4000, earningsLkr: 176000, effectiveRatePerKwh: 44,
  inverterKwh: 4100, daysPresent: 29, daysInPeriod: 29, complete: true, variancePct: -2.4, ...o
});

describe('generation month (a bill in month N reports N-1)', () => {
  it('uses the month before the bill date, rolling the year', () => {
    expect(generationMonth('2036-09-03')).toEqual({ label: 'Aug', year: 2036 });
    expect(generationMonth('2036-01-04')).toEqual({ label: 'Dec', year: 2035 });
    expect(generationMonth('2035-02-03')).toEqual({ label: 'Jan', year: 2035 });
  });
});

describe('building the rows', () => {
  const bills = [bill('2036-09-03'), bill('2036-08-03', { periodStart: '2036-07-04', inverterKwh: 3900, variancePct: 2.5 }), bill('2036-07-04', { complete: false, daysPresent: 25, daysInPeriod: 30 })];
  const open = { month: 'Sep', year: 2036, periodStart: '2036-09-04', inverter: 1464, daysPresent: 11, daysInPeriod: 12 };

  it('sorts oldest first and appends the open period last, awaiting its bill', () => {
    const rows = buildCebRows(bills, open, '2036-09-15');
    expect(rows.map((r) => r.id)).toEqual(['2036-07-04', '2036-08-03', '2036-09-03', 'open']);
    expect(rows.map((r) => r.label)).toEqual(['Jun', 'Jul', 'Aug', 'Sep']);
    const o = rows[3];
    expect(o).toMatchObject({ status: 'provisional', cebKwh: null, periodEnd: '2036-09-15', gapLkr: null, variancePct: null, gapReason: 'not_finalized' });
  });

  it('computes each bill\'s money gap with LR-004 (CEB paid minus generation worth)', () => {
    const rows = buildCebRows([bill('2036-09-03')], null, '2036-09-15');
    expect(rows[0].gapLkr).toBeCloseTo((4000 - 4100) * 44, 6);
    expect(rows[0].gapReason).toBeNull();
  });

  it('excludes (never zeroes) a bill with missing days, and hides its variance', () => {
    const [r] = buildCebRows([bill('2036-07-04', { complete: false, daysPresent: 25, daysInPeriod: 30 })], null, null);
    expect(r.gapLkr).toBeNull();
    expect(r.gapReason).toBe('incomplete_days');
    expect(r.variancePct).toBeNull();
    expect(isPartial(r)).toBe(true);
  });

  it('keeps unknown figures null', () => {
    const [r] = buildCebRows([bill('2036-09-03', { inverterKwh: null, cebKwh: null, earningsLkr: null, effectiveRatePerKwh: null })], null, null);
    expect(r.inverterKwh).toBeNull();
    expect(r.cebKwh).toBeNull();
    expect(r.gapLkr).toBeNull();
    expect(r.ratePerKwh).toBeNull();
  });

  it('no open period when it has no inverter total; tolerates empty input', () => {
    expect(buildCebRows([], { month: 'Sep', inverter: null }, '2036-09-15')).toEqual([]);
    expect(buildCebRows(undefined, null, null)).toEqual([]);
    expect(buildCebRows([null, { notABill: 1 }], null, null)).toEqual([]);
  });
});

describe('window, stepping and threshold', () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({ id: String(i), inverterKwh: 3000 + i * 100 }));
  it('shows the last N rows ending at the chosen index', () => {
    const w = windowOf(rows, 8, 19);
    expect(w.rows.map((r) => r.id)).toEqual(['12', '13', '14', '15', '16', '17', '18', '19']);
    expect(windowOf(rows, 8, 3).rows.map((r) => r.id)).toEqual(['0', '1', '2', '3']);
    expect(windowOf(rows, 'all', 19).rows).toHaveLength(20);
    expect(windowOf(rows, 8, 999).end).toBe(19);
    expect(windowOf([], 8, 0)).toEqual({ start: 0, end: -1, rows: [] });
  });
  it('steps half a window and stays inside the data', () => {
    expect(stepEnd(rows, 8, 19, -1)).toBe(15);
    expect(stepEnd(rows, 8, 7, -1)).toBe(7);
    expect(stepEnd(rows, 8, 17, 1)).toBe(19);
    expect(stepEnd(rows, 'all', 19, -1)).toBe(19);
  });
  it('defaults the line to the median, rounded to 100', () => {
    expect(defaultThreshold(rows)).toBe(4000);
    expect(defaultThreshold([{ inverterKwh: null }])).toBe(0);
    expect(defaultThreshold([{ inverterKwh: 3000 }, { inverterKwh: 4000 }, { inverterKwh: 9000 }])).toBe(4000);
  });
  it('counts periods above the line and skips unknown totals', () => {
    expect(aboveSummary([{ inverterKwh: 5000 }, { inverterKwh: 3000 }, { inverterKwh: null }], 4000)).toEqual({ above: 1, known: 2 });
    expect(aboveSummary([{ inverterKwh: 4000 }], 4000)).toEqual({ above: 0, known: 1 });
  });
});

describe('variance tag', () => {
  it('awaiting bill, partial days, signed percentage, or nothing', () => {
    expect(varianceTag({ status: 'provisional' })).toEqual({ text: 'awaiting bill', tone: 'muted' });
    expect(varianceTag({ status: 'finalized', daysPresent: 25, daysInPeriod: 30, variancePct: 3 })).toEqual({ text: '25/30 d', tone: 'warn' });
    expect(varianceTag({ status: 'finalized', daysPresent: 30, daysInPeriod: 30, variancePct: -2.44 }).text).toBe('−2.4%');
    expect(varianceTag({ status: 'finalized', daysPresent: 30, daysInPeriod: 30, variancePct: 3.06 }).text).toBe('+3.1%');
    expect(varianceTag({ status: 'finalized', daysPresent: 30, daysInPeriod: 30, variancePct: 0 }).text).toBe('0.0%');
    expect(varianceTag({ status: 'finalized', daysPresent: null, daysInPeriod: null, variancePct: null }).text).toBe('');
  });
});

describe('money gap summary (LR-004)', () => {
  const b = (id, ceb, inv, o = {}) => bill(id, { cebKwh: ceb, inverterKwh: inv, earningsLkr: ceb * 40, effectiveRatePerKwh: 40, ...o });
  const all = [b('2036-07-03', 1000, 1100), b('2036-08-03', 1000, 1050), b('2036-09-03', 1000, 1000, { complete: false })];
  const rows = buildCebRows(all, null, '2036-09-15');

  it('sums the gap over the periods in view and reports how many were comparable', () => {
    const s = gapSummary(rows, all);
    expect(s.windowLkr).toBeCloseTo(-(100 * 40 + 50 * 40), 6);
    expect(s.windowCompared).toBe(2);
    expect(s.windowTotal).toBe(3);
    expect(s.all.periods).toBe(2);
    expect(s.all.excluded).toBe(1);
    expect(s.all.differenceLkr).toBeCloseTo(-6000, 6);
    expect(s.all.paidLkr).toBe(80000);
  });
  it('is null (not 0) when nothing in view is comparable', () => {
    const s = gapSummary([rows[2]], all);
    expect(s.windowLkr).toBeNull();
    expect(s.windowCompared).toBe(0);
  });
});

import { columnTip, gapTip, gapLabel } from '../src/v3/ceb/rows.js';

describe('column hints', () => {
  const [r] = buildCebRows([bill('2036-09-03')], null, null);
  it('describes the period, both totals and the variance', () => {
    const tip = columnTip(r, 4000);
    expect(tip).toContain('Aug 2036');
    expect(tip).toContain('6 Aug to 3 Sep');
    expect(tip).toContain('Inverter 4,100 kWh (above the line)');
    expect(tip).toContain('CEB 4,000 kWh');
    expect(tip).toContain('variance −2.4%');
  });
  it('explains an open period and a partial one instead of inventing a variance', () => {
    const [o] = buildCebRows([], { month: 'Sep', year: 2036, periodStart: '2036-09-04', inverter: 1464, daysPresent: 11, daysInPeriod: 12 }, '2036-09-15');
    expect(columnTip(o, 4000)).toContain('CEB bill not issued yet · 11 of 12 days so far');
    const [p] = buildCebRows([bill('2036-07-04', { complete: false, daysPresent: 25, daysInPeriod: 30 })], null, null);
    expect(columnTip(p, 0)).toContain('only 25 of 30 days recorded');
    expect(columnTip({ ...r, inverterKwh: null }, 4000)).toContain('Inverter no total');
  });
  it('money-gap hints show the working and the direction', () => {
    expect(gapTip(r)).toContain('CEB paid LKR 176,000');
    expect(gapTip(r)).toContain('generation worth LKR 180,400');
    expect(gapTip(r)).toContain('− LKR 4.4 K');
    expect(gapTip(r)).toContain('CEB paid less than the inverter generated');
    const [p] = buildCebRows([bill('2036-07-04', { complete: false, daysPresent: 25, daysInPeriod: 30 })], null, null);
    expect(gapTip(p)).toContain('not compared');
    const [o] = buildCebRows([], { month: 'Sep', year: 2036, inverter: 1, daysPresent: 1, daysInPeriod: 1 }, '2036-09-15');
    expect(gapTip(o)).toContain('bill not issued yet');
  });
  it('labels a gap bar compactly and leaves unknown blank', () => {
    expect(gapLabel(-5800)).toBe('−5.8 K');
    expect(gapLabel(1500000)).toBe('+1.50 M');
    expect(gapLabel(null)).toBe('');
  });
});
