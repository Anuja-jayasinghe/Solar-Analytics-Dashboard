// tests/v3Pro.test.js
//
// Pro metrics logic (src/v3/pro/metrics.js). Rules: the API's uptime aggregate is the truth; a day with
// no data is not a 0% day; a lost-internet alarm is a logger event, not downtime; unknown is null.

import { describe, it, expect } from 'vitest';
import {
  proRange, lastCompleteMonth, monthWindow, minutesLabel, uptimeTone, healthSummary, stripCell, stripTip, alarmRows, alarmLegend, electricalFromTelemetry, rateSeries, yoyPairs, PRO_RANGES
} from '../src/v3/pro/metrics.js';
import { colomboClock } from '../src/v3/explore/hourly.js';

describe('range and labels', () => {
  it('ends yesterday: today is not a completed day', () => {
    expect(proRange('2036-09-15', 30)).toEqual({ from: '2036-08-16', to: '2036-09-14' });
    expect(proRange('2036-03-01', 14)).toEqual({ from: '2036-02-16', to: '2036-02-29' });
    expect(PRO_RANGES).toEqual([14, 30, 60]);
  });
  it('formats minutes', () => {
    expect(minutesLabel(473)).toBe('7 h 53 m');
    expect(minutesLabel(45)).toBe('45 m');
    expect(minutesLabel(0)).toBe('0 m');
    expect(minutesLabel(null)).toBe('—');
  });
  it('uses completed calendar months, including leap years', () => {
    expect(lastCompleteMonth('2026-10-06')).toBe('2026-09');
    expect(lastCompleteMonth('2026-01-01')).toBe('2025-12');
    expect(monthWindow('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(monthWindow('2025-02')).toEqual({ from: '2025-02-01', to: '2025-02-28' });
    expect(monthWindow('2026-13')).toBeNull();
  });
  it('tones uptime', () => {
    expect(uptimeTone(99.5)).toBe('good');
    expect(uptimeTone(97)).toBe('warn');
    expect(uptimeTone(80)).toBe('bad');
    expect(uptimeTone(null)).toBe('none');
  });
});

describe('health summary', () => {
  const uptime = {
    aggregate: { uptimePct: 98.84, downMinutes: 473, tripCount: 69, daysCounted: 58, daysNoData: 2 },
    days: [{ trip_min: 10, gap_min: 0 }, { trip_min: 0, gap_min: 0 }, { trip_min: 0, gap_min: 5 }]
  };
  const alarms = { alarms: [{ end_ts: null }, { end_ts: '2036-09-01T00:00:00Z' }] };
  const totals = { generation: { dayCount: 618, missingDays: 5, firstDay: '2035-01-01', lastDay: '2036-09-14' } };

  it('takes uptime and downtime from the API aggregate, counts affected days and open alarms', () => {
    const s = healthSummary({ uptime, alarms, totals });
    expect(s.uptimePct).toBe(98.84);
    expect(s.downMinutes).toBe(473);
    expect(s.tripCount).toBe(69);
    expect(s.affectedDays).toBe(2);
    expect(s.totalDays).toBe(3);
    expect(s.openAlarms).toBe(1);
    expect(s.alarmsListed).toBe(2);
    expect(s.dataDays).toBe(618);
    expect(s.completenessPct).toBeCloseTo((618 / 623) * 100, 6);
  });
  it('everything unknown stays null, never 0', () => {
    const s = healthSummary({ uptime: null, alarms: null, totals: null });
    expect(s).toMatchObject({ uptimePct: null, downMinutes: null, tripCount: null, affectedDays: null, openAlarms: null, completenessPct: null });
  });
  it('does not report a partial alarm list as an exact unresolved count', () => {
    const s = healthSummary({ uptime, alarms: { alarms: [{ end_ts: null }], truncated: true }, totals });
    expect(s).toMatchObject({ openAlarms: null, alarmsListed: 1, alarmsTruncated: true });
  });
});

describe('uptime strip', () => {
  it('a no-data day is a grey short cell, never a 0% day', () => {
    const c = stripCell({ day: '2036-09-01', status: 'no_data', uptime_pct: null });
    expect(c).toMatchObject({ pct: null, tone: 'none', height: 24 });
    expect(stripTip(c)).toBe('1 Sep 2036: no uptime data');
  });
  it('maps 90..100% to the cell height and colours by threshold', () => {
    expect(stripCell({ day: 'd', status: 'ok', uptime_pct: 100 }).height).toBe(100);
    expect(stripCell({ day: 'd', status: 'ok', uptime_pct: 90 }).height).toBe(26);
    expect(stripCell({ day: 'd', status: 'ok', uptime_pct: 50 }).height).toBe(26);
    expect(stripCell({ day: 'd', status: 'ok', uptime_pct: 99.2 }).tone).toBe('good');
    expect(stripCell({ day: 'd', status: 'ok', uptime_pct: 96 }).tone).toBe('warn');
    expect(stripCell({ day: 'd', status: 'ok', uptime_pct: 91 }).tone).toBe('bad');
  });
  it('the hint explains trips, gaps and logger time', () => {
    const c = stripCell({ day: '2036-09-02', status: 'ok', uptime_pct: 96.5, trip_min: 25, trip_count: 2, gap_min: 5, comms_lost_min: 70 });
    expect(stripTip(c)).toBe('2 Sep 2036: 96.5% uptime · stopped 25 m (2 trips) · unexplained gap 5 m · logger offline 1 h 10 m');
    expect(stripTip(stripCell({ day: '2036-09-03', status: 'ok', uptime_pct: 99, trip_min: 5, trip_count: 1 }))).toContain('(1 trip)');
  });
});

describe('alarm rows', () => {
  const alarms = {
    alarms: [
      { alarm_code: '1011', begin_ts: '2036-09-10T01:00:00Z', end_ts: '2036-09-10T01:05:00Z', duration_ms: 300000, level: 1, message: 'Grid under-voltage', advice: 'No action' },
      { alarm_code: '1D4C2', begin_ts: '2036-09-12T01:00:00Z', end_ts: '2036-09-12T02:00:00Z', duration_ms: 3600000, level: 2, message: 'Loss of internet connection', advice: 'Check wifi' },
      { alarm_code: '2020', begin_ts: '2036-09-11T01:00:00Z', end_ts: null, duration_ms: null, level: 3, message: 'Overtemperature', advice: '' }
    ]
  };
  it('lists latest first and labels lost-internet as a logger event', () => {
    const rows = alarmRows(alarms);
    expect(rows.map((r) => r.code)).toEqual(['1D4C2', '2020', '1011']);
    expect(rows[0]).toMatchObject({ logger: true, message: 'Lost internet (logger)', length: '60 min', level: 'Medium', tone: 'warn' });
    expect(rows[1]).toMatchObject({ open: true, length: 'open', level: 'High', tone: 'bad' });
    expect(rows[2]).toMatchObject({ logger: false, message: 'Grid under-voltage', length: '5 min', level: 'Low', tone: 'neutral', advice: 'No action' });
  });
  it('limits the rows, tolerates empty input, and never invents a duration', () => {
    expect(alarmRows(alarms, 1)).toHaveLength(1);
    expect(alarmRows(undefined)).toEqual([]);
    expect(alarmRows({ alarms: [{ alarm_code: 'x', begin_ts: 'a', end_ts: 'b', duration_ms: null, level: 9 }] })[0]).toMatchObject({ length: '—', level: 'Low' });
    expect(alarmRows({ alarms: [{ alarm_code: 'y', begin_ts: 'a', end_ts: 'b', duration_ms: 20000 }] })[0].length).toBe('< 1 min');
  });
  it('explains known codes and preserves uncertainty for unknown ones', () => {
    const legend = alarmLegend({ alarms: [{ alarm_code: '1011' }, { alarm_code: '1011' }, { alarm_code: 'F017' }, { alarm_code: 'other' }] });
    expect(legend[0]).toMatchObject({ code: '1011', count: 2, meaning: 'Grid voltage too low' });
    expect(legend.find((item) => item.code === 'F017').explanation).toContain('qualified installer');
    expect(legend.find((item) => item.code === 'OTHER').meaning).toBe('Description from Solis record');
    expect(alarmRows({ alarms: [{ alarm_code: '1011', begin_ts: '2036-09-10T01:00:00Z' }] })[0].meaning).toBe('Grid voltage too low');
  });
});

describe('electrical health from telemetry', () => {
  const colomboHour = (ts) => colomboClock(ts).hour;
  const pt = (hhmmZ, o = {}) => ({ ts: `2036-09-10T${hhmmZ}:00Z`, pac_kw: 20, pv_a: [3.5, 3.5, 2.5, 3.5], pv_v: [550, 550, 550, 550], ac_v: [233, 235, 232], fac_hz: 50.1, power_factor: 1, temp_c: 50, ...o });

  it('shows PV input readings without inferring occupancy or a string fault', () => {
    const e = electricalFromTelemetry([pt('04:00'), pt('04:05')], colomboHour);
    expect(e.pvInputs).toHaveLength(4);
    expect(e.pvInputs[2]).toEqual({ n: 3, amps: 2.5, volts: 550 });
    expect(e).not.toHaveProperty('lowStrings');
    expect(e.acPhaseVolts).toEqual([233, 235, 232]);
    expect(e.acPhaseSpreadVolts).toBe(3);
    expect(e.powerFactor).toBe(1);
  });
  it('keeps separate phase medians and only computes spread when all three are reported', () => {
    const e = electricalFromTelemetry([
      pt('04:00', { ac_v: [220, 230, 245] }),
      pt('04:05', { ac_v: [222, null, 247] }),
      pt('04:10', { ac_v: [224, 234, 249] })
    ], colomboHour);
    expect(e.acPhaseVolts).toEqual([222, 232, 247]);
    expect(e.acPhaseSpreadVolts).toBe(25);
  });
  it('groups temperature (max) and frequency (range) by Colombo hour', () => {
    const e = electricalFromTelemetry([pt('04:00', { temp_c: 50, fac_hz: 50.0 }), pt('04:30', { temp_c: 55, fac_hz: 50.2 }), pt('05:00', { temp_c: 52, fac_hz: 49.9 })], colomboHour);
    expect(e.temperature).toEqual([{ hour: 9, max: 50 }, { hour: 10, max: 55 }]);
    expect(e.frequency).toEqual([{ hour: 9, lo: 50.0, hi: 50.0 }, { hour: 10, lo: 49.9, hi: 50.2 }]);
  });
  it('ignores non-producing points and returns null when there are none', () => {
    expect(electricalFromTelemetry([pt('04:00', { pac_kw: 0.2 })], colomboHour)).toBeNull();
    expect(electricalFromTelemetry([], colomboHour)).toBeNull();
    expect(electricalFromTelemetry(undefined, colomboHour)).toBeNull();
    expect(electricalFromTelemetry([pt('04:00', { pac_kw: null })], colomboHour)).toBeNull();
  });
  it('an input with no current reading is unknown, not 0', () => {
    const e = electricalFromTelemetry([pt('04:00', { pv_a: [3, null, 3, 3] })], colomboHour);
    expect(e.pvInputs[1].amps).toBeNull();
  });
});

describe('rates and year over year', () => {
  it('orders bill rates oldest first and drops bills without a rate', () => {
    const out = rateSeries({ bills: [{ billDate: '2036-02-03', effectiveRatePerKwh: 44 }, { billDate: '2035-02-03', effectiveRatePerKwh: 40 }, { billDate: '2035-03-03', effectiveRatePerKwh: null }] });
    expect(out.map((r) => r.rate)).toEqual([40, 44]);
    expect(rateSeries(undefined)).toEqual([]);
  });
  it('pairs the same generation month across years, complete finalized bills only', () => {
    const r = (label, year, inv, o = {}) => ({ label, year, inverterKwh: inv, status: 'finalized', complete: true, ...o });
    const pairs = yoyPairs([r('Mar', 2035, 3500), r('Mar', 2036, 3850), r('Apr', 2035, 3600), r('Apr', 2036, 3000, { complete: false }), r('May', 2036, 4000)]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ label: 'Mar', year: 2036, prev: 3500, cur: 3850 });
    expect(pairs[0].deltaPct).toBeCloseTo(10, 6);
    expect(yoyPairs([])).toEqual([]);
  });
  it('keeps only the latest pairs', () => {
    const rows = [];
    for (const m of ['Jan', 'Feb', 'Mar', 'Apr']) { rows.push({ label: m, year: 2035, inverterKwh: 100, status: 'finalized', complete: true }); rows.push({ label: m, year: 2036, inverterKwh: 110, status: 'finalized', complete: true }); }
    expect(yoyPairs(rows, 2).map((p) => p.label)).toEqual(['Mar', 'Apr']);
  });
});
