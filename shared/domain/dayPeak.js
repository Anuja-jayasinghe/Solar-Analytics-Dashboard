// shared/domain/dayPeak.js
//
// The highest power so far today, and when (Asia/Colombo), from the day's raw SolisCloud `inverterDay`
// points. Powers the Today tile's "Peak 26.3 kW at 11:55". Pure: no I/O, no clock.
//
// Unknown stays unknown: no usable points -> null (the tile shows a dash), never a 0 kW "peak".

import { normalizeDayPoints } from './solisNormalize.js';
import { localMinuteOfDay } from './time.js';

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * @param {unknown[]} rawPoints  `inverterDay` data (an array of raw points)
 * @returns {{kw:number, at:string, points:number} | null}  `at` is 'HH:MM' local time
 */
export function peakOfDay(rawPoints) {
  const { points } = normalizeDayPoints(rawPoints);
  let best = null;
  for (const p of points) {
    if (typeof p.pacKw !== 'number' || !Number.isFinite(p.pacKw) || p.pacKw < 0) continue;
    if (!best || p.pacKw > best.pacKw) best = p;
  }
  if (!best) return null;
  const minute = Math.floor(localMinuteOfDay(best.ts));
  return { kw: Math.round(best.pacKw * 10) / 10, at: `${pad2(Math.floor(minute / 60))}:${pad2(minute % 60)}`, points: points.length };
}
