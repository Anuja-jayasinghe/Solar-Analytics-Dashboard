// src/v3/pro/metrics.js
//
// Pure logic behind the Pro metrics page. It formats what the read API returns (uptime LR-002, alarms,
// one day of telemetry, bills) and never recomputes uptime itself: the API's aggregate is the truth.
// Unknown is null and renders as a dash; a day without data is its own state, not a 0% day.

import { isCommsAlarmCode } from '../../../shared/domain/uptime.js';
import { addDays, isDateKey } from '../../../shared/domain/time.js';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const num = (v) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export const PRO_RANGES = Object.freeze([14, 30, 60]);

/** The last `days` COMPLETED days: ends yesterday, because today's uptime is not final. */
export function proRange(todayKey, days) {
  const to = addDays(todayKey, -1);
  return { from: addDays(to, -(days - 1)), to };
}

export function lastCompleteMonth(todayKey) {
  return addDays(`${todayKey.slice(0, 7)}-01`, -1).slice(0, 7);
}

export function monthWindow(month) {
  if (!/^\d{4}-\d{2}$/.test(month ?? '') || !isDateKey(`${month}-01`)) return null;
  const [year, number] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year, number, 1)).toISOString().slice(0, 10);
  return { from: `${month}-01`, to: addDays(next, -1) };
}

/** 473 -> '7 h 53 m', 45 -> '45 m'. */
export function minutesLabel(min) {
  if (!isNum(min)) return '—';
  const m = Math.round(min);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} m` : `${m} m`;
}

export function uptimeTone(pct) {
  if (!isNum(pct)) return 'none';
  return pct >= 99 ? 'good' : pct >= 95 ? 'warn' : 'bad';
}

/**
 * Headline numbers for the four rings. Uptime and downtime come from the API's aggregate (weighted by
 * the daylight minutes actually known), so the page and the API can never disagree.
 */
export function healthSummary({ uptime, alarms, totals }) {
  const agg = uptime?.aggregate ?? null;
  const days = uptime?.days ?? [];
  const affected = days.filter((d) => (num(d.trip_min) ?? 0) + (num(d.gap_min) ?? 0) > 0).length;
  const gen = totals?.generation ?? null;
  const span = gen?.firstDay && gen?.lastDay ? gen.dayCount + gen.missingDays : null;
  return {
    uptimePct: agg && isNum(agg.uptimePct) ? agg.uptimePct : null,
    daysCounted: agg?.daysCounted ?? 0,
    daysNoData: agg?.daysNoData ?? 0,
    downMinutes: agg && isNum(agg.downMinutes) ? agg.downMinutes : null,
    tripCount: agg?.tripCount ?? null,
    affectedDays: agg ? affected : null,
    totalDays: days.length,
    openAlarms: alarms && !alarms.truncated ? (alarms.alarms ?? []).filter((a) => a.end_ts === null || a.end_ts === undefined).length : null,
    alarmsListed: alarms ? (alarms.alarms ?? []).length : null,
    alarmsTruncated: !!alarms?.truncated,
    completenessPct: gen && span ? (gen.dayCount / span) * 100 : null,
    dataDays: gen?.dayCount ?? null,
    spanDays: span
  };
}

/** One cell of the uptime strip. height 26..100 maps 90%..100% uptime; a no-data day is a short grey cell. */
export function stripCell(d) {
  const pct = d.status === 'no_data' ? null : num(d.uptime_pct);
  const tone = uptimeTone(pct);
  const height = pct === null ? 24 : Math.max(26, Math.min(100, 26 + ((pct - 90) / 10) * 74));
  return { key: d.day, pct, tone, height, trip: num(d.trip_min) ?? 0, gap: num(d.gap_min) ?? 0, comms: num(d.comms_lost_min) ?? 0, tripCount: num(d.trip_count) ?? 0 };
}

export function stripTip(cell) {
  const date = `${Number(cell.key.slice(8, 10))} ${MON[Number(cell.key.slice(5, 7)) - 1]} ${cell.key.slice(0, 4)}`;
  if (cell.pct === null) return `${date}: no uptime data`;
  let t = `${date}: ${cell.pct.toFixed(1)}% uptime`;
  if (cell.trip) t += ` · stopped ${minutesLabel(cell.trip)} (${cell.tripCount} trip${cell.tripCount === 1 ? '' : 's'})`;
  if (cell.gap) t += ` · unexplained gap ${minutesLabel(cell.gap)}`;
  if (cell.comms) t += ` · logger offline ${minutesLabel(cell.comms)}`;
  return t;
}

const LEVELS = { 1: { label: 'Low', tone: 'neutral' }, 2: { label: 'Medium', tone: 'warn' }, 3: { label: 'High', tone: 'bad' } };
const ALARM_HELP = Object.freeze({
  '1010': { meaning: 'Grid voltage too high', explanation: 'The inverter reports AC grid voltage above its configured protection limit.' },
  '1011': { meaning: 'Grid voltage too low', explanation: 'The inverter reports AC grid voltage below its configured protection limit.' },
  '1015': { meaning: 'Grid connection absent', explanation: 'The inverter reports that it cannot detect the AC grid.' },
  F017: { meaning: 'Line-to-earth check failed', explanation: 'Solis describes low resistance between an AC line and protective earth. Ask a qualified installer to inspect the AC side.' },
  '1D4C2': { meaning: 'Logger lost internet', explanation: 'The data logger lost its cloud connection. This alone does not mean the inverter stopped generating.' }
});

export function alarmLegend(alarms) {
  const counts = new Map();
  for (const alarm of alarms?.alarms ?? []) {
    const code = String(alarm.alarm_code ?? 'unknown').toUpperCase();
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]).map(([code, count]) => ({
    code, count,
    meaning: ALARM_HELP[code]?.meaning ?? 'Description from Solis record',
    explanation: ALARM_HELP[code]?.explanation ?? 'No verified plain-language definition is available here; inspect the Solis message and ask the installer if this recurs.'
  }));
}

/** Alarm rows for the table, latest first. A lost-internet alarm is a LOGGER event, never inverter downtime. */
export function alarmRows(alarms, limit = 8) {
  return [...(alarms?.alarms ?? [])]
    .sort((a, b) => (a.begin_ts < b.begin_ts ? 1 : a.begin_ts > b.begin_ts ? -1 : 0))
    .slice(0, limit)
    .map((a) => {
      const logger = isCommsAlarmCode(a.alarm_code);
      const code = String(a.alarm_code ?? 'unknown').toUpperCase();
      const open = a.end_ts === null || a.end_ts === undefined;
      const min = isNum(Number(a.duration_ms)) && a.duration_ms !== null ? Math.round(Number(a.duration_ms) / 6000) / 10 : null;
      const lvl = LEVELS[a.level] ?? LEVELS[1];
      return {
        key: `${a.alarm_code}-${a.begin_ts}`,
        code,
        message: logger ? 'Lost internet (logger)' : a.message || 'Alarm',
        meaning: ALARM_HELP[code]?.meaning ?? (a.message || 'Meaning not verified'),
        explanation: ALARM_HELP[code]?.explanation ?? 'No verified plain-language definition is available here.',
        logger,
        open,
        beginTs: a.begin_ts,
        length: open ? 'open' : min === null ? '—' : min < 1 ? '< 1 min' : `${Math.round(min)} min`,
        level: lvl.label,
        tone: lvl.tone,
        advice: a.advice || ''
      };
    });
}

const PRODUCING_KW = 1;

/**
 * Electrical readings from one day of 5-minute telemetry, over producing points only.
 * PV input occupancy is unknown, so currents are shown without a cross-input fault threshold.
 */
export function electricalFromTelemetry(points, colomboHour) {
  const live = (points ?? []).filter((p) => p && isNum(p.pac_kw) && p.pac_kw > PRODUCING_KW);
  if (live.length === 0) return null;
  const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  const median = (xs) => {
    if (!xs.length) return null;
    const sorted = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  const nInputs = Math.max(0, ...live.map((p) => (Array.isArray(p.pv_a) ? p.pv_a.length : 0)));
  const pvInputs = Array.from({ length: nInputs }, (_, i) => ({
    n: i + 1,
    amps: avg(live.map((p) => num(p.pv_a?.[i])).filter(isNum)),
    volts: avg(live.map((p) => num(p.pv_v?.[i])).filter(isNum))
  }));
  const acPhaseVolts = [0, 1, 2].map((i) => median(live.map((p) => num(p.ac_v?.[i])).filter(isNum)));
  const acPhaseSpreadVolts = median(live.flatMap((p) => {
    const phases = [0, 1, 2].map((i) => num(p.ac_v?.[i]));
    return phases.every(isNum) ? [Math.max(...phases) - Math.min(...phases)] : [];
  }));
  const byHour = new Map();
  for (const p of live) {
    const h = colomboHour(p.ts);
    if (!byHour.has(h)) byHour.set(h, []);
    byHour.get(h).push(p);
  }
  const hours = [...byHour.keys()].sort((a, b) => a - b);
  const mm = (xs, f) => xs.map(f).filter(isNum);
  return {
    pvInputs,
    temperature: hours.map((h) => ({ hour: h, max: Math.max(...mm(byHour.get(h), (p) => num(p.temp_c))) })).filter((t) => isNum(t.max) && t.max !== -Infinity),
    frequency: hours.map((h) => ({ hour: h, lo: Math.min(...mm(byHour.get(h), (p) => num(p.fac_hz))), hi: Math.max(...mm(byHour.get(h), (p) => num(p.fac_hz))) })).filter((f) => Number.isFinite(f.lo) && Number.isFinite(f.hi)),
    powerFactor: avg(mm(live, (p) => num(p.power_factor))),
    acPhaseVolts,
    acPhaseSpreadVolts
  };
}

/** Effective LKR per kWh for each bill, oldest first (earnings / units exported, from the API). */
export function rateSeries(bills) {
  return [...(bills?.bills ?? [])]
    .filter((b) => isNum(b.effectiveRatePerKwh))
    .sort((a, b) => (a.billDate < b.billDate ? -1 : 1))
    .map((b) => ({ key: b.billDate, rate: b.effectiveRatePerKwh, earningsLkr: b.earningsLkr ?? null, cebKwh: b.cebKwh ?? null }));
}

/** This year's bill periods against the same generation month a year earlier; only complete, finalized pairs. */
export function yoyPairs(rows, max = 8) {
  const done = rows.filter((r) => r.status === 'finalized' && r.complete && r.inverterKwh !== null);
  const key = (r) => `${r.label}-${r.year}`;
  const index = new Map(done.map((r) => [key(r), r]));
  const pairs = [];
  for (const r of done) {
    const prev = index.get(`${r.label}-${r.year - 1}`);
    if (prev) pairs.push({ label: r.label, year: r.year, prev: prev.inverterKwh, cur: r.inverterKwh, deltaPct: prev.inverterKwh > 0 ? ((r.inverterKwh - prev.inverterKwh) / prev.inverterKwh) * 100 : null });
  }
  return pairs.slice(-max);
}
