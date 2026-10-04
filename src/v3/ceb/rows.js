// src/v3/ceb/rows.js
//
// The CEB vs Inverter tile's data, as pure functions over the API's `bills` rows plus the open
// (provisional) LR-001 period. Specs: LR-001 (bill-aligned periods), LR-004 (money gap).
//
// Rules kept here: a bill in month N reports N-1, so a bill's label is the month BEFORE its bill date;
// a variance is shown only when every day of the period has inverter data; unknown is null, never 0.

import { computeEarningsDifference } from '../../../shared/domain/earningsDifference.js';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Generation month of a bill: the month before its bill date. '2036-09-03' -> { label: 'Aug', year: 2036 }. */
export function generationMonth(billDate) {
  let y = Number(billDate.slice(0, 4));
  let m = Number(billDate.slice(5, 7)) - 1; // month number (1..12) of the month before the bill month
  if (m < 1) { m = 12; y -= 1; }
  return { label: MON[m - 1], year: y };
}

/**
 * @param {object[]} bills  rows of GET /api/data/bills (any order)
 * @param {object|null} open  the provisional LR-001 row ({ month, periodStart, inverter, daysPresent, daysInPeriod }) with `year`
 * @param {string|null} todayKey
 * @returns {object[]} oldest first; each: id, label, year, status, periodStart, periodEnd, inverterKwh, cebKwh,
 *   daysPresent, daysInPeriod, complete, ratePerKwh, earningsLkr, variancePct, gapLkr, gapReason
 */
export function buildCebRows(bills, open, todayKey) {
  const rows = [...(bills ?? [])]
    .filter((b) => b && typeof b.billDate === 'string')
    .sort((a, b) => (a.billDate < b.billDate ? -1 : a.billDate > b.billDate ? 1 : 0))
    .map((b) => {
      const gm = generationMonth(b.billDate);
      const diff = computeEarningsDifference([b]);
      const complete = !!b.complete;
      return {
        id: b.billDate,
        label: gm.label,
        year: gm.year,
        status: 'finalized',
        periodStart: b.periodStart ?? null,
        periodEnd: b.periodEnd ?? b.billDate,
        inverterKwh: isNum(b.inverterKwh) ? b.inverterKwh : null,
        cebKwh: isNum(b.cebKwh) ? b.cebKwh : null,
        daysPresent: b.daysPresent ?? null,
        daysInPeriod: b.daysInPeriod ?? null,
        complete,
        ratePerKwh: isNum(b.effectiveRatePerKwh) ? b.effectiveRatePerKwh : null,
        earningsLkr: isNum(b.earningsLkr) ? b.earningsLkr : null,
        variancePct: complete && isNum(b.variancePct) ? b.variancePct : null,
        gapLkr: diff.includedPeriods === 1 ? diff.differenceLkr : null,
        gapReason: diff.excluded[0]?.reason ?? null
      };
    });

  if (open && isNum(open.inverter)) {
    rows.push({
      id: 'open',
      label: open.month,
      year: open.year ?? (todayKey ? Number(todayKey.slice(0, 4)) : null),
      status: 'provisional',
      periodStart: open.periodStart ?? null,
      periodEnd: todayKey ?? null,
      inverterKwh: open.inverter,
      cebKwh: null,
      daysPresent: open.daysPresent ?? null,
      daysInPeriod: open.daysInPeriod ?? null,
      complete: false,
      ratePerKwh: null,
      earningsLkr: null,
      variancePct: null,
      gapLkr: null,
      gapReason: 'not_finalized'
    });
  }
  return rows;
}

/** A period with fewer recorded days than the period has (the bar is striped; no variance is claimed). */
export function isPartial(row) {
  return row.daysPresent !== null && row.daysInPeriod !== null && row.daysPresent < row.daysInPeriod;
}

/** Display window: `count` rows ending at index `endIdx` (clamped), or everything for 'all'. */
export function windowOf(rows, count, endIdx) {
  if (rows.length === 0) return { start: 0, end: -1, rows: [] };
  const end = Math.min(Math.max(endIdx, 0), rows.length - 1);
  const n = count === 'all' ? rows.length : Math.max(1, count);
  const start = Math.max(0, end - n + 1);
  return { start, end, rows: rows.slice(start, end + 1) };
}

/** New end index after stepping half a window back (-1) or forward (+1), kept inside the data. */
export function stepEnd(rows, count, endIdx, dir) {
  const n = count === 'all' ? rows.length : count;
  const half = Math.max(1, Math.floor(n / 2));
  return Math.min(rows.length - 1, Math.max(n - 1, endIdx + dir * half));
}

/** Default "Mark above" line: the median inverter total, rounded to the nearest 100 kWh. */
export function defaultThreshold(rows) {
  const v = rows.map((r) => r.inverterKwh).filter(isNum).sort((a, b) => a - b);
  if (v.length === 0) return 0;
  const mid = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
  return Math.round(mid / 100) * 100;
}

/** How many of the periods in view have an inverter total above the line (periods without one are not counted). */
export function aboveSummary(rows, threshold) {
  let above = 0;
  let known = 0;
  for (const r of rows) {
    if (r.inverterKwh === null) continue;
    known += 1;
    if (r.inverterKwh > threshold) above += 1;
  }
  return { above, known };
}

/** The variance tag under a column: '+3.1%' / '−2.4%', 'n/d' for partial periods, or 'awaiting bill'. */
export function varianceTag(row) {
  if (row.status === 'provisional') return { text: 'awaiting bill', tone: 'muted' };
  if (isPartial(row)) return { text: `${row.daysPresent}/${row.daysInPeriod} d`, tone: 'warn' };
  if (row.variancePct === null) return { text: '', tone: 'muted' };
  const v = row.variancePct;
  return { text: `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}%`, tone: 'muted' };
}

/** Money-gap totals for the rows in view and for every bill (LR-004). Null when nothing is comparable. */
export function gapSummary(windowRows, allBills) {
  let sum = 0;
  let n = 0;
  for (const r of windowRows) if (r.gapLkr !== null) { sum += r.gapLkr; n += 1; }
  const all = computeEarningsDifference(allBills);
  return {
    windowLkr: n ? sum : null,
    windowCompared: n,
    windowTotal: windowRows.length,
    all: {
      differenceLkr: all.differenceLkr,
      differencePct: all.differencePct,
      valueLkr: all.inverterValueLkr,
      paidLkr: all.earningsLkr,
      periods: all.includedPeriods,
      excluded: all.excluded.length,
      from: all.from,
      to: all.to
    }
  };
}

const dm = (key) => (typeof key === 'string' ? `${Number(key.slice(8, 10))} ${MON[Number(key.slice(5, 7)) - 1]}` : '—');
const kwh = (v) => (isNum(v) ? `${Math.round(v).toLocaleString('en-US')} kWh` : 'no total');

/** The hover/tap text for one column: period, both totals, the variance or why there is none. */
export function columnTip(row, threshold) {
  const parts = [`${row.label} ${row.year ?? ''}`.trim(), `${dm(row.periodStart)} to ${dm(row.periodEnd)}`];
  parts.push(`Inverter ${kwh(row.inverterKwh)}${isNum(row.inverterKwh) && isNum(threshold) && row.inverterKwh > threshold ? ' (above the line)' : ''}`);
  if (row.status === 'provisional') {
    parts.push(`CEB bill not issued yet · ${row.daysPresent ?? '—'} of ${row.daysInPeriod ?? '—'} days so far`);
  } else {
    parts.push(`CEB ${kwh(row.cebKwh)}`);
    if (isPartial(row)) parts.push(`only ${row.daysPresent} of ${row.daysInPeriod} days recorded, so no variance is claimed`);
    else if (row.variancePct !== null) parts.push(`variance ${varianceTag(row).text}`);
  }
  return parts.join(' · ');
}

const lkrK = (v) => `${v < 0 ? '−' : '+'} LKR ${Math.abs(v) >= 1e6 ? `${(Math.abs(v) / 1e6).toFixed(2)} M` : `${(Math.abs(v) / 1e3).toFixed(1)} K`}`;

/** The hover/tap text for one money-gap column (LR-004). */
export function gapTip(row) {
  const head = `${row.label} ${row.year ?? ''}`.trim();
  if (row.status === 'provisional') return `${head}: bill not issued yet, nothing to compare`;
  if (row.gapLkr === null) {
    return row.gapReason === 'incomplete_days'
      ? `${head}: not compared. Only ${row.daysPresent ?? '—'} of ${row.daysInPeriod ?? '—'} days have inverter data, so no figure is guessed.`
      : `${head}: not compared (${row.gapReason === 'no_rate' ? 'no usable rate on this bill' : 'no inverter total'}).`;
  }
  const worth = row.inverterKwh * row.ratePerKwh;
  return `${head}: CEB paid LKR ${Math.round(row.earningsLkr).toLocaleString('en-US')} (${kwh(row.cebKwh)}) vs generation worth LKR ${Math.round(worth).toLocaleString('en-US')} (${kwh(row.inverterKwh)} at LKR ${row.ratePerKwh.toFixed(2)} per kWh) = ${lkrK(row.gapLkr)}${row.gapLkr < 0 ? ': CEB paid less than the inverter generated' : ': CEB paid more than the inverter recorded'}`;
}

/** Compact amount for under a money-gap bar: '−5.8 K'. */
export function gapLabel(v) {
  if (v === null) return '';
  const a = Math.abs(v);
  return `${v < 0 ? '−' : '+'}${a >= 1e6 ? `${(a / 1e6).toFixed(2)} M` : `${(a / 1e3).toFixed(1)} K`}`;
}
