// src/v3/overview/format.js
//
// Pure presentation helpers for the Overview's live row and headline tiles. Date keys are
// 'YYYY-MM-DD' strings in Asia/Colombo; they are formatted from their parts, never through Date, so a
// timezone can never shift the day. Unknown is null and renders as an em dash, never as 0.


export const DASH = '—';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export function fmtNum(v, dp = 0) {
  return isNum(v) ? v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }) : DASH;
}

/** '2036-09-06' -> '6 Sep' */
export function shortDate(key) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return DASH;
  return `${Number(key.slice(8, 10))} ${MON[Number(key.slice(5, 7)) - 1]}`;
}

/** '2035-01-01' -> '1 Jan 2035' */
export function longDate(key) {
  const s = shortDate(key);
  return s === DASH ? DASH : `${s} ${key.slice(0, 4)}`;
}

/** Calendar months spanned by two date keys, counting both ends (Jan 2035 to Sep 2036 = 21). */
export function monthsBetween(fromKey, toKey) {
  if (typeof fromKey !== 'string' || typeof toKey !== 'string' || toKey < fromKey) return null;
  const n = (Number(toKey.slice(0, 4)) - Number(fromKey.slice(0, 4))) * 12 + (Number(toKey.slice(5, 7)) - Number(fromKey.slice(5, 7))) + 1;
  return Number.isFinite(n) ? n : null;
}

/** 3_067_844 LKR -> { value: 'LKR 3.07', unit: 'M' } ; small amounts stay whole. */
export function lkrCompact(v) {
  if (!isNum(v)) return { value: DASH, unit: '' };
  const a = Math.abs(v);
  if (a >= 1e6) return { value: `LKR ${fmtNum(v / 1e6, 2)}`, unit: 'M' };
  if (a >= 1e3) return { value: `LKR ${fmtNum(v / 1e3, 1)}`, unit: 'K' };
  return { value: `LKR ${fmtNum(v)}`, unit: '' };
}

/** kWh -> { value, unit }: MWh from 10,000 kWh up (78,471 kWh reads 78.5 MWh), otherwise kWh. */
export function energyCompact(kwh) {
  if (!isNum(kwh)) return { value: DASH, unit: 'kWh' };
  return Math.abs(kwh) >= 10_000 ? { value: fmtNum(kwh / 1000, 1), unit: 'MWh' } : { value: fmtNum(kwh), unit: 'kWh' };
}

/**
 * Progress to the daily target. `pct` is the true percentage (may exceed 100); `level` is the filled
 * share, clamped to 0..100. Null when either input is unknown or the target is not positive.
 */
export function targetProgress(todayKwh, targetKwh) {
  if (!isNum(todayKwh) || !isNum(targetKwh) || targetKwh <= 0 || todayKwh < 0) return null;
  const pct = Math.round((todayKwh / targetKwh) * 100);
  return { pct, level: Math.min(100, pct), reached: todayKwh >= targetKwh, toGoKwh: Math.max(0, targetKwh - todayKwh) };
}

/** Share of the inverter's AC rating being produced right now, 0..1; null when either is unknown. */
export function gaugeFraction(kw, maxKw) {
  if (!isNum(kw) || !isNum(maxKw) || maxKw <= 0) return null;
  return Math.max(0, Math.min(1, kw / maxKw));
}

/**
 * The status bulb. state 2 ("offline") is NORMAL every night, so plain offline is "Asleep"; only
 * abnormalOffline is a fault. A stale reading is flagged and never shown as current.
 * @returns {{key:string,label:string,tone:'good'|'bad'|'warn'|'neutral'}}
 */
export function liveState(live) {
  if (!live) return { key: 'unknown', label: 'Unknown', tone: 'neutral' };
  let s;
  if (live.status === 'online') s = { key: 'online', label: 'Online', tone: 'good' };
  else if (live.status === 'alarm') s = { key: 'fault', label: 'Fault', tone: 'bad' };
  else if (live.status === 'offline') s = live.abnormalOffline ? { key: 'offline', label: 'Offline', tone: 'bad' } : { key: 'asleep', label: 'Asleep', tone: 'neutral' };
  else s = { key: 'unknown', label: 'Unknown', tone: 'neutral' };
  return live.stale ? { ...s, label: `${s.label} · last known`, tone: 'warn' } : s;
}

export const FRESH_WINDOW_MIN = 15;

/**
 * How old the data is. `fraction` is 1 when fresh and drains to 0 over FRESH_WINDOW_MIN minutes.
 * Uses the inverter's own timestamp when present, else when the server fetched it; unknown -> null.
 */
export function freshness({ dataTimestamp, fetchedAt }, nowMs) {
  const base = isNum(dataTimestamp) ? dataTimestamp : isNum(fetchedAt) ? fetchedAt : null;
  if (base === null || !isNum(nowMs)) return null;
  const ageMin = Math.max(0, (nowMs - base) / 60000);
  const label = ageMin < 1 ? 'just now' : ageMin < 60 ? `${Math.round(ageMin)} min ago` : ageMin < 1440 ? `${Math.round(ageMin / 60)} h ago` : `${Math.round(ageMin / 1440)} d ago`;
  return { ageMin, fraction: Math.max(0, Math.min(1, 1 - ageMin / FRESH_WINDOW_MIN)), label };
}

/** The open (provisional) bill period from the LR-001 rows, or null when there is none. */
export function openBillPeriod(rows) {
  const row = (rows ?? []).find((r) => r && r.status === 'provisional');
  if (!row) return null;
  return {
    startKey: row.periodStart ?? null,
    endKey: row.periodEnd ?? null,
    kwh: isNum(row.inverter) ? row.inverter : null,
    daysPresent: row.daysPresent ?? null,
    daysInPeriod: row.daysInPeriod ?? null
  };
}

/**
 * The open billing period's generation so far. Today's live reading is added when the period runs to today
 * and today's daily total is not stored yet (`lastStoredDay` before today, or a confirmed null when no
 * daily rows exist). An undefined
 * last stored day means the totals response has not arrived, so today's value is not added yet.
 * Unknown stays null: nothing stored and no live reading -> null.
 * @returns {null | {kwh:number|null, includesToday:boolean, daysPresent:number|null, daysInPeriod:number|null}}
 */
export function openPeriodSoFar(open, live, lastStoredDay, todayKey) {
  if (!open) return null;
  const today = live?.todayKwh;
  const addToday = isNum(today) && !!todayKey && open.endKey === todayKey && lastStoredDay !== undefined && (lastStoredDay === null || lastStoredDay < todayKey);
  const stored = isNum(open.kwh) ? open.kwh : null;
  const kwh = stored === null && !addToday ? null : (stored ?? 0) + (addToday ? today : 0);
  return {
    kwh,
    includesToday: addToday,
    daysPresent: open.daysPresent === null ? null : open.daysPresent + (addToday ? 1 : 0),
    daysInPeriod: open.daysInPeriod
  };
}

/**
 * All-time generation. The inverter's own lifetime counter is the truth: it includes days the database
 * has no record of (before collection started, outages). The sum of stored daily totals is the fallback.
 * @returns {{kwh:number|null, source:'counter'|'records'|null}}
 */
export function lifetimeGeneration(live, totals) {
  const counter = live?.totalKwh;
  if (isNum(counter) && counter > 0) return { kwh: counter, source: 'counter' };
  const sum = totals?.generation?.totalKwh;
  return isNum(sum) ? { kwh: sum, source: 'records' } : { kwh: null, source: null };
}
