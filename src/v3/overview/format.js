// src/v3/overview/format.js
//
// Pure presentation helpers for the Overview's live row and headline tiles. Date keys are
// 'YYYY-MM-DD' strings in Asia/Colombo; they are formatted from their parts, never through Date, so a
// timezone can never shift the day. Unknown is null and renders as an em dash, never as 0.

import { localMinuteOfDay } from '../../../shared/domain/time.js';

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

/** Asia/Colombo clock time of an epoch-ms instant, '11:50'; null when unknown. */
export function clockAt(epochMs) {
  if (!isNum(epochMs)) return null;
  const m = localMinuteOfDay(epochMs);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** The inverter's own state from a reading, ignoring where the reading came from. */
function inverterState(live) {
  if (live.status === 'online') return { key: 'online', label: 'Online', tone: 'good' };
  if (live.status === 'alarm') return { key: 'fault', label: live.faultCode != null ? `Fault · code ${live.faultCode}` : 'Fault', tone: 'bad' };
  if (live.status === 'offline') return live.abnormalOffline ? { key: 'offline', label: 'Offline', tone: 'bad' } : { key: 'asleep', label: 'Asleep', tone: 'neutral' };
  return { key: 'unknown', label: 'Unknown', tone: 'neutral' };
}

const SOLIS_DOWN = 'SolisCloud not responding';

/**
 * The status bulb. state 2 ("offline") is NORMAL every night, so plain offline is "Asleep"; only
 * abnormalOffline is a fault, and an inverter alarm shows its SolisCloud state code. When SolisCloud
 * itself fails the bulb names that, not the inverter: the inverter may be fine. A stale reading is
 * flagged and never shown as current.
 * @param {object|null} live  GET /api/data/live
 * @param {{code?:string}|null} [error]  the failed live read, if any
 * @returns {{key:string,label:string,tone:'good'|'bad'|'warn'|'neutral', inverter?:object}}
 */
export function liveState(live, error = null) {
  if (!live) {
    return error?.code === 'upstream_unavailable'
      ? { key: 'upstream', label: SOLIS_DOWN, tone: 'warn' }
      : { key: 'unknown', label: 'Unknown', tone: 'neutral' };
  }
  const s = inverterState(live);
  if (live.stale && live.upstream === 'unavailable') return { key: 'upstream', label: SOLIS_DOWN, tone: 'warn', inverter: s };
  return live.stale ? { ...s, label: `${s.label} · last known`, tone: 'warn' } : s;
}

/** Which reading is on screen when it is not current: 'last saved reading at 11:50'. Null when it is current. */
export function readingNote(live) {
  if (!live?.stale) return null;
  const at = clockAt(live.dataTimestamp);
  const what = live.source === 'saved' ? 'last saved reading' : 'last reading';
  return at ? `${what} at ${at}` : what;
}

/** The explanation behind the status bulb. */
export function liveStatusTip(live, error, state) {
  if (state.key === 'upstream') {
    const head = 'SolisCloud, where the inverter reports its readings, did not answer. The inverter itself may be fine.';
    if (!live) return `${head} No reading from today is saved yet, so the figures show a dash. It retries every minute.`;
    const inv = state.inverter ? ` The inverter last reported: ${state.inverter.label}.` : '';
    return `${head} Showing the ${readingNote(live)}, not a live value.${inv} It retries every minute.`;
  }
  if (state.key === 'fault') return `The inverter reports a fault${live?.faultCode != null ? ` (SolisCloud state code ${live.faultCode})` : ''}. The alarm log is on the Pro page.`;
  if (live?.abnormalOffline) return 'Offline during daylight: the inverter or its logger is not reporting.';
  if (state.key === 'asleep') return 'The inverter sleeps at night; this is normal.';
  if (state.key === 'online') return 'Online: the inverter is feeding the grid.';
  return state.label;
}

/** A failed read's code in words, for the "could not be loaded" note. */
export function errorLabel(code) {
  if (code === 'upstream_unavailable') return `live reading: ${SOLIS_DOWN}`;
  return code ?? 'error';
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

/**
 * The open bill period from `totals.openPeriod` (LR-001: the day after the latest bill to today), or null
 * when it is not known. `month`/`year` name the month the next bill will report.
 */
export function openPeriodView(openPeriod) {
  if (!openPeriod || openPeriod.status !== 'provisional') return null;
  return {
    startKey: openPeriod.periodStart ?? null,
    endKey: openPeriod.periodEnd ?? null,
    kwh: isNum(openPeriod.inverter) ? openPeriod.inverter : null,
    daysPresent: openPeriod.daysPresent ?? null,
    daysInPeriod: openPeriod.daysInPeriod ?? null,
    month: openPeriod.month ?? null,
    year: openPeriod.year ?? null
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
