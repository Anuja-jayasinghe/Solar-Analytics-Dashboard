// api/_lib/billGate.js
//
// LR-005 rule 5: may a bill that arrived by email be recorded without a person?
// Spec: docs/logic-registry/LR-005-email-bill-intake.md   Tests: tests/billGate.test.js
//
// Pure: no database, no clock, no environment. The caller gathers the facts (the latest bill on record,
// whether this month is already recorded, the inverter's daily kWh) and this decides. A bill is recorded
// automatically only when EVERY check passes. A check that cannot be decided is `unknown`, and unknown
// is a failure: it never passes by default.
//
// The checks, in the order a reviewer reads them:
//   extraction  validateExtraction() said auto_approved: fields found, units × rate = earnings,
//               meter delta = units, period start before end                        (5.1)
//   account     the bill's account is the solar account (SOLAR_CEB_ACCOUNT)          (5.2)
//   new_month   no bill for this billing month is recorded yet                       (5.3)
//   order       the bill date is after the latest bill on record. This is both halves of 5.3's
//               date condition and 5.7: a backfilled, corrected or reissued bill goes to review.
//   continuity  the bill's previous meter reading equals the latest bill's reading   (5.4)
//   period      LR-001's window (latest bill date + 1 … this bill date) is 25–35 days (5.5)
//   units       with inverter data for every day of that window, CEB units ÷ inverter kWh is
//               within the configured bounds                                         (5.6)
//
// Messages never carry more than the last 3 digits of an account number.

import { addDays, diffDays, eachDateKey, isDateKey } from '../../shared/domain/time.js';

export const PERIOD_DAYS = Object.freeze({ min: 25, max: 35 });

/** Check ids, in the order they are reported. */
export const GATE_CHECKS = Object.freeze(['extraction', 'account', 'new_month', 'order', 'continuity', 'period', 'units']);

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const fmt = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
const normAccount = (v) => (v === null || v === undefined ? '' : String(v).replace(/[\s-]/g, ''));
const tail = (account) => `…${normAccount(account).slice(-3)}`;

const pass = (id, message) => ({ id, ok: true, unknown: false, message });
const fail = (id, message) => ({ id, ok: false, unknown: false, message });
const unknown = (id, message) => ({ id, ok: false, unknown: true, message });

/**
 * Ratio bounds from the environment: BILL_RATIO_MIN and BILL_RATIO_MAX, both numbers, 0 < min < max.
 * null when unset or invalid, which makes the units check unknown (so nothing is recorded automatically).
 */
export function ratioBoundsFromEnv(env = {}) {
  const min = Number(env.BILL_RATIO_MIN);
  const max = Number(env.BILL_RATIO_MAX);
  if (!env.BILL_RATIO_MIN || !env.BILL_RATIO_MAX) return null;
  return Number.isFinite(min) && Number.isFinite(max) && min > 0 && min < max ? { min, max } : null;
}

/**
 * @param {object} facts
 * @param {object} facts.bill        parser output (api/_lib/cebBillParser.js#parseCebBillText). The bill date is
 *                                   `billing_period_end`, as the admin approve uses it (src/v3/admin/billForm.js).
 * @param {object} facts.validation  validateExtraction() result
 * @param {string|null} facts.solarAccount         SOLAR_CEB_ACCOUNT
 * @param {{bill_date: string, meter_reading: number}|null} facts.latestBill  newest ceb_data row for the account
 * @param {boolean|null} facts.monthAlreadyRecorded a ceb_data row exists for (account, billing_month); null = could not tell
 * @param {Map<string, number>|Record<string, number>} facts.inverterKwhByDate  daily kWh, only days that have data
 * @param {{min: number, max: number}|null} facts.ratioBounds
 * @returns {{ pass: boolean, checks: Array<{id, ok, unknown, message}>, notes: string[],
 *             window: {start: string, end: string, days: number} | null }}
 */
export function evaluateBillGate({ bill = {}, validation = {}, solarAccount = null, latestBill = null, monthAlreadyRecorded = null, inverterKwhByDate = new Map(), ratioBounds = null }) {
  const kwhOf = inverterKwhByDate instanceof Map ? (d) => inverterKwhByDate.get(d) : (d) => inverterKwhByDate[d];
  const billDate = isDateKey(bill.billing_period_end) ? bill.billing_period_end : null;
  const latestDate = isDateKey(latestBill?.bill_date) ? latestBill.bill_date : null;
  const window = billDate && latestDate && billDate > latestDate
    ? { start: addDays(latestDate, 1), end: billDate, days: diffDays(latestDate, billDate) }
    : null;

  const checks = [];

  // 5.1 extraction
  const notes = Array.isArray(validation.notes) ? validation.notes : [];
  if (validation.status === 'auto_approved') {
    checks.push(pass('extraction', 'All fields found, and the bill\'s own figures agree'));
  } else {
    const blocking = (validation.validation_errors ?? []).filter((e) => !notes.includes(e));
    checks.push(fail('extraction', blocking.length ? `The extractor flagged: ${blocking.join('; ')}` : 'The extractor did not approve this bill'));
  }

  // 5.2 account
  if (!normAccount(solarAccount)) {
    checks.push(unknown('account', 'The solar account (SOLAR_CEB_ACCOUNT) is not set'));
  } else if (!normAccount(bill.account_number)) {
    checks.push(fail('account', 'No account number was found on the bill'));
  } else if (normAccount(bill.account_number) !== normAccount(solarAccount)) {
    checks.push(fail('account', `Account ${tail(bill.account_number)} is not the solar account (${tail(solarAccount)})`));
  } else {
    checks.push(pass('account', `Solar account ${tail(solarAccount)}`));
  }

  // 5.3 new month
  if (!bill.billing_month) {
    checks.push(unknown('new_month', 'No billing month was found on the bill'));
  } else if (monthAlreadyRecorded === null) {
    checks.push(unknown('new_month', `Could not check whether ${bill.billing_month} is already recorded`));
  } else if (monthAlreadyRecorded) {
    checks.push(fail('new_month', `A bill for ${bill.billing_month} is already recorded`));
  } else {
    checks.push(pass('new_month', `No bill for ${bill.billing_month} is recorded yet`));
  }

  // 5.3 (date) + 5.7 order
  if (!billDate) {
    checks.push(fail('order', 'No bill date (period end) was found on the bill'));
  } else if (!latestDate) {
    checks.push(unknown('order', 'There is no earlier bill on record to compare with'));
  } else if (billDate <= latestDate) {
    checks.push(fail('order', `Bill date ${billDate} is not after the latest bill on record (${latestDate}). A backfilled, corrected or reissued bill goes to review`));
  } else {
    checks.push(pass('order', `Bill date ${billDate} follows the latest bill (${latestDate})`));
  }

  // 5.4 continuity
  const previous = num(bill.meter_reading_previous);
  const lastReading = num(latestBill?.meter_reading);
  if (!previous) {
    checks.push(fail('continuity', 'The bill shows no previous meter reading'));
  } else if (lastReading === null) {
    checks.push(unknown('continuity', 'The latest bill on record has no meter reading to compare with'));
  } else if (previous !== lastReading) {
    checks.push(fail('continuity', `Meter continuity: bill says previous ${fmt(previous)}, last bill ended at ${fmt(lastReading)}`));
  } else {
    checks.push(pass('continuity', `Previous reading ${fmt(previous)} matches the last bill`));
  }

  // 5.5 period
  if (!window) {
    checks.push(unknown('period', 'The billing period cannot be measured without a later bill date than the latest bill'));
  } else if (window.days < PERIOD_DAYS.min || window.days > PERIOD_DAYS.max) {
    checks.push(fail('period', `The period is ${window.days} days; expected ${PERIOD_DAYS.min} to ${PERIOD_DAYS.max}`));
  } else {
    checks.push(pass('period', `The period is ${window.days} days`));
  }

  // 5.6 units
  const units = num(bill.units_exported);
  if (!window) {
    checks.push(unknown('units', 'Units check unknown: no billing period to compare with the inverter'));
  } else {
    const dates = eachDateKey(window.start, window.end);
    const missing = dates.filter((d) => num(kwhOf(d)) === null).length;
    if (missing > 0) {
      checks.push(unknown('units', `Units check unknown: inverter data incomplete (${missing} of ${dates.length} days missing)`));
    } else if (!ratioBounds) {
      checks.push(unknown('units', 'Units check unknown: the ratio bounds (BILL_RATIO_MIN, BILL_RATIO_MAX) are not set'));
    } else if (units === null) {
      checks.push(fail('units', 'No exported units were found on the bill'));
    } else {
      const inverterKwh = dates.reduce((sum, d) => sum + kwhOf(d), 0);
      if (!(inverterKwh > 0)) {
        checks.push(fail('units', `The inverter recorded ${fmt(inverterKwh)} kWh for the period`));
      } else {
        const ratio = units / inverterKwh;
        const detail = `CEB ${fmt(units)} kWh ÷ inverter ${fmt(inverterKwh)} kWh = ${ratio.toFixed(3)}`;
        if (ratio < ratioBounds.min || ratio > ratioBounds.max) {
          checks.push(fail('units', `${detail}; expected ${ratioBounds.min} to ${ratioBounds.max}`));
        } else {
          checks.push(pass('units', detail));
        }
      }
    }
  }

  return { pass: checks.every((c) => c.ok), checks, notes, window };
}
