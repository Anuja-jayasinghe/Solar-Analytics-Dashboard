// tests/solisNormalize.test.js
//
// shared/domain/solisNormalize.js: the unit and null-vs-zero traps found in the live Solis
// probe (docs/SOLIS_API_FIELD_CATALOG.md).

import { describe, it, expect } from 'vitest';
import {
  toNum, powerToKw, normalizeDayPoint, normalizeDayPoints,
  normalizeAlarm, normalizeAlarms, normalizeCollectorPoints
} from '../shared/domain/solisNormalize.js';

describe('toNum', () => {
  it('keeps a measured zero and turns absence into null', () => {
    expect(toNum(0)).toBe(0);
    expect(toNum('0')).toBe(0);
    expect(toNum(undefined)).toBeNull();
    expect(toNum(null)).toBeNull();
    expect(toNum('')).toBeNull();
    expect(toNum('abc')).toBeNull();
    expect(toNum(NaN)).toBeNull();
    expect(toNum('12.5')).toBe(12.5);
  });
});

describe('powerToKw', () => {
  it('applies the per-record scale and unit (the live shape: 31230 × 0.001 kW)', () => {
    expect(powerToKw(31230, 0.001, 'kW')).toBeCloseTo(31.23, 6);
  });
  it('handles watts and megawatts', () => {
    expect(powerToKw(1500, 1, 'W')).toBeCloseTo(1.5, 6);
    expect(powerToKw(2, 1, 'MW')).toBe(2000);
  });
  it('treats a missing scale as 1', () => {
    expect(powerToKw(5, undefined, 'kW')).toBe(5);
  });
  it('returns a real 0 for a measured zero', () => {
    expect(powerToKw(0, 0.001, 'kW')).toBe(0);
  });
  it('refuses to guess an unknown or missing unit', () => {
    expect(powerToKw(100, 1, 'furlongs')).toBeNull();
    expect(powerToKw(100, 1, undefined)).toBeNull();
    expect(powerToKw(undefined, 1, 'kW')).toBeNull();
  });
});

const livePoint = {
  dataTimestamp: '1790922598529', state: 1, pac: 31230, pacStr: 'kW', pacPec: 0.001,
  eToday: 75.4, eTotal: 100731, uPv1: 527.2, iPv1: 13, uPv7: 9.5, uAc1: 241.5, iAc1: 41.7,
  fac: 49.98, powerFactor: 1, inverterTemperature: 60.8, dcBus: 708.2, plimitSet: 110,
  timeStr: '2026-10-02 14:29:58'
};

describe('normalizeDayPoint', () => {
  it('maps a live-shaped point', () => {
    const p = normalizeDayPoint(livePoint);
    expect(p.ts).toBe(1790922598529);
    expect(p.pacKw).toBeCloseTo(31.23, 6);
    expect(p.pvV[0]).toBe(527.2);
    expect(p.pvA[0]).toBe(13);
    expect(p.pvV).toHaveLength(8);
    expect(p.acV[0]).toBe(241.5);
    expect(p.facHz).toBe(49.98);
    expect(p.tempC).toBe(60.8);
    expect(p.powerLimitPct).toBe(110);
  });

  it('uses dataTimestamp, never the UTC+8 timeStr', () => {
    const p = normalizeDayPoint({ ...livePoint, timeStr: 'garbage', time: 'garbage' });
    expect(p.ts).toBe(1790922598529);
  });

  it('reports omitted channels as null, not 0 (a string with no current is unknown)', () => {
    const p = normalizeDayPoint(livePoint);
    expect(p.pvA[6]).toBeNull(); // iPv7 absent in the sample
    expect(p.pvV[6]).toBe(9.5);
    expect(p.pvV[7]).toBeNull();
  });

  it('keeps a measured zero output as 0 kW', () => {
    const p = normalizeDayPoint({ ...livePoint, pac: 0 });
    expect(p.pacKw).toBe(0);
  });

  it('rejects a point that cannot be placed in time', () => {
    expect(normalizeDayPoint({ ...livePoint, dataTimestamp: undefined })).toBeNull();
    expect(normalizeDayPoint(null)).toBeNull();
  });
});

describe('normalizeDayPoints', () => {
  it('sorts, de-duplicates on timestamp and counts rejects', () => {
    const { points, rejected } = normalizeDayPoints([
      { ...livePoint, dataTimestamp: 3000 },
      { ...livePoint, dataTimestamp: 1000 },
      { ...livePoint, dataTimestamp: 1000, pac: 0 },
      { state: 1 }
    ]);
    expect(points.map((p) => p.ts)).toEqual([1000, 3000]);
    expect(points[0].pacKw).toBe(0); // later duplicate wins
    expect(rejected).toBe(1);
  });
  it('survives non-array input', () => {
    expect(normalizeDayPoints(undefined)).toEqual({ points: [], rejected: 0 });
  });
});

describe('normalizeAlarm', () => {
  const closed = {
    alarmCode: 1011, alarmBeginTime: '1790812798000', alarmEndTime: '1790813098077',
    alarmLong: '300077', alarmLevel: '1', state: '2', alarmMsg: 'UN-G-V01', advice: 'No Action Required'
  };
  it('maps a closed alarm; alarmLong is milliseconds', () => {
    const a = normalizeAlarm(closed);
    expect(a.code).toBe('1011');
    expect(a.beginMs).toBe(1790812798000);
    expect(a.endMs).toBe(1790813098077);
    expect(a.durationMs).toBe(300077);
    expect(a.open).toBe(false);
    expect(a.message).toBe('UN-G-V01');
  });
  it('treats state 0 as open and ignores the API’s moving end time', () => {
    const a = normalizeAlarm({ ...closed, state: '0' });
    expect(a.open).toBe(true);
    expect(a.endMs).toBeNull();
  });
  it('drops an end that precedes the begin', () => {
    expect(normalizeAlarm({ ...closed, alarmEndTime: '1' }).endMs).toBeNull();
  });
  it('drops alarms without a begin time', () => {
    expect(normalizeAlarm({ alarmCode: 1 })).toBeNull();
  });
  it('de-duplicates on code + begin and sorts', () => {
    const out = normalizeAlarms([
      { ...closed, alarmBeginTime: '2000' }, { ...closed, alarmBeginTime: '1000' }, { ...closed, alarmBeginTime: '1000' }
    ]);
    expect(out.map((a) => a.beginMs)).toEqual([1000, 2000]);
  });
});

describe('normalizeCollectorPoints', () => {
  it('keeps rssi as null when absent', () => {
    const out = normalizeCollectorPoints([{ dataTimestamp: 2000, rssi: -60 }, { dataTimestamp: 1000 }]);
    expect(out).toEqual([
      { ts: 1000, rssi: null, rssiLevel: null },
      { ts: 2000, rssi: -60, rssiLevel: null }
    ]);
  });
});
