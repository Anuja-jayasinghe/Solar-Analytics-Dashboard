// tests/v3CebRows.test.js
//
// The CEB vs Inverter tile's pure logic (src/v3/ceb/rows.js) and the shared chart maths
// (src/v3/charts/scale.js). Specs: LR-001 alignment labels, LR-004 money gap.

import { describe, it, expect } from 'vitest';
import {
  niceMax, axisTicks, maxOf, linePath, areaPath, yPct, xPct, valueFromPointer, clamp
} from '../src/v3/charts/scale.js';
import {
  generationMonth, buildCebRows, isPartial, windowOf, stepEnd, defaultThreshold, aboveSummary, varianceTag, gapCell, gapCounts, gapSentence, GAP_MATCH_PCT
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
  const full = (varianceKwh) => ({ status: 'finalized', daysPresent: 30, daysInPeriod: 30, varianceKwh });

  it('shows which side was higher and by how many kWh, in words for the tooltip and the table', () => {
    expect(varianceTag(full(-131.4))).toMatchObject({ text: '131', higher: 'gen', short: 'Inverter +131', title: 'Inverter generated 131 kWh more than CEB paid for' });
    expect(varianceTag(full(2040))).toMatchObject({ text: '2,040', higher: 'ceb', short: 'CEB +2,040', title: 'CEB paid for 2,040 kWh more than the inverter generated' });
    expect(varianceTag(full(0.3))).toMatchObject({ text: 'equal', higher: null });
  });

  it('awaiting bill, partial days, or nothing: never a kWh figure for a period that is not complete', () => {
    expect(varianceTag({ status: 'provisional' })).toMatchObject({ text: 'awaiting bill', tone: 'muted', higher: null });
    expect(varianceTag({ status: 'finalized', daysPresent: 25, daysInPeriod: 30, varianceKwh: 300 })).toMatchObject({ text: '25/30 d', tone: 'warn', higher: null });
    expect(varianceTag({ status: 'finalized', daysPresent: null, daysInPeriod: null, varianceKwh: null }).text).toBe('');
  });
});

describe('buildCebRows varianceKwh', () => {
  it('carries the kWh difference only for complete periods (null is not zero)', () => {
    const b = { billDate: '2036-09-03', periodStart: '2036-08-04', periodEnd: '2036-09-03', cebKwh: 4000, earningsLkr: 148000, inverterKwh: 4131, daysPresent: 31, daysInPeriod: 31, complete: true, varianceKwh: -131, variancePct: -3.2 };
    expect(buildCebRows([b], null, '2036-09-10')[0].varianceKwh).toBe(-131);
    expect(buildCebRows([{ ...b, complete: false, daysPresent: 29 }], null, '2036-09-10')[0].varianceKwh).toBeNull();
  });
});

describe('monthly money gap (LR-004)', () => {
  // 40 LKR/kWh; variancePct as the bills API reports it: (ceb − inverter) ÷ inverter × 100
  const b = (id, ceb, inv, o = {}) => bill(id, { cebKwh: ceb, inverterKwh: inv, earningsLkr: ceb * 40, effectiveRatePerKwh: 40, variancePct: ((ceb - inv) / inv) * 100, ...o });
  const all = [
    b('2036-06-03', 1000, 1100), // paid less: 100 kWh × 40 = LKR 4.0 K, −9.1%
    b('2036-07-03', 1000, 1005), // within 1%: even
    b('2036-08-03', 1050, 1000), // paid more: LKR 2.0 K, +5%
    b('2036-09-03', 1000, 1000, { complete: false, daysPresent: 25, daysInPeriod: 30 }) // not comparable
  ];
  const rows = buildCebRows(all, { month: 'Sep', year: 2036, periodStart: '2036-09-04', inverter: 300, daysPresent: 9, daysInPeriod: 9 }, '2036-09-12');

  it('says per month whether CEB paid for what was made, less or more, with the rupees', () => {
    expect(gapCell(rows[0])).toMatchObject({ state: 'less', text: '4.0 K' });
    expect(gapCell(rows[0]).title).toMatch(/\nCEB paid LKR 4\.0 K less than the generation was worth \(9\.1%\)$/);
    expect(gapCell(rows[1])).toMatchObject({ state: 'matched', text: 'even' });
    expect(gapCell(rows[2])).toMatchObject({ state: 'more', text: '2.0 K' });
  });

  it('a difference within the match band is even, just outside it is not', () => {
    expect(GAP_MATCH_PCT).toBe(1);
    expect(gapCell({ ...rows[0], gapLkr: -400, variancePct: -1 }).state).toBe('matched');
    expect(gapCell({ ...rows[0], gapLkr: -404, variancePct: -1.01 }).state).toBe('less');
  });

  it('never shows an amount for a month that cannot be compared or has no bill yet', () => {
    expect(gapCell(rows[3])).toMatchObject({ state: 'none', text: '–' });
    expect(gapCell(rows[3]).title).toContain('Not compared: only 25 of 30 days recorded');
    expect(gapCell(rows[4])).toMatchObject({ state: 'open', text: '' });
  });

  it('counts the months and sums what was paid less and more, in one plain sentence', () => {
    const c = gapCounts(rows);
    expect(c).toMatchObject({ matched: 1, less: 1, more: 1, compared: 3 });
    expect(c.lessLkr).toBeCloseTo(4000, 6);
    expect(gapSentence(c, rows.length)).toBe('3 of 5 bills compared: 1 even · 1 paid less (LKR 4.0 K short) · 1 paid more (LKR 2.0 K extra)');
    expect(gapSentence(gapCounts([rows[3]]), 1)).toBe('No bill in view can be compared yet');
  });
});

import { columnTip, gapTip } from '../src/v3/ceb/rows.js';

describe('column hints', () => {
  const [r] = buildCebRows([bill('2036-09-03')], null, null);
  it('a column says only its period: the totals are on the bars, the tags under them', () => {
    expect(columnTip(r)).toBe('Aug 6 → Sep 3');
    const [o] = buildCebRows([], { month: 'Sep', year: 2036, periodStart: '2036-09-04', inverter: 1464, daysPresent: 11, daysInPeriod: 12 }, '2036-09-15');
    expect(columnTip(o)).toBe('Sep 4 → today');
    expect(columnTip({ ...r, periodStart: null })).toBe('Aug 2036'); // no known start: the month it reports
  });
  it('money-gap hints: the period, then the bar in plain words', () => {
    expect(gapTip(r)).toBe('Aug 6 → Sep 3\nCEB paid LKR 4.4 K less than the generation was worth');
    expect(gapTip({ ...r, gapLkr: 1500 })).toBe('Aug 6 → Sep 3\nCEB paid LKR 1.5 K more than the generation was worth');
    const [p] = buildCebRows([bill('2036-07-04', { complete: false, daysPresent: 25, daysInPeriod: 30 })], null, null);
    expect(gapTip(p)).toContain('Not compared: only 25 of 30 days recorded');
    const [o] = buildCebRows([], { month: 'Sep', year: 2036, periodStart: '2036-09-04', inverter: 1, daysPresent: 1, daysInPeriod: 1 }, '2036-09-15');
    expect(gapTip(o)).toBe('Sep 4 → today\nBill not issued yet');
  });
});

import { chartNum, MAX_LABELLED_COLUMNS } from '../src/v3/charts/scale.js';

describe('value labels on charts', () => {
  it('prints just the number: whole above 10, one decimal below, compact when crowded', () => {
    expect(chartNum(4102)).toBe('4,102');
    expect(chartNum(4102, { dense: true })).toBe('4.1k');
    expect(chartNum(152.34)).toBe('152');
    expect(chartNum(7.26)).toBe('7.3');
    expect(chartNum(0)).toBe('0'); // a measured zero is shown
    expect(chartNum(null)).toBe(''); // unknown prints nothing, never 0
    expect(chartNum(NaN)).toBe('');
    expect(chartNum(-5800, { dense: true })).toBe('-5.8k');
    expect(MAX_LABELLED_COLUMNS).toBe(40);
  });
});
