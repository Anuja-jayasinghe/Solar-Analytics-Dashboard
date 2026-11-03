// tests/v3Explore.test.js
//
// Pure logic for generation over time (series.js) and the hour-by-hour day (hourly.js).
// Rules under test: unknown days are null and never 0 (LR-003); ranges stay inside the data;
// long ranges group by month over the days that have a reading.

import { describe, it, expect } from 'vitest';
import {
  customRange, isGrouped, weekStart, isoWeek, periodOf, periodRange, canStepPeriod, stepPeriod, periodLabel, dayPoints, buildPoints, defaultLine, aboveCount, spreadGeometry,
  dayLabel, dayLabelYear, GROUP_OVER_DAYS, MAX_CUSTOM_DAYS, dataYears, yearRange, yearPoints, yearSummary, clampYear
} from '../src/v3/explore/series.js';
import { hourlyFromTelemetry, colomboClock } from '../src/v3/explore/hourly.js';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { StatsBody } from '../src/v3/explore/StatsBody.jsx';

const B = { min: '2035-01-01', max: '2036-09-14' };

describe('ranges', () => {
  it('weeks run Monday to Sunday and are numbered the ISO way', () => {
    expect(weekStart('2026-11-01')).toBe('2026-10-26'); // a Sunday belongs to the week that began on Monday
    expect(weekStart('2026-10-26')).toBe('2026-10-26');
    expect(isoWeek('2026-10-27')).toEqual({ year: 2026, week: 44 });
    expect(isoWeek('2026-01-01')).toEqual({ year: 2026, week: 1 }); // Thursday 1 Jan: week 1
    expect(isoWeek('2027-01-01')).toEqual({ year: 2026, week: 53 }); // Friday 1 Jan 2027 is still 2026's last week
    expect(isoWeek('2024-12-30')).toEqual({ year: 2025, week: 1 }); // Monday 30 Dec 2024 starts 2025's week 1
  });
  it('a period is the whole calendar week or month; what is asked for is the part with data', () => {
    expect(periodOf('week', '2026-10-29')).toEqual({ from: '2026-10-26', to: '2026-11-01' });
    expect(periodOf('month', '2024-02-10')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(() => periodOf('decade', '2026-10-29')).toThrow(RangeError);
    const now = periodRange('month', '2036-09-14', B);
    expect(now).toEqual({ from: '2036-09-01', to: '2036-09-14', full: { from: '2036-09-01', to: '2036-09-30' } }); // so far
    expect(periodRange('week', '2036-12-31', B).to).toBe('2036-09-14'); // never past the data
    expect(periodRange('week', '2035-01-03', { min: '2035-01-02', max: B.max })).toMatchObject({ from: '2035-01-02', to: '2035-01-07', full: { from: '2035-01-01', to: '2035-01-07' } }); // records begin on a Tuesday
  });
  it('labels: "Week 44 · 2026", "November 2026"', () => {
    expect(periodLabel('week', periodRange('week', '2026-10-29', { max: '2026-11-02' }))).toBe('Week 44 · 2026');
    expect(periodLabel('month', periodRange('month', '2026-11-02', { max: '2026-11-02' }))).toBe('November 2026');
    expect(periodLabel('week', null)).toBe('');
  });
  it('steps a whole week or month and stops at the ends of the data', () => {
    const wk = periodRange('week', '2036-09-14', B); // Mon 8 to Sun 14 Sep
    expect(stepPeriod('week', wk, -1)).toBe('2036-09-01');
    expect(canStepPeriod(wk, 1, B)).toBe(false);
    expect(canStepPeriod(wk, -1, B)).toBe(true);
    const first = periodRange('week', '2035-01-03', B);
    expect(canStepPeriod(first, -1, B)).toBe(false);
    const jan = periodRange('month', '2036-01-20', B);
    expect(stepPeriod('month', jan, -1)).toBe('2035-12-01');
    expect(stepPeriod('month', jan, 1)).toBe('2036-02-01');
    expect(canStepPeriod(periodRange('month', '2035-01-20', B), -1, B)).toBe(false);
  });
  it('a week always shows Monday to Sunday; days with no reading are null and say why', () => {
    const wk = periodOf('week', '2036-09-10'); // Mon 8 to Sun 14
    const pts = dayPoints([{ date: '2036-09-08', kwh: 120 }, { date: '2036-09-09', kwh: null }], wk, { min: '2035-01-01', max: '2036-09-10' });
    expect(pts.map((p) => p.label)).toEqual(['Mon 8', 'Tue 9', 'Wed 10', 'Thu 11', 'Fri 12', 'Sat 13', 'Sun 14']);
    expect(pts[0]).toMatchObject({ kwh: 120, present: 1, full: 'Mon 8 Sep 2036' });
    expect(pts[1]).toMatchObject({ kwh: null, why: 'No data recorded' });
    expect(pts[2]).toMatchObject({ kwh: null, why: 'No data recorded' });
    expect(pts[3]).toMatchObject({ kwh: null, why: 'Not yet' });
    expect(dayPoints([], periodOf('month', '2036-09-10'), B)).toHaveLength(30);
    expect(dayPoints([], periodOf('week', '2034-12-31'), B)[0].why).toBe('Before records began');
  });
  it('custom ranges are ordered, clipped to the data and capped', () => {
    expect(customRange('2036-08-15', '2036-07-01', B)).toEqual({ from: '2036-07-01', to: '2036-08-15' });
    expect(customRange('2034-01-01', '2036-12-31', B)).toEqual({ from: '2035-09-15', to: '2036-09-14' });
    const c = customRange('2035-01-01', '2036-09-14', B);
    expect(c.to).toBe('2036-09-14');
    expect(c.from).toBe('2035-09-15');
    expect(MAX_CUSTOM_DAYS).toBe(366);
  });
  it('groups only long ranges', () => {
    expect(isGrouped({ from: '2036-08-16', to: '2036-09-14' })).toBe(false);
    expect(isGrouped({ from: '2036-07-14', to: '2036-09-14' })).toBe(true);
    expect(GROUP_OVER_DAYS).toBe(62);
  });
  it('labels days', () => {
    expect(dayLabel('2036-09-06')).toBe('6 Sep');
    expect(dayLabelYear('2036-09-06')).toBe('6 Sep 2036');
  });
});

describe('points', () => {
  const week = [
    { date: '2036-09-08', kwh: 120 }, { date: '2036-09-09', kwh: null }, { date: '2036-09-10', kwh: 0 }
  ];
  it('keeps a missing day null and a measured zero as 0', () => {
    const p = buildPoints(week, false);
    expect(p.map((x) => x.kwh)).toEqual([120, null, 0]);
    expect(p.map((x) => x.present)).toEqual([1, 0, 1]);
    expect(p[0].label).toBe('8 Sep');
  });
  it('thins the day labels on a long daily range', () => {
    const days = Array.from({ length: 30 }, (_, i) => ({ date: `2036-08-${String(i + 1).padStart(2, '0')}`, kwh: 100 }));
    const p = buildPoints(days, false);
    expect(p.filter((x) => x.label).map((x) => x.label)).toEqual(['1', '5', '10', '15', '20', '25', '30']);
  });
  it('groups by month over the days that have data, and says how many', () => {
    const series = [
      { date: '2036-07-30', kwh: 100 }, { date: '2036-07-31', kwh: null },
      { date: '2036-08-01', kwh: 50 }, { date: '2036-08-02', kwh: 70 }
    ];
    const p = buildPoints(series, true);
    expect(p).toHaveLength(2);
    expect(p[0]).toMatchObject({ label: 'Jul', kwh: 100, present: 1, total: 2 });
    expect(p[0].full).toBe('Jul 2036 (1/2 days)');
    expect(p[1]).toMatchObject({ label: 'Aug', kwh: 120, present: 2, total: 2, full: 'Aug 2036' });
  });
  it('a month with no readings at all is null, not 0', () => {
    expect(buildPoints([{ date: '2036-07-01', kwh: null }], true)[0].kwh).toBeNull();
  });
});

describe('Mark above', () => {
  const pts = [100, 120, 140, null, 160].map((kwh, i) => ({ key: String(i), kwh }));
  it('defaults to the median, rounded', () => {
    expect(defaultLine(pts, false)).toBe(130);
    expect(defaultLine([{ kwh: 4180 }, { kwh: 4020 }, { kwh: 3900 }], true)).toBe(4000);
    expect(defaultLine([{ kwh: null }], false)).toBe(0);
  });
  it('counts only known values', () => {
    expect(aboveCount(pts, 130)).toEqual({ above: 2, known: 4 });
    expect(aboveCount([{ kwh: null }], 0)).toEqual({ above: 0, known: 0 });
  });
});

describe('statistics chart geometry', () => {
  const series = [{ date: 'a', kwh: 100 }, { date: 'b', kwh: null }, { date: 'c', kwh: 200 }, { date: 'd', kwh: 150 }];
  it('puts best and lowest on their days and skips unknown days', () => {
    const g = spreadGeometry(series, { date: 'c', kwh: 200 }, { date: 'a', kwh: 100 }, 150);
    expect(g.points[1]).toBeNull();
    expect(g.best.x).toBeCloseTo((2 / 3) * 100, 6);
    expect(g.worst.x).toBe(0);
    expect(g.best.y).toBeLessThan(g.worst.y);
    expect(g.avgY).toBeGreaterThan(g.best.y);
    expect(g.avgY).toBeLessThan(g.worst.y);
  });
  it('marks the lowest full day while the lowest recorded day still sets the scale', () => {
    const g = spreadGeometry(series, { date: 'c', kwh: 200 }, { date: 'a', kwh: 100 }, 150, { date: 'd', kwh: 150 });
    expect(g.low.x).toBe(100);
    expect(g.low.y).toBeLessThan(g.worst.y);
    expect(g.worst.y).toBeLessThanOrEqual(100); // the outage day stays on the chart
    expect(spreadGeometry(series, { date: 'c', kwh: 200 }, { date: 'a', kwh: 100 }, 150, null).low).toBeNull();
  });
  it('is null when there is nothing to draw', () => {
    expect(spreadGeometry([{ date: 'a', kwh: null }], null, null, null)).toBeNull();
  });
});

describe('hourly generation from telemetry', () => {
  // 08:00 Colombo = 02:30Z
  const pt = (hhmm, kw) => ({ ts: `2036-09-10T${hhmm}:00.000Z`, pac_kw: kw });
  it('integrates power into kWh per local hour', () => {
    const points = [pt('02:30', 12), pt('02:35', 12), pt('02:40', 12), pt('02:45', 12), pt('02:50', 12), pt('02:55', 12), pt('03:00', 24)];
    const out = hourlyFromTelemetry(points);
    // 02:30Z..02:55Z = 08:00..08:25 local, six points of 5 minutes at 12 kW = 6 kWh; 03:00Z = 08:30 at 24 kW for 5 min = 2 kWh
    expect(out.hours.find((h) => h.hour === 8).kwh).toBe(8);
    expect(out.peak).toEqual({ kw: 24, at: '08:30' });
    expect(out.totalKwh).toBe(8);
    expect(out.hours).toHaveLength(15);
    expect(out.hours[0].hour).toBe(5);
    expect(out.hours[14].hour).toBe(19);
  });
  it('does not stretch one reading across a data hole', () => {
    const out = hourlyFromTelemetry([pt('02:30', 60), pt('04:30', 60)]);
    // first point: 10 minutes at most (60 kW => 10 kWh); the last point counts 5 minutes (5 kWh)
    expect(out.totalKwh).toBe(15);
  });
  it('no points, or no readable power, is no data (null), not a flat zero day', () => {
    expect(hourlyFromTelemetry([])).toBeNull();
    expect(hourlyFromTelemetry(undefined)).toBeNull();
    expect(hourlyFromTelemetry([pt('02:30', null)])).toBeNull();
    expect(hourlyFromTelemetry([{ ts: 'garbage', pac_kw: 5 }])).toBeNull();
  });
  it('ignores power outside the daylight window but still can be the peak', () => {
    const out = hourlyFromTelemetry([{ ts: '2036-09-10T23:00:00.000Z', pac_kw: 1 }]); // 04:30 local
    expect(out.totalKwh).toBe(0);
    expect(out.peak).toEqual({ kw: 1, at: '04:30' });
  });
  it('colomboClock converts UTC to UTC+5:30', () => {
    expect(colomboClock('2036-09-10T02:30:00Z')).toEqual({ hour: 8, hhmm: '08:00' });
    expect(colomboClock('2036-09-10T20:00:00Z')).toEqual({ hour: 1, hhmm: '01:30' });
  });
});

import { smoothPath } from '../src/v3/charts/scale.js';

describe('smooth curve', () => {
  it('passes through every point and keeps control points inside the plot', () => {
    const d = smoothPath([[0, 100], [50, 0], [100, 100]]);
    expect(d.startsWith('M 0.00 100.00')).toBe(true);
    expect(d).toContain('50.00 0.00');
    expect(d.endsWith('100.00 100.00')).toBe(true);
    const nums = d.replace(/[MC]/g, '').trim().split(/\s+/).map(Number);
    expect(Math.min(...nums)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...nums)).toBeLessThanOrEqual(100);
  });
  it('degrades to a straight line for two points and empty for none', () => {
    expect(smoothPath([[0, 10], [100, 20]])).toBe('M 0.00 10.00 L 100.00 20.00');
    expect(smoothPath([])).toBe('');
  });
});

import { statsRange, STATS_PERIODS } from '../src/v3/explore/series.js';

describe('statistics periods', () => {
  const b = { min: '2024-08-02', max: '2026-10-03' };
  it('last 30 and 365 days end on the newest day with data; lifetime starts at the first record', () => {
    expect(STATS_PERIODS.map((p) => p.value)).toEqual(['30', '365', 'life']);
    expect(statsRange('30', b)).toEqual({ from: '2026-09-04', to: '2026-10-03' });
    expect(statsRange('365', b)).toEqual({ from: '2025-10-04', to: '2026-10-03' });
    expect(statsRange('life', b)).toEqual({ from: '2024-08-02', to: '2026-10-03' });
  });
  it('never starts before the data, and is null until the data bounds are known', () => {
    expect(statsRange('365', { min: '2026-06-01', max: '2026-10-03' })).toEqual({ from: '2026-06-01', to: '2026-10-03' });
    expect(statsRange('30', { min: null, max: null })).toBeNull();
    expect(statsRange('life', { min: null, max: '2026-10-03' })).toEqual({ from: '2026-10-03', to: '2026-10-03' });
  });
});

import { powerCurve, nearestPoint, xOfMinute, clockOf, DAY_START_MIN, DAY_END_MIN, GAP_MIN } from '../src/v3/explore/power.js';

describe('power through the day (5-minute kW, as SolisCloud draws it)', () => {
  // 2026-11-02 in Colombo; 04:30Z = 10:00 local
  const at = (hhmmZ, kw) => ({ ts: `2026-11-02T${hhmmZ}:00Z`, pac_kw: kw });

  it('keeps every reading, in Colombo time, marks the peak, and drops night and unknown values', () => {
    const c = powerCurve([at('04:35', 18), at('04:30', 12), at('04:40', 29.04), at('04:45', null), at('20:00', 0)]);
    expect(c.pts.map((p) => p.at)).toEqual(['10:00', '10:05', '10:10']); // sorted; null and 01:30 local dropped
    expect(c.peak).toEqual({ kw: 29, min: 610, at: '10:10' });
    expect(c.last).toMatchObject({ at: '10:10', live: false });
  });

  it('a hole in the readings breaks the line instead of drawing through it', () => {
    const c = powerCurve([at('04:30', 10), at('04:35', 11), at('05:30', 15), at('05:35', 16)]);
    expect(c.segments).toEqual([[0, 1], [2, 3]]);
    expect(GAP_MIN).toBe(15);
  });

  it("adds today's live reading as the newest point, and only when it is newer", () => {
    const pts = [at('04:30', 10), at('04:35', 11)];
    const now = { kw: 14.2, tsMs: Date.parse('2026-11-02T04:41:00Z') };
    const c = powerCurve(pts, now);
    expect(c.last).toMatchObject({ kw: 14.2, at: '10:11', live: true });
    expect(c.peak.kw).toBe(14.2); // "peak so far" includes the live reading
    expect(powerCurve(pts, { kw: 99, tsMs: Date.parse('2026-11-02T04:31:00Z') }).pts).toHaveLength(2);
    expect(powerCurve([], now).pts).toHaveLength(1);
    expect(powerCurve([])).toBeNull();
    expect(powerCurve(null)).toBeNull();
  });

  it('hover snaps to the closest reading; the axis runs 05:00 to 20:00', () => {
    const c = powerCurve([at('04:30', 10), at('04:35', 11), at('04:40', 12)]);
    expect(nearestPoint(c.pts, 602).at).toBe('10:00');
    expect(nearestPoint(c.pts, 603).at).toBe('10:05');
    expect(nearestPoint(c.pts, 2000).at).toBe('10:10');
    expect(nearestPoint([], 600)).toBeNull();
    expect([xOfMinute(DAY_START_MIN), xOfMinute(DAY_END_MIN)]).toEqual([0, 100]);
    expect(clockOf(719.6)).toBe('12:00');
  });
});

import { intervalLabel, dayCurve, liveNow } from '../src/v3/explore/power.js';

describe('day curve: the real reading interval and the shared peak', () => {
  const at = (hhmmZ, kw) => ({ ts: `2026-11-03T${hhmmZ}:00Z`, pac_kw: kw });

  it('the caption states how often readings actually arrive', () => {
    const minutely = powerCurve([at('04:30', 10), at('04:31', 11), at('04:32', 12), at('04:37', 13)]);
    expect(minutely.stepMin).toBe(1);
    expect(intervalLabel(minutely.stepMin)).toBe('power every minute');
    const fiveMin = powerCurve([at('04:30', 10), at('04:35', 11), at('04:40', 12)]);
    expect(intervalLabel(fiveMin.stepMin)).toBe('power every 5 minutes');
    expect(intervalLabel(powerCurve([at('04:30', 10)]).stepMin)).toBe('power readings');
  });

  it("today's curve adds the current live reading; another day, a stale reading or no reading adds nothing", () => {
    const live = { currentPowerKw: 35.9, dataTimestamp: Date.parse('2026-11-03T04:45:00Z') };
    expect(liveNow(live, '2026-11-03', '2026-11-03')).toEqual({ kw: 35.9, tsMs: live.dataTimestamp });
    expect(liveNow(live, '2026-11-02', '2026-11-03')).toBeNull();
    expect(liveNow({ ...live, stale: true }, '2026-11-03', '2026-11-03')).toBeNull();
    expect(liveNow({ ...live, currentPowerKw: null }, '2026-11-03', '2026-11-03')).toBeNull();
    // the Today tile and the chart call the same function, so they report the same peak
    expect(dayCurve([at('04:30', 30), at('04:31', 35.5)], live, '2026-11-03', '2026-11-03').peak).toEqual({ kw: 35.9, min: 615, at: '10:15' });
  });
});

describe('calendar year view', () => {
  const R = { min: '2024-08-02', max: '2026-11-02' };
  const days = (from, to, kwh = 100) => {
    const out = [];
    for (let d = new Date(`${from}T00:00:00Z`); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) out.push({ date: d.toISOString().slice(0, 10), kwh });
    return out;
  };

  it('offers every year that has data, and a year runs 1 Jan to 31 Dec cut to the data', () => {
    expect(dataYears(R)).toEqual([2024, 2025, 2026]);
    expect(dataYears({ min: null, max: null })).toEqual([]);
    expect(yearRange(2025, R)).toEqual({ from: '2025-01-01', to: '2025-12-31' });
    expect(yearRange(2024, R)).toEqual({ from: '2024-08-02', to: '2024-12-31' }); // records began in August
    expect(yearRange(2026, R)).toEqual({ from: '2026-01-01', to: '2026-11-02' }); // so far
  });

  it('never goes past the data: a year before the first or after the last is not offered or drawn', () => {
    expect(clampYear(2023, R)).toBe(2024);
    expect(clampYear(2027, R)).toBe(2026);
    expect(clampYear(2025, R)).toBe(2025);
    expect(clampYear(null, R)).toBe(2026); // not chosen: the newest year
    expect(clampYear(2025.5, R)).toBe(2026);
    expect(clampYear(2025, { min: null, max: null })).toBeNull(); // no data, no year
    expect(() => yearRange(2023, R)).toThrow(RangeError); // would otherwise show 2 Aug 2024 labelled 2023
    expect(() => yearRange(2027, R)).toThrow(RangeError);
  });

  it('always draws twelve months; months without readings are null and say why, partial months say how many days', () => {
    const pts = yearPoints(days('2026-01-01', '2026-11-02'), 2026, R);
    expect(pts.map((p) => p.label)).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
    expect(pts[0]).toMatchObject({ key: '2026-01', kwh: 3100, present: 31, total: 31, full: 'Jan 2026' });
    expect(pts[10]).toMatchObject({ key: '2026-11', kwh: 200, present: 2, total: 30, full: 'Nov 2026 (2/30 days)' });
    expect(pts[11]).toMatchObject({ key: '2026-12', kwh: null, present: 0, why: 'Not yet' });

    const first = yearPoints(days('2024-08-02', '2024-12-31'), 2024, R);
    expect(first[0]).toMatchObject({ kwh: null, why: 'Before records began' });
    expect(first[7]).toMatchObject({ key: '2024-08', present: 30, total: 31 });

    const gap = yearPoints(days('2025-01-01', '2025-12-31').map((d) => (d.date.startsWith('2025-03') ? { ...d, kwh: null } : d)), 2025, R);
    expect(gap[2]).toMatchObject({ kwh: null, why: 'No data recorded' }); // a missing month is never 0
  });

  it('totals the year over recorded days only', () => {
    const r = yearRange(2026, R);
    const s = yearSummary(yearPoints(days(r.from, r.to), 2026, R), r);
    expect(s).toEqual({ kwh: 30600, present: 306, days: 306 });
    expect(yearSummary(yearPoints([], 2026, R), r)).toEqual({ kwh: null, present: 0, days: 306 });
  });
});

describe('statistics card', () => {
  const series = [{ date: '2026-10-19', kwh: 120 }, { date: '2026-10-20', kwh: 11.5 }, { date: '2026-10-21', kwh: 95 }];
  const base = { avgPerDayKwh: 75.5, presentDays: 3, series, best: { date: '2026-10-19', kwh: 120 }, worst: { date: '2026-10-20', kwh: 11.5 } };
  it('shows the lowest full day and how many days were left out, not the outage day', () => {
    const html = renderToString(h(StatsBody, { showHead: true, stats: { ...base, lowestFull: { day: { date: '2026-10-21', kwh: 95 }, fullDays: 2, stoppedDays: 1, unknownDays: 0 } }, loading: false, rangeText: '' }));
    expect(html).toContain('Lowest full day');
    expect(html).toContain('95.0');
    expect(html).toContain('21 Oct 2026 · 1 day left out');
    expect(html).not.toContain('>11.5<');
  });
  it('says so when no day in the range was full', () => {
    const html = renderToString(h(StatsBody, { showHead: true, stats: { ...base, lowestFull: { day: null, fullDays: 0, stoppedDays: 3, unknownDays: 0 } }, loading: false, rangeText: '' }));
    expect(html).toContain('no full day in this range');
  });
});
