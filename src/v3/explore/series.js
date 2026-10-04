// src/v3/explore/series.js
//
// Pure logic for "Inverter generation over time": which days a range covers, how a range steps, how a
// long range is grouped into months, and the default "Mark above" line. Date keys are 'YYYY-MM-DD'
// strings in Asia/Colombo (shared/domain/time.js); a day with no reading is null, never 0 (LR-003).

import { addDays, diffDays } from '../../../shared/domain/time.js';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export const RANGE_KINDS = Object.freeze({ week: 7, month: 30, year: 365 });
/** Beyond this many days a chart shows monthly totals: a column per day stops being readable. */
export const GROUP_OVER_DAYS = 62;
export const MAX_CUSTOM_DAYS = 366;

export const dayLabel = (key) => `${Number(key.slice(8, 10))} ${MON[Number(key.slice(5, 7)) - 1]}`;
export const dayLabelYear = (key) => `${dayLabel(key)} ${key.slice(0, 4)}`;

/** Clamp a key into [min, max] (either bound may be null = unbounded). */
function clampKey(key, min, max) {
  if (min && key < min) return min;
  if (max && key > max) return max;
  return key;
}

/**
 * The inclusive day range for a preset ending at `endKey`, kept inside the data bounds.
 * @param {'week'|'month'|'year'} kind
 */
export function presetRange(kind, endKey, { min = null, max = null } = {}) {
  const len = RANGE_KINDS[kind];
  if (!len) throw new RangeError(`unknown range kind: ${kind}`);
  const to = clampKey(endKey, min, max);
  const from = clampKey(addDays(to, -(len - 1)), min, null);
  return { from, to };
}

/** A user-chosen range: swapped if reversed, clipped to the data bounds, capped at MAX_CUSTOM_DAYS. */
export function customRange(a, b, { min = null, max = null } = {}) {
  let from = a <= b ? a : b;
  let to = a <= b ? b : a;
  from = clampKey(from, min, max);
  to = clampKey(to, min, max);
  if (diffDays(from, to) + 1 > MAX_CUSTOM_DAYS) from = addDays(to, -(MAX_CUSTOM_DAYS - 1));
  return { from, to };
}

/** Move a preset window back (-1) or forward (+1) by its own length, staying inside the data. */
export function stepRange(kind, range, dir, bounds = {}) {
  const len = RANGE_KINDS[kind];
  const to = clampKey(addDays(range.to, dir * len), bounds.min ?? null, bounds.max ?? null);
  return presetRange(kind, to, bounds);
}

export function canStep(kind, range, dir, { min = null, max = null } = {}) {
  if (kind === 'custom') return false;
  return dir < 0 ? !(min && range.from <= min) : !(max && range.to >= max);
}

export function isGrouped(range) {
  return diffDays(range.from, range.to) + 1 > GROUP_OVER_DAYS;
}

/**
 * Points for the chart from the API's daily series [{date, kwh|null}]. Grouped ranges sum per calendar
 * month over the days that HAVE data and say how many days that was; a month with no data is null.
 * @returns {{key:string,label:string,full:string,kwh:number|null,present:number,total:number}[]}
 */
export function buildPoints(series, grouped) {
  if (!grouped) {
    const long = series.length > 14;
    return series.map((d) => {
      const day = Number(d.date.slice(8, 10));
      return {
        key: d.date,
        label: long ? (day === 1 || day % 5 === 0 ? String(day) : '') : dayLabel(d.date),
        full: dayLabelYear(d.date),
        kwh: isNum(d.kwh) ? d.kwh : null,
        present: isNum(d.kwh) ? 1 : 0,
        total: 1
      };
    });
  }
  const order = [];
  const byMonth = new Map();
  for (const d of series) {
    const ym = d.date.slice(0, 7);
    if (!byMonth.has(ym)) { byMonth.set(ym, { ym, sum: 0, present: 0, total: 0 }); order.push(ym); }
    const b = byMonth.get(ym);
    b.total += 1;
    if (isNum(d.kwh)) { b.sum += d.kwh; b.present += 1; }
  }
  return order.map((ym) => {
    const b = byMonth.get(ym);
    const name = MON[Number(ym.slice(5, 7)) - 1];
    return {
      key: ym,
      label: name,
      full: `${name} ${ym.slice(0, 4)}${b.present < b.total ? ` (${b.present}/${b.total} days)` : ''}`,
      kwh: b.present ? b.sum : null,
      present: b.present,
      total: b.total
    };
  });
}

/** Default "Mark above" line: the median of the known values, rounded (nearest 10 for days, 100 for months). */
export function defaultLine(points, grouped) {
  const v = points.map((p) => p.kwh).filter(isNum).sort((a, b) => a - b);
  if (v.length === 0) return 0;
  const mid = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
  const unit = grouped ? 100 : 10;
  return Math.round(mid / unit) * unit;
}

export function aboveCount(points, line) {
  let above = 0;
  let known = 0;
  for (const p of points) {
    if (p.kwh === null) continue;
    known += 1;
    if (p.kwh > line) above += 1;
  }
  return { above, known };
}

/** Geometry for the statistics range chart: positions (0..100) of the line, the average and the best/lowest dots. */
export function spreadGeometry(series, best, worst, avg) {
  const known = series.filter((d) => isNum(d.kwh));
  if (known.length === 0 || !best || !worst) return null;
  const lo = worst.kwh * 0.8;
  const hi = best.kwh * 1.06;
  const span = hi - lo || 1;
  const n = series.length;
  const x = (i) => (n > 1 ? (i / (n - 1)) * 100 : 50);
  const y = (v) => 100 - ((v - lo) / span) * 100;
  const index = new Map(series.map((d, i) => [d.date, i]));
  return {
    points: series.map((d, i) => (isNum(d.kwh) ? [x(i), y(d.kwh)] : null)),
    avgY: isNum(avg) ? y(avg) : null,
    best: { x: x(index.get(best.date) ?? 0), y: y(best.kwh) },
    worst: { x: x(index.get(worst.date) ?? 0), y: y(worst.kwh) }
  };
}

export const STATS_PERIODS = Object.freeze([
  { value: '30', label: 'Last 30 days' },
  { value: '365', label: 'Last 365 days' },
  { value: 'life', label: 'Lifetime' }
]);

/** The day range a statistics period covers, ending on the newest day with data. Lifetime starts at the first record. */
export function statsRange(period, { min = null, max = null } = {}) {
  if (!max) return null;
  if (period === 'life') return { from: min ?? max, to: max };
  const days = period === '365' ? 365 : 30;
  let from = addDays(max, -(days - 1));
  if (min && from < min) from = min;
  return { from, to: max };
}
