// tests/v3Explore.test.js
//
// Pure logic for generation over time (series.js) and the hour-by-hour day (hourly.js).
// Rules under test: unknown days are null and never 0 (LR-003); ranges stay inside the data;
// long ranges group by month over the days that have a reading.

import { describe, it, expect } from 'vitest';
import {
  presetRange, customRange, stepRange, canStep, isGrouped, buildPoints, defaultLine, aboveCount, spreadGeometry,
  dayLabel, dayLabelYear, GROUP_OVER_DAYS, MAX_CUSTOM_DAYS
} from '../src/v3/explore/series.js';
import { hourlyFromTelemetry, colomboClock } from '../src/v3/explore/hourly.js';

const B = { min: '2035-01-01', max: '2036-09-14' };

describe('ranges', () => {
  it('presets end on the chosen day and span their length', () => {
    expect(presetRange('week', '2036-09-14', B)).toEqual({ from: '2036-09-08', to: '2036-09-14' });
    expect(presetRange('month', '2036-09-14', B)).toEqual({ from: '2036-08-16', to: '2036-09-14' });
    expect(presetRange('year', '2036-09-14', B)).toEqual({ from: '2035-09-16', to: '2036-09-14' });
  });
  it('stay inside the data: never past the last day, never before the first', () => {
    expect(presetRange('week', '2036-12-31', B).to).toBe('2036-09-14');
    expect(presetRange('week', '2035-01-03', B)).toEqual({ from: '2035-01-01', to: '2035-01-03' });
    expect(() => presetRange('decade', '2036-09-14')).toThrow(RangeError);
  });
  it('steps back and forward by their own length and stops at the ends', () => {
    const r = presetRange('week', '2036-09-14', B);
    expect(stepRange('week', r, -1, B)).toEqual({ from: '2036-09-01', to: '2036-09-07' });
    expect(stepRange('week', r, 1, B)).toEqual(r);
    const first = presetRange('week', '2035-01-07', B);
    expect(canStep('week', first, -1, B)).toBe(false);
    expect(canStep('week', first, 1, B)).toBe(true);
    expect(canStep('week', r, 1, B)).toBe(false);
    expect(canStep('custom', r, -1, B)).toBe(false);
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
