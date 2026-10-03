// shared/domain/solisNormalize.js
//
// Turns raw SolisCloud records into the shapes the rest of the system stores and reasons about.
// Pure functions only. Field behaviour is documented in docs/SOLIS_API_FIELD_CATALOG.md; the
// quirks that matter here:
//
//   * `dataTimestamp` is epoch milliseconds and the ONLY trustworthy clock. `timeStr` / `time`
//     are UTC+8, not Sri Lanka time, and the request `timeZone` parameter has no effect.
//   * Power carries its own unit: pac=31230, pacPec=0.001, pacStr='kW'  →  31.23 kW.
//   * `alarmLong` is milliseconds. An alarm with state 0 is still open and has no real end.
//   * null ≠ 0. A field the API omitted is `null`; a measured zero stays `0`.

/** Number, or null if the value is absent / blank / not finite. Never coerces absence to 0. */
export function toNum(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

const KW_FACTOR = { w: 0.001, kw: 1, mw: 1000 };

/**
 * Convert a Solis (value, scale, unit) triple to kW. Returns null when any part is missing or the
 * unit is unknown: guessing a unit would be a fabricated number.
 */
export function powerToKw(value, scale, unit) {
  const v = toNum(value);
  if (v === null) return null;
  const s = scale === undefined || scale === null || scale === '' ? 1 : toNum(scale);
  if (s === null) return null;
  const factor = KW_FACTOR[String(unit ?? '').trim().toLowerCase()];
  if (factor === undefined) return null;
  return v * s * factor;
}

const series = (raw, prefix, count) =>
  Array.from({ length: count }, (_, i) => toNum(raw?.[`${prefix}${i + 1}`]));

/**
 * One `inverterDay` point → a telemetry row. Returns null if the point has no usable timestamp
 * (such a point cannot be placed in time and must not be stored).
 */
export function normalizeDayPoint(raw) {
  const ts = toNum(raw?.dataTimestamp);
  if (ts === null) return null;
  return {
    ts,
    state: toNum(raw.state),
    pacKw: powerToKw(raw.pac, raw.pacPec, raw.pacStr),
    pvV: series(raw, 'uPv', 8),
    pvA: series(raw, 'iPv', 8),
    acV: series(raw, 'uAc', 3),
    acA: series(raw, 'iAc', 3),
    facHz: toNum(raw.fac),
    powerFactor: toNum(raw.powerFactor),
    tempC: toNum(raw.inverterTemperature),
    dcBusV: toNum(raw.dcBus),
    powerLimitPct: toNum(raw.plimitSet),
    eTodayKwh: toNum(raw.eToday),
    eTotalKwh: toNum(raw.eTotal)
  };
}

/** Normalise and de-duplicate a day's points, oldest first. Also reports how many were rejected. */
export function normalizeDayPoints(rawPoints) {
  const byTs = new Map();
  let rejected = 0;
  for (const raw of Array.isArray(rawPoints) ? rawPoints : []) {
    const p = normalizeDayPoint(raw);
    if (!p) { rejected++; continue; }
    byTs.set(p.ts, p); // later duplicate wins; timestamps are the identity
  }
  const points = [...byTs.values()].sort((a, b) => a.ts - b.ts);
  return { points, rejected };
}

/**
 * One `alarmList` record → an alarm. `endMs` is null while the alarm is still open (state 0),
 * regardless of what the API puts in `alarmEndTime` for an open alarm.
 */
export function normalizeAlarm(raw) {
  const beginMs = toNum(raw?.alarmBeginTime);
  if (beginMs === null) return null;
  const state = toNum(raw.state);
  const open = state === 0;
  const endRaw = toNum(raw.alarmEndTime);
  return {
    code: raw.alarmCode === null || raw.alarmCode === undefined ? null : String(raw.alarmCode),
    beginMs,
    endMs: open ? null : endRaw !== null && endRaw >= beginMs ? endRaw : null,
    open,
    durationMs: toNum(raw.alarmLong),
    level: toNum(raw.alarmLevel),
    state,
    message: raw.alarmMsg ?? null,
    advice: raw.advice ?? null
  };
}

/** Normalise alarms, dropping unplaceable ones; de-duplicates on (code, beginMs). */
export function normalizeAlarms(rawAlarms) {
  const byKey = new Map();
  for (const raw of Array.isArray(rawAlarms) ? rawAlarms : []) {
    const a = normalizeAlarm(raw);
    if (a) byKey.set(`${a.code}|${a.beginMs}`, a);
  }
  return [...byKey.values()].sort((x, y) => x.beginMs - y.beginMs);
}

/** One `collector/day` point → logger heartbeat. */
export function normalizeCollectorPoint(raw) {
  const ts = toNum(raw?.dataTimestamp);
  if (ts === null) return null;
  return { ts, rssi: toNum(raw.rssi), rssiLevel: toNum(raw.rssiLevel) };
}

export function normalizeCollectorPoints(rawPoints) {
  const byTs = new Map();
  for (const raw of Array.isArray(rawPoints) ? rawPoints : []) {
    const p = normalizeCollectorPoint(raw);
    if (p) byTs.set(p.ts, p);
  }
  return [...byTs.values()].sort((a, b) => a.ts - b.ts);
}
