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
// The open period (no bill yet) runs from the day after the latest bill to today, whatever the
// calendar says: bill date to bill date, never "since the 1st". It belongs to the month the NEXT
// bill will report, which is the month of the latest bill (a bill dated 3 Oct reports September,
// so the bill due in November reports October, the open period).
//
// Why a second implementation next to src/lib/dataService.js? That one is written with local
// `Date` objects, so its answers depend on the machine's timezone: right in a Colombo browser,
// subtly wrong on a UTC server (Vercel). This one uses only 'YYYY-MM-DD' strings and integer
// arithmetic, so the API and the browser compute identical rows anywhere.
//
// Intentional differences from v1:
//   * a window with NO daily data reports inverter = null (v1 reported 0, which reads as a
//     measured zero), and every row carries daysPresent / daysInPeriod / completeness;
//   * a bill whose units_exported is null reports ceb = null (v1 coerced it to 0);
//   * the open period starts the day after the latest bill. v1 clipped it to the 1st of the
//     current month, so between the 1st and the next bill it dropped days and filed the open
//     period under the wrong month, and the month before showed "missing bill";
//   * months after the open period's month are pending, even when they are in the past;
//   * a past month with no bill counts only days that no bill period covers. v1 used the whole
//     calendar month, so days inside a later bill's period were counted twice.
// Everything else matches v1 for complete data; tests/alignment.test.js proves it.

import { addDays, diffDays, eachDateKey } from './time.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad2 = (n) => String(n).padStart(2, '0');
const fmt = (key) => `${key.slice(8, 10)}/${key.slice(5, 7)}/${key.slice(0, 4)}`;
const label = (a, b) => `${fmt(a)} – ${fmt(b)}`;
const minKey = (a, b) => (a < b ? a : b);
/** Months since year 0, so months compare across years: '2026-10-03' -> 2026 * 12 + 9. */
const monthOrdinal = (key) => Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7)) - 1;

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

function dailyKwhMap(dailyRows) {
  const kwhByDate = new Map();
  for (const r of dailyRows ?? []) {
    if (r && typeof r.kwh === 'number' && Number.isFinite(r.kwh) && r.kwh >= 0) kwhByDate.set(r.date, r.kwh);
  }
  return kwhByDate;
}

function sortBills(bills) {
  return [...(bills ?? [])]
    .filter((b) => typeof b?.bill_date === 'string')
    .sort((a, b) => (a.bill_date < b.bill_date ? -1 : a.bill_date > b.bill_date ? 1 : 0));
}

/**
 * The open window: the day after the latest bill to today, filed under the month of that bill.
 * With no bill at all there is nothing to anchor on, so it is the current month so far.
 */
function openWindow(sortedBills, todayKey) {
  const latest = sortedBills.length ? sortedBills[sortedBills.length - 1] : null;
  if (latest) {
    return { periodStart: addDays(latest.bill_date, 1), periodEnd: todayKey, ordinal: monthOrdinal(latest.bill_date), lastBillDate: latest.bill_date };
  }
  return { periodStart: `${todayKey.slice(0, 7)}-01`, periodEnd: todayKey, ordinal: monthOrdinal(todayKey), lastBillDate: null };
}

const cebUnits = (bill) => {
  if (bill.units_exported === null || bill.units_exported === undefined || bill.units_exported === '') return null;
  const n = Number(bill.units_exported);
  return Number.isFinite(n) ? n : null;
};

/**
 * The open (provisional) bill period, independent of any calendar year, so it is right across New Year.
 * @param {object} a
 * @param {{date:string, kwh:number|null}[]} a.dailyRows   must cover [periodStart, todayKey]
 * @param {{bill_date:string}[]} a.bills  ceb_data
 * @param {string} a.todayKey    today's Colombo date key (the caller owns the clock)
 * @returns {{month:string, monthIndex:number, year:number, status:'provisional', periodStart:string, periodEnd:string,
 *   lastBillDate:string|null, inverter:number|null, daysPresent:number, daysInPeriod:number, completeness:number|null}}
 */
export function openBillPeriod({ dailyRows, bills, todayKey }) {
  const open = openWindow(sortBills(bills), todayKey);
  const monthIndex = open.ordinal % 12;
  return {
    month: MONTHS[monthIndex], monthIndex, year: Math.floor(open.ordinal / 12), status: 'provisional',
    periodStart: open.periodStart, periodEnd: open.periodEnd, lastBillDate: open.lastBillDate,
    ...windowStats(dailyKwhMap(dailyRows), open.periodStart, open.periodEnd)
  };
}

/**
 * @param {object} a
 * @param {number} a.year
 * @param {{date:string, kwh:number|null}[]} a.dailyRows   inverter_data_daily_summary
 * @param {{bill_date:string, units_exported:number|null}[]} a.bills  ceb_data
 * @param {string} a.todayKey    today's Colombo date key (the caller owns the clock)
 */
export function buildAlignedRows({ year, dailyRows, bills, todayKey }) {
  const kwhByDate = dailyKwhMap(dailyRows);
  const sortedBills = sortBills(bills);
  const open = openWindow(sortedBills, todayKey);
  const todayOrdinal = monthOrdinal(todayKey);
  // Bill periods and the open period together run without a gap from here to today.
  const coveredFrom = sortedBills.length ? addDays(sortedBills[0].bill_date, -30) : open.periodStart;

  return Array.from({ length: 12 }, (_, monthIndex) => {
    const monthStart = `${year}-${pad2(monthIndex + 1)}-01`;
    const monthEnd = lastDayOfMonth(year, monthIndex);
    const month = MONTHS[monthIndex];
    const ordinal = year * 12 + monthIndex;

    const billMonth = (monthIndex + 1) % 12;
    const billYear = year + (monthIndex === 11 ? 1 : 0);
    const billIdx = sortedBills.findIndex(
      (b) => Number(b.bill_date.slice(5, 7)) - 1 === billMonth && Number(b.bill_date.slice(0, 4)) === billYear
    );

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

    if (ordinal === open.ordinal) {
      return {
        month, monthIndex, status: 'provisional',
        period: label(open.periodStart, open.periodEnd), periodLabel: label(open.periodStart, open.periodEnd),
        periodStart: open.periodStart, periodEnd: open.periodEnd, billDate: null,
        ceb: null, ...windowStats(kwhByDate, open.periodStart, open.periodEnd)
      };
    }

    if (ordinal > open.ordinal) {
      // The open period already holds every day since the latest bill; nothing is counted here.
      const text = ordinal >= todayOrdinal ? 'Pending' : 'Awaiting bill';
      return {
        month, monthIndex, status: 'pending', period: text, periodLabel: text,
        periodStart: null, periodEnd: null, billDate: null, ceb: null,
        inverter: null, daysPresent: 0, daysInPeriod: 0, completeness: null
      };
    }

    // A past month with no bill: only the days no bill period covers, so no day is counted twice.
    const end = minKey(monthEnd, addDays(coveredFrom, -1));
    if (monthStart > end) {
      return {
        month, monthIndex, status: 'missing_bill',
        period: 'Covered by a later bill', periodLabel: 'Covered by a later bill',
        periodStart: null, periodEnd: null, billDate: null, ceb: null,
        inverter: null, daysPresent: 0, daysInPeriod: 0, completeness: null
      };
    }
    return {
      month, monthIndex, status: 'missing_bill',
      period: label(monthStart, end), periodLabel: label(monthStart, end),
      periodStart: monthStart, periodEnd: end, billDate: null,
      ceb: null, ...windowStats(kwhByDate, monthStart, end)
    };
  });
}

/** Days between two period boundaries, inclusive; exported for the UI's "x of y days" label. */
export function periodLengthDays(periodStart, periodEnd) {
  return periodStart && periodEnd ? diffDays(periodStart, periodEnd) + 1 : 0;
}
