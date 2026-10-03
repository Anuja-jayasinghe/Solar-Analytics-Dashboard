// shared/domain/rangeStats.js
//
// LR-003: custom range aggregation (inverter only).
// Spec: docs/logic-registry/LR-003-custom-range-aggregation.md
// Tests: tests/rangeStats.test.js
//
// Pure: no I/O, no clock. Dates are 'YYYY-MM-DD' strings. A missing day is UNKNOWN, never 0.

import { addDays, diffDays, eachDateKey, isDateKey, sameDayLastYear } from './time.js';

export const MAX_RANGE_DAYS = 3660;

function assertRange(from, to) {
  if (!isDateKey(from) || !isDateKey(to)) throw new RangeError('from/to must be YYYY-MM-DD');
  const n = diffDays(from, to);
  if (n < 0) throw new RangeError('from must not be after to');
  if (n + 1 > MAX_RANGE_DAYS) throw new RangeError(`range exceeds ${MAX_RANGE_DAYS} days`);
  return n + 1;
}

const finiteNonNegative = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Bill periods (LR-001) with their effective rate (earnings ÷ units_exported).
 * @param {{bill_date:string, earnings:number, units_exported:number}[]} bills
 * @returns {{startDate:string,endDate:string,ratePerKwh:number}[]} bills with no usable rate are omitted
 */
export function buildBillRatePeriods(bills) {
  const sorted = [...(bills ?? [])]
    .filter((b) => isDateKey(b.bill_date))
    .sort((a, b) => (a.bill_date < b.bill_date ? -1 : a.bill_date > b.bill_date ? 1 : 0));
  const periods = [];
  sorted.forEach((bill, i) => {
    const units = Number(bill.units_exported);
    const earnings = Number(bill.earnings);
    if (!(units > 0) || !Number.isFinite(earnings)) return;
    const startDate = i > 0 ? addDays(sorted[i - 1].bill_date, 1) : addDays(bill.bill_date, -30);
    periods.push({ startDate, endDate: bill.bill_date, ratePerKwh: earnings / units });
  });
  return periods;
}

function rateForDay(date, rate) {
  if (!rate) return { value: null, fallback: false };
  if (rate.mode === 'fixed') {
    return finiteNonNegative(rate.ratePerKwh) ? { value: rate.ratePerKwh, fallback: false } : { value: null, fallback: false };
  }
  if (rate.mode === 'effective') {
    const p = (rate.periods ?? []).find((x) => date >= x.startDate && date <= x.endDate);
    if (p && finiteNonNegative(p.ratePerKwh)) return { value: p.ratePerKwh, fallback: false };
    if (finiteNonNegative(rate.fallbackRatePerKwh)) return { value: rate.fallbackRatePerKwh, fallback: true };
  }
  return { value: null, fallback: false };
}

/**
 * Compute every Explore output for `[from, to]`.
 * @throws {RangeError} on an invalid range
 */
export function computeRangeStats({ from, to, rows, capacityKwp, acRatedKw, rate = null }) {
  const daysInRange = assertRange(from, to);
  const dates = eachDateKey(from, to);

  // Last row per date wins; rows outside the range are ignored.
  const byDate = new Map();
  for (const r of rows ?? []) {
    if (r && r.date >= from && r.date <= to) byDate.set(r.date, r);
  }

  const present = [];
  const missingDates = [];
  for (const d of dates) {
    const r = byDate.get(d);
    if (r && finiteNonNegative(r.kwh)) present.push({ date: d, kwh: r.kwh, peakKw: finite(r.peakKw) && r.peakKw >= 0 ? r.peakKw : null });
    else missingDates.push(d);
  }

  const presentDays = present.length;
  const totalKwh = presentDays ? present.reduce((s, p) => s + p.kwh, 0) : null;
  const avgPerDayKwh = presentDays ? totalKwh / presentDays : null;

  let best = null;
  let worst = null;
  for (const p of present) {
    if (!best || p.kwh > best.kwh) best = { date: p.date, kwh: p.kwh };
    if (!worst || p.kwh < worst.kwh) worst = { date: p.date, kwh: p.kwh };
  }

  let peak = null;
  let peakKnownDays = 0;
  for (const p of present) {
    if (p.peakKw === null) continue;
    peakKnownDays++;
    if (!peak || p.peakKw > peak.kw) peak = { date: p.date, kw: p.peakKw };
  }

  const specificYield = totalKwh !== null && capacityKwp > 0 ? totalKwh / capacityKwp : null;
  const capacityFactor = totalKwh !== null && acRatedKw > 0 ? totalKwh / (acRatedKw * 24 * presentDays) : null;

  // Series (R5): no interpolation; cumulative only moves on present days.
  const presentByDate = new Map(present.map((p) => [p.date, p.kwh]));
  // Before the first present day there is nothing to accumulate: cumulative is null, not 0.
  let running = 0;
  let started = false;
  const series = dates.map((date) => {
    const kwh = presentByDate.has(date) ? presentByDate.get(date) : null;
    if (kwh !== null) {
      running += kwh;
      started = true;
    }
    return { date, kwh, cumulativeKwh: started ? running : null };
  });

  // Revenue (R6)
  let revenue = { lkr: null, basis: rate?.mode ?? null, ratedDays: 0, unratedDays: presentDays };
  if (rate) {
    let sum = 0;
    let rated = 0;
    let usedFallback = false;
    for (const p of present) {
      const r = rateForDay(p.date, rate);
      if (r.value === null) continue;
      sum += p.kwh * r.value;
      rated++;
      if (r.fallback) usedFallback = true;
    }
    revenue = {
      lkr: rated > 0 ? sum : null,
      basis: rate.mode === 'effective' && usedFallback ? 'mixed' : rate.mode,
      ratedDays: rated,
      unratedDays: presentDays - rated
    };
  }

  return {
    from, to, daysInRange, presentDays, missingDates,
    completeness: presentDays / daysInRange,
    zeroDays: present.filter((p) => p.kwh === 0).map((p) => p.date),
    totalKwh, avgPerDayKwh, best, worst,
    peak, peakKnownDays,
    specificYield, capacityFactor,
    revenue, series
  };
}

/** R7: compare two computed ranges by average per day. */
export function compareRanges(current, baseline) {
  const ca = current?.avgPerDayKwh ?? null;
  const ba = baseline?.avgPerDayKwh ?? null;
  const deltaAvgKwh = ca !== null && ba !== null ? ca - ba : null;
  return {
    deltaAvgKwh,
    deltaAvgPct: deltaAvgKwh !== null && ba > 0 ? (deltaAvgKwh / ba) * 100 : null,
    currentTotalKwh: current?.totalKwh ?? null,
    baselineTotalKwh: baseline?.totalKwh ?? null,
    currentCompleteness: current?.completeness ?? null,
    baselineCompleteness: baseline?.completeness ?? null
  };
}

/** Same-length window ending the day before `from`. */
export function previousPeriod(from, to) {
  const n = assertRange(from, to);
  return { from: addDays(from, -n), to: addDays(from, -1) };
}

/** The same calendar range one year earlier (29 Feb folds to 28 Feb). */
export function sameRangeLastYear(from, to) {
  assertRange(from, to);
  return { from: sameDayLastYear(from), to: sameDayLastYear(to) };
}
