// tests/telemetryPipeline.test.js
//
// shared/domain/telemetryPipeline.js: raw Solis payloads → database rows. The risks are silent
// ones: a unit applied wrongly, a null turned into 0, a day derived from another day's points.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildDayRecords, prepareAlarms, toAlarmRow, toTelemetryRow } from '../shared/domain/telemetryPipeline.js';
import { normalizeDayPoint } from '../shared/domain/solisNormalize.js';

const SN = 'INV1';
const fx = JSON.parse(readFileSync(new URL('./fixtures/solis/day-2026-10-02.json', import.meta.url), 'utf8'));

const rawPoint = (ts, extra = {}) => ({
  dataTimestamp: ts, state: 1, pac: 31230, pacStr: 'kW', pacPec: 0.001, eToday: 75.4, eTotal: 100731,
  uPv1: 527.2, iPv1: 13, uAc1: 241.5, fac: 49.98, inverterTemperature: 60.8, ...extra
});

describe('toTelemetryRow', () => {
  it('maps a normalised point to the table shape with an ISO timestamp', () => {
    const p = normalizeDayPoint(rawPoint(1790922598529));
    const row = toTelemetryRow(SN, p);
    expect(row.inverter_sn).toBe(SN);
    expect(row.ts).toBe(new Date(1790922598529).toISOString());
    expect(row.pac_kw).toBeCloseTo(31.23, 6);
    expect(row.pv_v).toHaveLength(8);
    expect(row.pv_v[0]).toBe(527.2);
    expect(row.pv_a[1]).toBeNull(); // channel not reported stays null
    expect(row.ac_v).toHaveLength(3);
  });

  it('keeps a measured 0 kW as 0 and an unknown power as null', () => {
    expect(toTelemetryRow(SN, normalizeDayPoint(rawPoint(1, { pac: 0 }))).pac_kw).toBe(0);
    expect(toTelemetryRow(SN, normalizeDayPoint(rawPoint(1, { pac: undefined }))).pac_kw).toBeNull();
  });
});

describe('alarms', () => {
  it('prepareAlarms keeps null (unknown) distinct from [] (none)', () => {
    expect(prepareAlarms(null)).toBeNull();
    expect(prepareAlarms(undefined)).toBeNull();
    expect(prepareAlarms([])).toEqual([]);
  });

  it('maps an open alarm with a null end and a missing code to a safe key', () => {
    const [a] = prepareAlarms([{ alarmBeginTime: 1000, state: 0, alarmLong: 5 }]);
    const row = toAlarmRow(SN, a);
    expect(row.end_ts).toBeNull();
    expect(row.alarm_code).toBe('unknown');
    expect(row.begin_ts).toBe(new Date(1000).toISOString());
  });
});

describe('buildDayRecords on the real 2026-10-02 day', () => {
  const alarms = prepareAlarms(fx.alarms);
  const rec = buildDayRecords({
    sn: SN, collectorSn: 'COL1', dateKey: fx.date, rawPoints: fx.points, rawCollector: fx.collector, alarms
  });

  it('stores every in-day point and every heartbeat of that day', () => {
    expect(rec.telemetryRows).toHaveLength(146);
    expect(rec.heartbeatRows.length).toBeGreaterThan(280);
    expect(rec.heartbeatRows[0]).toMatchObject({ collector_sn: 'COL1' });
  });

  it('derives uptime consistently with LR-002 and shapes the uptime and segment rows', () => {
    expect(rec.uptimeRow).toMatchObject({ inverter_sn: SN, day: '2026-10-02', status: 'ok', alarms_known: true, logger_known: true });
    expect(rec.uptimeRow.uptime_pct).toBeGreaterThan(96.5);
    expect(rec.uptimeRow.uptime_pct).toBeLessThan(98);
    expect(rec.segmentRows.length).toBe(rec.uptimeRow.trip_count);
    expect(rec.segmentRows.every((s) => s.kind === 'trip' && s.cause === 'grid_undervoltage' && s.day === '2026-10-02')).toBe(true);
    expect(rec.segmentRows.every((s) => s.end_ts > s.start_ts)).toBe(true);
  });
});

describe('day isolation', () => {
  it('ignores points that belong to a different Colombo date', () => {
    // 2026-10-02T20:00Z is 01:30 on 3 Oct local, so it must not count toward 2 Oct.
    const rec = buildDayRecords({
      sn: SN, collectorSn: null, dateKey: '2026-10-02',
      rawPoints: [rawPoint(Date.parse('2026-10-02T05:00:00Z')), rawPoint(Date.parse('2026-10-02T20:00:00Z'))],
      rawCollector: null, alarms: []
    });
    expect(rec.telemetryRows).toHaveLength(1);
    expect(rec.derived.pointCount).toBe(1);
  });
});

describe('missing evidence stays missing', () => {
  it('a failed collector call → logger unknown and no heartbeat rows', () => {
    const rec = buildDayRecords({
      sn: SN, collectorSn: 'COL1', dateKey: '2026-10-02',
      rawPoints: [rawPoint(Date.parse('2026-10-02T05:00:00Z'))], rawCollector: null, alarms: []
    });
    expect(rec.uptimeRow.logger_known).toBe(false);
    expect(rec.heartbeatRows).toEqual([]);
  });

  it('a failed alarm fetch → alarms_known false and no trips asserted', () => {
    const rec = buildDayRecords({
      sn: SN, collectorSn: null, dateKey: '2026-10-02',
      rawPoints: [rawPoint(Date.parse('2026-10-02T05:00:00Z'))], rawCollector: null, alarms: null
    });
    expect(rec.uptimeRow.alarms_known).toBe(false);
    expect(rec.uptimeRow.trip_count).toBe(0);
  });

  it('no points and no logger → no_data with a null percentage, never 0', () => {
    const rec = buildDayRecords({
      sn: SN, collectorSn: null, dateKey: '2026-10-02', rawPoints: [], rawCollector: null, alarms: []
    });
    expect(rec.uptimeRow.status).toBe('no_data');
    expect(rec.uptimeRow.uptime_pct).toBeNull();
    expect(rec.peakKw).toBeNull();
    expect(rec.maxETodayKwh).toBeNull();
  });
});

describe('peak and reconciliation figures', () => {
  it('peakKw is the measured maximum; a measured zero day has peak 0, not null', () => {
    const day = (pac) => buildDayRecords({
      sn: SN, collectorSn: null, dateKey: '2026-10-02', rawCollector: null, alarms: [],
      rawPoints: [rawPoint(Date.parse('2026-10-02T05:00:00Z'), { pac }), rawPoint(Date.parse('2026-10-02T05:05:00Z'), { pac: pac / 2 })]
    });
    expect(day(20000).peakKw).toBeCloseTo(20, 6);
    expect(day(0).peakKw).toBe(0);
  });

  it('maxETodayKwh is the largest cumulative-today reading', () => {
    const rec = buildDayRecords({
      sn: SN, collectorSn: null, dateKey: '2026-10-02', rawCollector: null, alarms: [],
      rawPoints: [
        rawPoint(Date.parse('2026-10-02T05:00:00Z'), { eToday: 10 }),
        rawPoint(Date.parse('2026-10-02T11:00:00Z'), { eToday: 160.5 })
      ]
    });
    expect(rec.maxETodayKwh).toBe(160.5);
  });
});
