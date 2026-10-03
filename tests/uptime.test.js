// tests/uptime.test.js
//
// LR-002 (docs/logic-registry/LR-002-inverter-uptime-and-interruptions.md): this file is the
// spec's acceptance criteria, executable, plus a replay of two real days from the live probe.
//
// Key semantics under test:
//   * night is never downtime
//   * a gap is down only if the logger was alive; if the logger was silent too it is "unknown"
//   * alarms are authoritative for trips (a grid under-voltage trip leaves NO gap in the points)
//   * null ≠ 0: no evidence → uptimePct null, never 0

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { deriveDayUptime, aggregateUptime, causeForAlarmCode } from '../shared/domain/uptime.js';
import { operatingWindow } from '../shared/domain/time.js';
import { normalizeDayPoints, normalizeAlarms, normalizeCollectorPoints } from '../shared/domain/solisNormalize.js';

const D = '2026-10-02';
const MIN = 60_000;
const win = operatingWindow(D);
const W = win.minutes;

/** Points every `stepMin` from window start+offset to window end−offset (inclusive). */
function pointsEvery(stepMin, { fromMin = 0, toMin = W } = {}) {
  const out = [];
  for (let m = fromMin; m <= toMin; m += stepMin) out.push({ ts: win.startMs + m * MIN });
  return out;
}
const without = (points, fromMin, toMin) =>
  points.filter((p) => {
    const m = (p.ts - win.startMs) / MIN;
    return !(m > fromMin && m < toMin);
  });
const alarm = (fromMin, toMin, code = '1011') => ({
  code, beginMs: win.startMs + fromMin * MIN, endMs: win.startMs + toMin * MIN, open: false,
  durationMs: (toMin - fromMin) * MIN, level: 1, state: 2
});
const loggerEvery = (stepMin) => pointsEvery(stepMin, { fromMin: -60, toMin: W + 60 });

describe('LR-002 acceptance criteria', () => {
  it('1. continuous points, no alarms → 100% and no down segments', () => {
    const r = deriveDayUptime({ dateKey: D, points: pointsEvery(5), alarms: [] });
    expect(r.status).toBe('ok');
    expect(r.uptimePct).toBe(100);
    expect(r.segments).toEqual([]);
    expect(r.minutes.trip + r.minutes.gap).toBe(0);
    expect(r.cadenceMin).toBe(5);
    expect(r.resolutionMin).toBe(15);
  });

  it('2. a 40-minute interior gap with a reporting logger → a gap of (40 − cadence) minutes', () => {
    const pts = without(pointsEvery(5), 100, 140); // last point 100, next 140
    const r = deriveDayUptime({ dateKey: D, points: pts, alarms: [], collector: loggerEvery(5) });
    const gaps = r.segments.filter((s) => s.kind === 'gap');
    expect(gaps).toHaveLength(1);
    expect(r.minutes.gap).toBeCloseTo(35, 6);
    expect(gaps[0].startMs).toBe(win.startMs + 105 * MIN);
    expect(gaps[0].endMs).toBe(win.startMs + 140 * MIN);
    expect(r.uptimePct).toBeCloseTo(((W - 35) / W) * 100, 6);
  });

  it('3. the same gap with a silent logger → comms_lost, excluded from the percentage', () => {
    const pts = without(pointsEvery(5), 100, 140);
    const logger = without(loggerEvery(5), 102, 138);
    const r = deriveDayUptime({ dateKey: D, points: pts, alarms: [], collector: logger });
    expect(r.segments.map((s) => s.kind)).toEqual(['comms_lost']);
    expect(r.minutes.comms_lost).toBeCloseTo(35, 6);
    expect(r.minutes.gap).toBe(0);
    expect(r.uptimePct).toBe(100); // nothing known to be down in the remaining time
  });

  it('3a. a heartbeat at the recovery edge does not prove the logger was alive during the gap', () => {
    const pts = without(pointsEvery(5), 100, 190); // 90-minute silence: last point 100, next 190
    const logger = [...without(loggerEvery(5), 102, 188), { ts: win.startMs + 188 * MIN }]; // lone beat 2 min before recovery
    const r = deriveDayUptime({ dateKey: D, points: pts, alarms: [], collector: logger });
    expect(r.segments.map((s) => s.kind)).toEqual(['comms_lost']);
  });

  it('3b. with no logger data at all the gap is still reported, flagged as lacking logger evidence', () => {
    const pts = without(pointsEvery(5), 100, 140);
    const r = deriveDayUptime({ dateKey: D, points: pts, alarms: [] });
    const gap = r.segments.find((s) => s.kind === 'gap');
    expect(gap.loggerEvidence).toBe(false);
    expect(r.loggerKnown).toBe(false);
  });

  it('4. a 5-minute 1011 alarm with no gap → one trip, cause grid_undervoltage', () => {
    const r = deriveDayUptime({ dateKey: D, points: pointsEvery(5), alarms: [alarm(200, 205)] });
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0]).toMatchObject({ kind: 'trip', cause: 'grid_undervoltage', alarmCode: '1011' });
    expect(r.minutes.trip).toBeCloseTo(5, 6);
    expect(r.tripCount).toBe(1);
    expect(r.uptimePct).toBeCloseTo(((W - 5) / W) * 100, 6);
  });

  it('5. a late start with no alarm → edge_gap, not down', () => {
    const pts = pointsEvery(5, { fromMin: 90 });
    const r = deriveDayUptime({ dateKey: D, points: pts, alarms: [] });
    expect(r.segments.map((s) => s.kind)).toEqual(['edge_gap']);
    expect(r.minutes.edge_gap).toBeCloseTo(90, 6);
    expect(r.uptimePct).toBe(100);
  });

  it('5b. an early stop is an edge_gap too', () => {
    const pts = pointsEvery(5, { toMin: W - 90 });
    const r = deriveDayUptime({ dateKey: D, points: pts, alarms: [] });
    const edge = r.segments.filter((s) => s.kind === 'edge_gap');
    expect(edge).toHaveLength(1);
    expect(r.uptimePct).toBe(100);
  });

  it('6. overlapping alarms are counted once', () => {
    const r = deriveDayUptime({
      dateKey: D, points: pointsEvery(5), alarms: [alarm(100, 120), alarm(110, 130)]
    });
    expect(r.minutes.trip).toBeCloseTo(30, 6);
    expect(r.tripCount).toBe(1);
  });

  it('7. no points and no logger evidence → no_data, uptimePct null (never 0)', () => {
    const r = deriveDayUptime({ dateKey: D, points: [], alarms: [] });
    expect(r.status).toBe('no_data');
    expect(r.uptimePct).toBeNull();
    expect(r.segments).toEqual([]);
  });

  it('8. no inverter points but the logger was reporting → down, uptimePct 0 (measured)', () => {
    const r = deriveDayUptime({ dateKey: D, points: [], alarms: [], collector: loggerEvery(5) });
    expect(r.status).toBe('down');
    expect(r.uptimePct).toBe(0);
    expect(r.minutes.gap).toBeCloseTo(W, 6);
  });

  it('9. alarms = null → alarmsKnown false, and no trips are asserted', () => {
    const r = deriveDayUptime({ dateKey: D, points: pointsEvery(5), alarms: null });
    expect(r.alarmsKnown).toBe(false);
    expect(r.tripCount).toBe(0);
    expect(deriveDayUptime({ dateKey: D, points: pointsEvery(5), alarms: [] }).alarmsKnown).toBe(true);
  });

  it('10. night points never create segments', () => {
    const night = [{ ts: win.startMs - 5 * 3_600_000 }, { ts: win.endMs + 3 * 3_600_000 }];
    const r = deriveDayUptime({ dateKey: D, points: [...night, ...pointsEvery(5)], alarms: [] });
    expect(r.segments).toEqual([]);
    expect(r.uptimePct).toBe(100);
    expect(r.pointCount).toBe(pointsEvery(5).length + 2);
  });

  it('10b. an alarm entirely at night is ignored', () => {
    const r = deriveDayUptime({
      dateKey: D, points: pointsEvery(5),
      alarms: [{ ...alarm(0, 5), beginMs: win.startMs - 3 * 3_600_000, endMs: win.startMs - 3 * 3_600_000 + 5 * MIN }]
    });
    expect(r.tripCount).toBe(0);
  });

  it('11. range aggregation weights by known minutes and skips no_data days', () => {
    const a = deriveDayUptime({ dateKey: D, points: pointsEvery(5), alarms: [alarm(100, 140)] }); // 40 down
    const b = deriveDayUptime({ dateKey: D, points: pointsEvery(5), alarms: [] }); // 0 down
    const c = deriveDayUptime({ dateKey: D, points: [], alarms: [] }); // no data
    const agg = aggregateUptime([a, b, c]);
    expect(agg.daysNoData).toBe(1);
    expect(agg.daysCounted).toBe(2);
    expect(agg.downMinutes).toBeCloseTo(40, 6);
    expect(agg.uptimePct).toBeCloseTo(((2 * W - 40) / (2 * W)) * 100, 6);
    expect(aggregateUptime([c]).uptimePct).toBeNull();
    expect(aggregateUptime([]).uptimePct).toBeNull();
  });
});

describe('cause classification', () => {
  it('maps Solis grid codes and falls back to fault', () => {
    expect(causeForAlarmCode('1011')).toBe('grid_undervoltage');
    expect(causeForAlarmCode(1010)).toBe('grid_overvoltage');
    expect(causeForAlarmCode('2002')).toBe('fault');
    expect(causeForAlarmCode(null)).toBe('fault');
  });
});

describe('open alarms', () => {
  it('runs an open alarm to min(now, window end)', () => {
    const open = { code: '1011', beginMs: win.startMs + 100 * MIN, endMs: null, open: true, state: 0 };
    const now = win.startMs + 130 * MIN;
    const r = deriveDayUptime({ dateKey: D, points: pointsEvery(5), alarms: [open], now });
    expect(r.minutes.trip).toBeCloseTo(30, 6);
  });
});

describe('low-confidence cadence', () => {
  it('falls back to 5 min and says so when there are too few points', () => {
    const r = deriveDayUptime({ dateKey: D, points: pointsEvery(100), alarms: [] });
    expect(r.cadenceMin).toBe(5);
    expect(r.lowConfidence).toBe(true);
  });
});

describe('replay of real probe days', () => {
  const load = (f) => JSON.parse(readFileSync(new URL(`./fixtures/solis/${f}`, import.meta.url), 'utf8'));

  it('2026-10-02: 146 points at 5 min, four 1011 trips, no gaps', () => {
    const fx = load('day-2026-10-02.json');
    const { points } = normalizeDayPoints(fx.points);
    const alarms = normalizeAlarms(fx.alarms);
    const collector = normalizeCollectorPoints(fx.collector);
    const r = deriveDayUptime({ dateKey: fx.date, points, alarms, collector });

    expect(r.pointCount).toBe(146);
    expect(r.cadenceMin).toBe(5);
    expect(r.minutes.gap).toBe(0);
    expect(r.minutes.comms_lost).toBe(0);
    // 05:54–05:59 lies before the window opens; the other three overlap it.
    expect(r.tripCount).toBeGreaterThanOrEqual(3);
    expect(r.tripCount).toBeLessThanOrEqual(4);
    expect(r.minutes.trip).toBeGreaterThan(15);
    expect(r.minutes.trip).toBeLessThan(21);
    expect(r.uptimePct).toBeGreaterThan(96.5);
    expect(r.uptimePct).toBeLessThan(98);
    expect(r.segments.every((s) => s.kind === 'trip' && s.cause === 'grid_undervoltage')).toBe(true);
  });

  it('2025-10-03: a coarse ~18-minute cadence is reported as coarse resolution, not as perfect uptime', () => {
    const fx = load('day-2025-10-03-coarse.json');
    const { points } = normalizeDayPoints(fx.points);
    const r = deriveDayUptime({ dateKey: fx.date, points, alarms: [] });

    expect(r.pointCount).toBe(41);
    expect(r.cadenceMin).toBeGreaterThanOrEqual(17);
    expect(r.cadenceMin).toBeLessThanOrEqual(20);
    expect(r.resolutionMin).toBeGreaterThan(50);
    expect(r.resolutionMin).toBeLessThan(62);
    expect(r.lowConfidence).toBe(false);
    expect(r.minutes.gap).toBe(0); // nothing exceeds 3× its own cadence
  });
});
