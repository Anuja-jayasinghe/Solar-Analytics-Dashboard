// shared/domain/billSchedule.js
//
// LR-005 rule 9: has the monthly CEB (EDL) bill failed to arrive? Pure, so the rule is tested
// (tests/billSchedule.test.js); scripts/check_missing_bill.js feeds it rows and acts on the verdict.
//
// Bills come roughly monthly, but not on a fixed day. The expected date is the latest bill date plus
// the MEDIAN of the recent gaps between bills (a median, so one late or early bill does not move it).
// The alert fires a grace period after that, and only when nothing is waiting in the review queue:
// a bill that arrived but is not yet approved is not missing.
//
// Why it matters: once bills arrive by email (LR-005), a broken Gmail filter, a changed sender
// address, or a paused forward would stop bills silently. This turns that silence into an alert.

import { addDays, diffDays, isDateKey } from './time.js';

export const BILL_GRACE_DAYS = 7;
/** Gaps between the most recent bills that set the expected interval. */
export const BILL_GAPS_USED = 6;

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * @param {object} a
 * @param {string[]} a.billDates          ceb_data.bill_date values ('YYYY-MM-DD'), any order
 * @param {number} a.pendingIngestions    uploads received since the latest bill and not yet approved
 * @param {string} a.todayKey             today's Colombo date key
 * @param {number} [a.graceDays]
 * @returns {{ name: string, ok: boolean, skipped?: boolean, latest?: string, expected?: string,
 *             alertAfter?: string, intervalDays?: number, daysLate?: number, reason?: string }}
 */
export function evaluateBillArrival({ billDates, pendingIngestions, todayKey, graceDays = BILL_GRACE_DAYS }) {
  const name = 'ceb_bill';
  const dates = [...new Set((billDates ?? []).filter(isDateKey))].sort();
  if (dates.length < 2) {
    return { name, ok: true, skipped: true, reason: 'fewer than two bills on record, so there is no interval to expect' };
  }

  const recent = dates.slice(-(BILL_GAPS_USED + 1));
  const gaps = recent.slice(1).map((d, i) => diffDays(recent[i], d));
  const intervalDays = median(gaps);
  const latest = dates[dates.length - 1];
  const expected = addDays(latest, intervalDays);
  const alertAfter = addDays(expected, graceDays);
  const base = { name, latest, expected, alertAfter, intervalDays };

  if (todayKey <= alertAfter) return { ...base, ok: true };
  if (pendingIngestions > 0) {
    return { ...base, ok: true, reason: `${pendingIngestions} uploaded bill(s) waiting in the review queue` };
  }
  const daysLate = diffDays(expected, todayKey);
  return {
    ...base, ok: false, daysLate,
    reason: `no bill since ${latest}; the next was expected around ${expected} (every ~${intervalDays} days) and is ${daysLate} days late`
  };
}
