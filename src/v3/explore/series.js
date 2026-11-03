// src/v3/explore/series.js
//
// Pure logic for "Inverter generation over time": which days a range covers, how a range steps, how a
// long range is grouped into months, and the default "Mark above" line. Date keys are 'YYYY-MM-DD'
// strings in Asia/Colombo (shared/domain/time.js); a day with no reading is null, never 0 (LR-003).

import { addDays, diffDays } from '../../../shared/domain/time.js';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

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

const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad2 = (n) => String(n).padStart(2, '0');

/** 0 = Monday ... 6 = Sunday. */
const weekday = (key) => (((Math.round(Date.parse(`${key}T00:00:00Z`) / 86400000) + 3) % 7) + 7) % 7; // 1970-01-01 was a Thursday

/** The Monday of the week holding `key`. */
export const weekStart = (key) => addDays(key, -weekday(key));

/** ISO week number and the year it belongs to (a week belongs to the year of its Thursday): '2026-10-27' -> { year: 2026, week: 44 }. */
export function isoWeek(key) {
  const monday = weekStart(key);
  const year = Number(addDays(monday, 3).slice(0, 4));
  return { year, week: diffDays(weekStart(`${year}-01-04`), monday) / 7 + 1 };
}

const monthEnd = (ym) => addDays(`${addMonthKey(ym, 1)}-01`, -1);
function addMonthKey(ym, n) {
  const idx = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1 + n;
  return `${Math.floor(idx / 12)}-${pad2((idx % 12) + 1)}`;
}

/** The whole calendar week (Monday to Sunday) or month holding `key`. */
export function periodOf(kind, key) {
  if (kind === 'week') { const from = weekStart(key); return { from, to: addDays(from, 6) }; }
  if (kind === 'month') return { from: `${key.slice(0, 7)}-01`, to: monthEnd(key.slice(0, 7)) };
  throw new RangeError(`unknown period kind: ${kind}`);
}

/**
 * The calendar week or month holding `anchor` (kept inside the data): `full` is the whole period, `from`/`to` the part
 * that has data to ask for (the first one starts late, the current one is so far).
 */
export function periodRange(kind, anchor, { min = null, max = null } = {}) {
  const full = periodOf(kind, clampKey(anchor, min, max));
  return { from: clampKey(full.from, min, max), to: clampKey(full.to, min, max), full };
}

/** Whether there is a week/month before (-1) or after (+1) this one that holds any data. */
export function canStepPeriod(range, dir, { min = null, max = null } = {}) {
  return dir < 0 ? !(min && range.full.from <= min) : !(max && range.full.to >= max);
}

/** A day in the week/month before (-1) or after (+1), to anchor the next period on. */
export function stepPeriod(kind, range, dir) {
  if (kind === 'week') return addDays(range.full.from, 7 * dir);
  return `${addMonthKey(range.full.from.slice(0, 7), dir)}-01`;
}

/** 'Week 44 · 2026' / 'November 2026'. */
export function periodLabel(kind, range) {
  if (!range) return '';
  if (kind === 'week') { const w = isoWeek(range.full.from); return `Week ${w.week} · ${w.year}`; }
  return `${MONTH_NAMES[Number(range.full.from.slice(5, 7)) - 1]} ${range.full.from.slice(0, 4)}`;
}

/**
 * One point per day of the whole period, so a week always shows Monday to Sunday and a month all its days. A day with no
 * reading is null, never 0, and says why: not yet, before records began, or not recorded.
 */
export function dayPoints(series, full, { min = null, max = null } = {}) {
  const byDate = new Map((series ?? []).map((d) => [d.date, d.kwh]));
  const n = diffDays(full.from, full.to) + 1;
  const out = [];
  for (let i = 0; i < n; i++) {
    const date = addDays(full.from, i);
    const kwh = isNum(byDate.get(date)) ? byDate.get(date) : null;
    const day = Number(date.slice(8, 10));
    out.push({
      key: date,
      label: n > 14 ? (day === 1 || day % 5 === 0 ? String(day) : '') : `${WD[weekday(date)]} ${day}`,
      full: `${WD[weekday(date)]} ${dayLabelYear(date)}`,
      kwh,
      present: kwh === null ? 0 : 1,
      total: 1,
      ...(kwh === null ? { why: max && date > max ? 'Not yet' : min && date < min ? 'Before records began' : 'No data recorded' } : {})
    });
  }
  return out;
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

/** The years that hold any data, oldest first: [2024, 2025, 2026]. */
export function dataYears({ min = null, max = null } = {}) {
  if (!max) return [];
  const last = Number(max.slice(0, 4));
  const first = min ? Number(min.slice(0, 4)) : last;
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

/**
 * The year to show: `year` kept inside the years that have data, or the newest one when not chosen (null when there is
 * no data at all). A year outside the data is never shown: before the first year it is the first, after the last the last.
 */
export function clampYear(year, bounds) {
  const years = dataYears(bounds);
  if (years.length === 0) return null;
  const first = years[0];
  const last = years[years.length - 1];
  if (!Number.isInteger(year)) return last;
  return Math.min(last, Math.max(first, year));
}

/** A calendar year, 1 Jan to 31 Dec, cut to the days that have data (the first year starts late, this year is so far). */
export function yearRange(year, { min = null, max = null } = {}) {
  if (!Number.isInteger(year) || (min && year < Number(min.slice(0, 4))) || (max && year > Number(max.slice(0, 4)))) {
    throw new RangeError(`no data in year ${year}`); // clipping would quietly show another year's days under this one
  }
  return { from: clampKey(`${year}-01-01`, min, max), to: clampKey(`${year}-12-31`, min, max) };
}

const monthDays = (ym) => {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7));
  return [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
};

/**
 * Twelve monthly points for a calendar year, January to December, from the year's daily series. A month counts its
 * days against the whole month, so one only partly recorded (the first, or this one so far) shows as partial. A month
 * with no readings is null, never 0, and says why: not reached yet, before records began, or simply not recorded.
 */
export function yearPoints(series, year, { min = null, max = null } = {}) {
  const byMonth = new Map(buildPoints(series, true).map((p) => [p.key, p]));
  const lo = min ? min.slice(0, 7) : null;
  const hi = max ? max.slice(0, 7) : null;
  return MON.map((name, i) => {
    const ym = `${year}-${String(i + 1).padStart(2, '0')}`;
    const total = monthDays(ym);
    const got = byMonth.get(ym);
    const present = got?.present ?? 0;
    const why = hi && ym > hi ? 'Not yet' : lo && ym < lo ? 'Before records began' : 'No data recorded';
    return {
      key: ym,
      label: name,
      full: `${name} ${year}${present && present < total ? ` (${present}/${total} days)` : ''}`,
      kwh: present ? got.kwh : null,
      present,
      total,
      ...(present ? {} : { why })
    };
  });
}

/** A year's total over the days that have data, and how many days that is out of the days in reach. */
export function yearSummary(points, range) {
  const kwh = points.reduce((s, p) => s + (isNum(p.kwh) ? p.kwh : 0), 0);
  const present = points.reduce((s, p) => s + p.present, 0);
  return { kwh: present ? kwh : null, present, days: range ? diffDays(range.from, range.to) + 1 : 0 };
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
/**
 * `worst` (the lowest recorded day) sets the bottom of the scale so every day fits; `low` is the day marked as lowest
 * (the lowest full day), which may sit above it. Without `low` the lowest recorded day is marked.
 */
export function spreadGeometry(series, best, worst, avg, low = worst) {
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
    worst: { x: x(index.get(worst.date) ?? 0), y: y(worst.kwh) },
    low: low ? { x: x(index.get(low.date) ?? 0), y: y(low.kwh) } : null
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
