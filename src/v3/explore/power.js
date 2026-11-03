// src/v3/explore/power.js
//
// One day's power curve, as SolisCloud draws it: every reading of the inverter's output (kW), Asia/Colombo time.
// SolisCloud sends about one a minute for this inverter; stored days may be coarser. `stepMin` says which.
// Pure: no I/O, no clock. Unknown stays unknown: a hole in the readings breaks the line instead of being drawn as
// zero, and a day with no readings has no curve and no peak.

import { localMinuteOfDay } from '../../../shared/domain/time.js';
import { FIRST_HOUR, LAST_HOUR } from './hourly.js';

/** The x-axis: 05:00 to 20:00 local, in minutes of the day. */
export const DAY_START_MIN = FIRST_HOUR * 60;
export const DAY_END_MIN = (LAST_HOUR + 1) * 60;
/** How often the page re-reads today: the server re-reads SolisCloud at most every 5 minutes; this just picks it up. */
export const TODAY_POLL_MS = 120_000;
/** Readings further apart than this are a gap in the data, not a straight line between two values. */
export const GAP_MIN = 15;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const pad2 = (n) => String(n).padStart(2, '0');

/** '11:55' for a minute of the day. */
export function clockOf(min) {
  const m = Math.round(min);
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

/** Where a minute of the day falls across the chart, 0..100. */
export function xOfMinute(min) {
  return ((min - DAY_START_MIN) / (DAY_END_MIN - DAY_START_MIN)) * 100;
}

/**
 * @param {{ts:string, pac_kw:number|null}[]} points  the telemetry resource's points, any order
 * @param {{kw:number, tsMs:number}|null} [now]  the live reading, added when it is newer than the last point (today only)
 * @returns {null | {
 *   pts: {min:number, kw:number, at:string, tsMs:number, live?:boolean}[],
 *   segments: number[][],          index runs without a gap, for drawing the line
 *   stepMin: number|null,          the typical minutes between readings (median)
 *   peak: {kw:number, min:number, at:string},
 *   last: {kw:number, min:number, at:string, live:boolean}
 * }}
 */
export function powerCurve(points, now = null) {
  const pts = (points ?? [])
    .map((p) => ({ tsMs: Date.parse(p?.ts), kw: p?.pac_kw }))
    .filter((p) => Number.isFinite(p.tsMs) && isNum(p.kw) && p.kw >= 0)
    .sort((a, b) => a.tsMs - b.tsMs)
    .map((p) => ({ ...p, min: localMinuteOfDay(p.tsMs) }))
    .filter((p) => p.min >= DAY_START_MIN && p.min <= DAY_END_MIN)
    .map((p) => ({ ...p, at: clockOf(p.min) }));

  if (now && isNum(now.kw) && now.kw >= 0 && Number.isFinite(now.tsMs) && (pts.length === 0 || now.tsMs > pts[pts.length - 1].tsMs)) {
    const min = localMinuteOfDay(now.tsMs);
    if (min >= DAY_START_MIN && min <= DAY_END_MIN) pts.push({ tsMs: now.tsMs, kw: now.kw, min, at: clockOf(min), live: true });
  }
  if (pts.length === 0) return null;

  const segments = [];
  let run = [0];
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].min - pts[i - 1].min > GAP_MIN) { segments.push(run); run = []; }
    run.push(i);
  }
  segments.push(run);

  let best = pts[0];
  for (const p of pts) if (p.kw > best.kw) best = p;
  const last = pts[pts.length - 1];
  const steps = pts.slice(1).map((p, i) => p.min - pts[i].min).filter((d) => d > 0).sort((a, b) => a - b);
  return {
    pts,
    segments,
    stepMin: steps.length ? steps[Math.floor(steps.length / 2)] : null, // the typical gap between readings
    peak: { kw: Math.round(best.kw * 10) / 10, min: best.min, at: best.at },
    last: { kw: last.kw, min: last.min, at: last.at, live: !!last.live }
  };
}

/** The reading closest in time to a minute of the day (for the hover line). */
export function nearestPoint(pts, min) {
  if (!pts?.length) return null;
  let lo = 0;
  let hi = pts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].min < min) lo = mid; else hi = mid;
  }
  return Math.abs(pts[lo].min - min) <= Math.abs(pts[hi].min - min) ? pts[lo] : pts[hi];
}

/** "every minute" / "every 5 minutes", from the typical gap between readings. */
export function intervalLabel(stepMin) {
  if (!isNum(stepMin)) return 'power readings';
  const m = Math.round(stepMin);
  return m <= 1 ? 'power every minute' : `power every ${m} minutes`;
}

/** The live reading as a curve point, when it belongs to the day shown and is current. */
export function liveNow(live, date, todayKey) {
  if (!live || !date || date !== todayKey || live.stale) return null;
  const tsMs = live.dataTimestamp ?? live.fetchedAt;
  return isNum(live.currentPowerKw) && Number.isFinite(tsMs) ? { kw: live.currentPowerKw, tsMs } : null;
}

/** The curve for a day, with today's live reading added: what the chart draws and where its peak is. */
export function dayCurve(points, live, date, todayKey) {
  return powerCurve(points, liveNow(live, date, todayKey));
}
