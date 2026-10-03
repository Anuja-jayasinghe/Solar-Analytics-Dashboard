// shared/domain/telemetryPipeline.js
//
// Pure mapping from raw SolisCloud responses to the rows of the v3 telemetry tables
// (scripts/sql/2026-10-03_v3_telemetry_schema.sql). No I/O: the collector feeds it raw payloads
// and writes what it returns, so everything between "Solis said" and "row to insert" is testable.
//
// Rules carried over from the specs:
//   * null ≠ 0 — an omitted channel stays null all the way into the row (solisNormalize.js).
//   * alarms: null = could not be fetched, [] = fetched and none occurred (uptime.js, LR-002).
//   * a day's uptime is derived from that day's own points only (local Colombo date).

import { localDateKey } from './time.js';
import { normalizeAlarms, normalizeCollectorPoints, normalizeDayPoints } from './solisNormalize.js';
import { deriveDayUptime } from './uptime.js';

const iso = (ms) => (ms === null || ms === undefined ? null : new Date(ms).toISOString());
const round = (n, dp) => (n === null || n === undefined ? null : Math.round(n * 10 ** dp) / 10 ** dp);

export function toTelemetryRow(sn, p) {
  return {
    inverter_sn: sn,
    ts: iso(p.ts),
    state: p.state,
    pac_kw: round(p.pacKw, 3),
    pv_v: p.pvV,
    pv_a: p.pvA,
    ac_v: p.acV,
    ac_a: p.acA,
    fac_hz: p.facHz,
    power_factor: p.powerFactor,
    temp_c: p.tempC,
    dc_bus_v: p.dcBusV,
    power_limit_pct: p.powerLimitPct,
    e_today_kwh: p.eTodayKwh,
    e_total_kwh: p.eTotalKwh
  };
}

export function toHeartbeatRow(collectorSn, h) {
  return { collector_sn: collectorSn, ts: iso(h.ts), rssi: h.rssi, rssi_level: h.rssiLevel };
}

export function toAlarmRow(sn, a) {
  return {
    inverter_sn: sn,
    alarm_code: a.code ?? 'unknown',
    begin_ts: iso(a.beginMs),
    end_ts: iso(a.endMs),
    duration_ms: a.durationMs,
    level: a.level,
    state: a.state,
    message: a.message,
    advice: a.advice
  };
}

export function toUptimeRow(sn, d) {
  return {
    inverter_sn: sn,
    day: d.dateKey,
    status: d.status,
    uptime_pct: round(d.uptimePct, 2),
    window_start: iso(d.windowStartMs),
    window_end: iso(d.windowEndMs),
    window_minutes: round(d.windowMinutes, 1),
    point_count: d.pointCount,
    cadence_min: d.cadenceMin,
    resolution_min: d.resolutionMin,
    low_confidence: d.lowConfidence,
    alarms_known: d.alarmsKnown,
    logger_known: d.loggerKnown,
    trip_min: round(d.minutes.trip, 1),
    gap_min: round(d.minutes.gap, 1),
    comms_lost_min: round(d.minutes.comms_lost, 1),
    edge_gap_min: round(d.minutes.edge_gap, 1),
    trip_count: d.tripCount,
    gap_count: d.gapCount,
    comms_lost_count: d.commsLostCount
  };
}

/**
 * The inverse of toUptimeRow, to the shape aggregateUptime expects. Numeric columns arrive from
 * PostgREST as strings; null stays null (unknown), it is never turned into 0.
 */
export function uptimeRowToDay(row) {
  const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
  return {
    dateKey: row.day,
    status: row.status,
    uptimePct: num(row.uptime_pct),
    windowMinutes: num(row.window_minutes) ?? 0,
    minutes: {
      trip: num(row.trip_min) ?? 0,
      gap: num(row.gap_min) ?? 0,
      comms_lost: num(row.comms_lost_min) ?? 0,
      edge_gap: num(row.edge_gap_min) ?? 0
    },
    tripCount: num(row.trip_count) ?? 0,
    gapCount: num(row.gap_count) ?? 0
  };
}

export function toSegmentRows(sn, d) {
  return d.segments.map((s) => ({
    inverter_sn: sn,
    start_ts: iso(s.startMs),
    end_ts: iso(s.endMs),
    kind: s.kind,
    cause: s.cause ?? null,
    alarm_code: s.alarmCode ?? null,
    logger_evidence: s.loggerEvidence ?? null,
    day: d.dateKey
  }));
}

/** Normalise raw alarmList records for the table; `null` stays `null` (unknown). */
export function prepareAlarms(rawAlarms) {
  return Array.isArray(rawAlarms) ? normalizeAlarms(rawAlarms) : null;
}

/**
 * Everything the collector needs to write for one local day.
 *
 * @param {object} a
 * @param {string} a.sn
 * @param {string|null} a.collectorSn
 * @param {string} a.dateKey
 * @param {Array}  a.rawPoints     raw inverterDay records
 * @param {Array|null} a.rawCollector  raw collector/day records, or null if that call failed
 * @param {Array|null} a.alarms    NORMALISED alarms (prepareAlarms), or null if unfetched
 * @param {number|null} [a.now]    epoch ms, ends still-open alarms
 */
export function buildDayRecords({ sn, collectorSn, dateKey, rawPoints, rawCollector, alarms, now = null }) {
  const { points, rejected } = normalizeDayPoints(rawPoints);
  const dayPoints = points.filter((p) => localDateKey(p.ts) === dateKey);
  const collector = Array.isArray(rawCollector) ? normalizeCollectorPoints(rawCollector) : null;

  const derived = deriveDayUptime({ dateKey, points: dayPoints, alarms, collector, now });

  const pacValues = dayPoints.map((p) => p.pacKw).filter((v) => v !== null);
  const eTodayValues = dayPoints.map((p) => p.eTodayKwh).filter((v) => v !== null);

  return {
    dateKey,
    derived,
    uptimeRow: toUptimeRow(sn, derived),
    segmentRows: toSegmentRows(sn, derived),
    telemetryRows: dayPoints.map((p) => toTelemetryRow(sn, p)),
    heartbeatRows:
      collector && collectorSn
        ? collector.filter((h) => localDateKey(h.ts) === dateKey).map((h) => toHeartbeatRow(collectorSn, h))
        : [],
    rejected,
    // For the daily summary: peak is the max of measured power; null if nothing was measured.
    peakKw: pacValues.length ? Math.max(...pacValues) : null,
    // The inverter's own cumulative-today counter at its last reading, for reconciliation.
    maxETodayKwh: eTodayValues.length ? Math.max(...eTodayValues) : null
  };
}
