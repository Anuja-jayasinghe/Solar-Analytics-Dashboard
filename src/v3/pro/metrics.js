// src/v3/pro/metrics.js
//
// Pure logic behind the Pro metrics page. It formats what the read API returns (uptime LR-002, alarms,
// one day of telemetry, bills) and never recomputes uptime itself: the API's aggregate is the truth.
// Unknown is null and renders as a dash; a day without data is its own state, not a 0% day.

import { isCommsAlarmCode } from '../../../shared/domain/uptime.js';
import { addDays } from '../../../shared/domain/time.js';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const num = (v) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export const PRO_RANGES = Object.freeze([14, 30, 60]);

/** The last `days` COMPLETED days: ends yesterday, because today's uptime is not final. */
export function proRange(todayKey, days) {
  const to = addDays(todayKey, -1);
  return { from: addDays(to, -(days - 1)), to };
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
    openAlarms: alarms ? (alarms.alarms ?? []).filter((a) => a.end_ts === null || a.end_ts === undefined).length : null,
    alarmsListed: alarms ? (alarms.alarms ?? []).length : null,
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

/** Alarm rows for the table, latest first. A lost-internet alarm is a LOGGER event, never inverter downtime. */
export function alarmRows(alarms, limit = 8) {
  return [...(alarms?.alarms ?? [])]
    .sort((a, b) => (a.begin_ts < b.begin_ts ? 1 : a.begin_ts > b.begin_ts ? -1 : 0))
    .slice(0, limit)
    .map((a) => {
      const logger = isCommsAlarmCode(a.alarm_code);
      const open = a.end_ts === null || a.end_ts === undefined;
      const min = isNum(Number(a.duration_ms)) && a.duration_ms !== null ? Math.round(Number(a.duration_ms) / 6000) / 10 : null;
      const lvl = LEVELS[a.level] ?? LEVELS[1];
      return {
        key: `${a.alarm_code}-${a.begin_ts}`,
        code: String(a.alarm_code ?? ''),
        message: logger ? 'Lost internet (logger)' : a.message || 'Alarm',
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
 * Electrical health from one day of 5-minute telemetry, over producing points only.
 * Strings: average current each, with the deviation from the mean (below -8% is flagged).
 */
export function electricalFromTelemetry(points, colomboHour) {
  const live = (points ?? []).filter((p) => p && isNum(p.pac_kw) && p.pac_kw > PRODUCING_KW);
  if (live.length === 0) return null;
  const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  const nStrings = Math.max(0, ...live.map((p) => (Array.isArray(p.pv_a) ? p.pv_a.length : 0)));
  const strings = Array.from({ length: nStrings }, (_, i) => ({
    n: i + 1,
    amps: avg(live.map((p) => num(p.pv_a?.[i])).filter(isNum)),
    volts: avg(live.map((p) => num(p.pv_v?.[i])).filter(isNum))
  }));
  const mean = avg(strings.map((s) => s.amps).filter(isNum));
  const withDev = strings.map((s) => ({ ...s, deviationPct: isNum(s.amps) && mean ? (s.amps / mean - 1) * 100 : null }));
  const byHour = new Map();
  for (const p of live) {
    const h = colomboHour(p.ts);
    if (!byHour.has(h)) byHour.set(h, []);
    byHour.get(h).push(p);
  }
  const hours = [...byHour.keys()].sort((a, b) => a - b);
  const mm = (xs, f) => xs.map(f).filter(isNum);
  return {
    strings: withDev,
    meanAmps: mean,
    lowStrings: withDev.filter((s) => s.deviationPct !== null && s.deviationPct < -8).map((s) => s.n),
    temperature: hours.map((h) => ({ hour: h, max: Math.max(...mm(byHour.get(h), (p) => num(p.temp_c))) })).filter((t) => isNum(t.max) && t.max !== -Infinity),
    frequency: hours.map((h) => ({ hour: h, lo: Math.min(...mm(byHour.get(h), (p) => num(p.fac_hz))), hi: Math.max(...mm(byHour.get(h), (p) => num(p.fac_hz))) })).filter((f) => Number.isFinite(f.lo) && Number.isFinite(f.hi)),
    powerFactor: avg(mm(live, (p) => num(p.power_factor))),
    gridVolts: avg(live.flatMap((p) => (Array.isArray(p.ac_v) && p.ac_v.length ? [avg(p.ac_v.map(num).filter(isNum))] : [])).filter(isNum))
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
