// shared/domain/alignment.js
//
// LR-001: CEB vs inverter monthly alignment, on date keys.
// Spec: docs/logic-registry/LR-001-ceb-vs-inverter-monthly-alignment.md
// Tests: tests/alignment.test.js (differential against the v1 implementation + timezone checks)
//
// The rule: a bill received in month N reports generation from month N-1.
//   periodEnd   = bill_date
//   periodStart = previous bill_date + 1 day      (fallback: bill_date - 30 days)
//   inverter    = sum of daily generation within [periodStart, periodEnd]
//
// Why a second implementation next to src/lib/dataService.js? That one is written with local
// `Date` objects, so its answers depend on the machine's timezone: right in a Colombo browser,
// subtly wrong on a UTC server (Vercel). This one uses only 'YYYY-MM-DD' strings and integer
// arithmetic, so the API and the browser compute identical rows anywhere.
//
// Intentional differences from v1, both in service of null ≠ 0:
//   * a window with NO daily data reports inverter = null (v1 reported 0, which reads as a
//     measured zero), and every row carries daysPresent / daysInPeriod / completeness;
//   * a bill whose units_exported is null reports ceb = null (v1 coerced it to 0).
// Everything else matches v1 for complete data; tests/alignment.test.js proves it.

import { addDays, diffDays, eachDateKey } from './time.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad2 = (n) => String(n).padStart(2, '0');
const fmt = (key) => `${key.slice(8, 10)}/${key.slice(5, 7)}/${key.slice(0, 4)}`;
const label = (a, b) => `${fmt(a)} – ${fmt(b)}`;
const maxKey = (a, b) => (a > b ? a : b);
const minKey = (a, b) => (a < b ? a : b);

function lastDayOfMonth(year, monthIndex) {
  return addDays(monthIndex === 11 ? `${year + 1}-01-01` : `${year}-${pad2(monthIndex + 2)}-01`, -1);
}

function windowStats(kwhByDate, start, end) {
  if (start > end) return { inverter: null, daysPresent: 0, daysInPeriod: 0, completeness: null };
  const dates = eachDateKey(start, end);
  let sum = 0;
  let present = 0;
  for (const d of dates) {
    const v = kwhByDate.get(d);
    if (v !== undefined) {
      sum += v;
      present++;
    }
  }
  return {
    inverter: present ? sum : null,
    daysPresent: present,
    daysInPeriod: dates.length,
    completeness: present / dates.length
  };
}

const cebUnits = (bill) => {
  if (bill.units_exported === null || bill.units_exported === undefined || bill.units_exported === '') return null;
  const n = Number(bill.units_exported);
  return Number.isFinite(n) ? n : null;
};

/**
 * @param {object} a
 * @param {number} a.year
 * @param {{date:string, kwh:number|null}[]} a.dailyRows   inverter_data_daily_summary
 * @param {{bill_date:string, units_exported:number|null}[]} a.bills  ceb_data
 * @param {string} a.todayKey    today's Colombo date key (the caller owns the clock)
 */
export function buildAlignedRows({ year, dailyRows, bills, todayKey }) {
  const kwhByDate = new Map();
  for (const r of dailyRows ?? []) {
    if (r && typeof r.kwh === 'number' && Number.isFinite(r.kwh) && r.kwh >= 0) kwhByDate.set(r.date, r.kwh);
  }
  const sortedBills = [...(bills ?? [])]
    .filter((b) => typeof b?.bill_date === 'string')
    .sort((a, b) => (a.bill_date < b.bill_date ? -1 : a.bill_date > b.bill_date ? 1 : 0));

  const currentYear = Number(todayKey.slice(0, 4));
  const currentMonthIndex = Number(todayKey.slice(5, 7)) - 1;
  const latestBill = sortedBills.length ? sortedBills[sortedBills.length - 1] : null;

  return Array.from({ length: 12 }, (_, monthIndex) => {
    const monthStart = `${year}-${pad2(monthIndex + 1)}-01`;
    const monthEnd = lastDayOfMonth(year, monthIndex);
    const month = MONTHS[monthIndex];

    const billMonth = (monthIndex + 1) % 12;
    const billYear = year + (monthIndex === 11 ? 1 : 0);
    const billIdx = sortedBills.findIndex(
      (b) => Number(b.bill_date.slice(5, 7)) - 1 === billMonth && Number(b.bill_date.slice(0, 4)) === billYear
    );

    const isCurrentMonth = year === currentYear && monthIndex === currentMonthIndex;
    const isFutureMonth = year > currentYear || (year === currentYear && monthIndex > currentMonthIndex);

    if (billIdx >= 0) {
      const bill = sortedBills[billIdx];
      const periodEnd = bill.bill_date;
      const periodStart = billIdx > 0 ? addDays(sortedBills[billIdx - 1].bill_date, 1) : addDays(bill.bill_date, -30);
      return {
        month, monthIndex, status: 'finalized',
        period: label(periodStart, periodEnd), periodLabel: label(periodStart, periodEnd),
        periodStart, periodEnd, billDate: bill.bill_date,
        ceb: cebUnits(bill), ...windowStats(kwhByDate, periodStart, periodEnd)
      };
    }

    if (isCurrentMonth) {
      const provisionalStart = latestBill ? addDays(latestBill.bill_date, 1) : monthStart;
      const periodStart = maxKey(provisionalStart, monthStart);
      const periodEnd = minKey(todayKey, monthEnd);
      return {
        month, monthIndex, status: 'provisional',
        period: label(periodStart, periodEnd), periodLabel: label(periodStart, periodEnd),
        periodStart, periodEnd, billDate: null,
        ceb: null, ...windowStats(kwhByDate, periodStart, periodEnd)
      };
    }

    if (isFutureMonth) {
      return {
        month, monthIndex, status: 'pending', period: 'Pending', periodLabel: 'Pending',
        periodStart: null, periodEnd: null, billDate: null, ceb: null,
        inverter: null, daysPresent: 0, daysInPeriod: 0, completeness: null
      };
    }

    return {
      month, monthIndex, status: 'missing_bill',
      period: label(monthStart, monthEnd), periodLabel: label(monthStart, monthEnd),
      periodStart: monthStart, periodEnd: monthEnd, billDate: null,
      ceb: null, ...windowStats(kwhByDate, monthStart, monthEnd)
    };
  });
}

/** Days between two period boundaries, inclusive; exported for the UI's "x of y days" label. */
export function periodLengthDays(periodStart, periodEnd) {
  return periodStart && periodEnd ? diffDays(periodStart, periodEnd) + 1 : 0;
}
