// tests/billGate.test.js
//
// LR-005 rule 5 (api/_lib/billGate.js). Each check passes, fails or is unknown on its own, and a
// bill is recorded automatically only when all seven pass. The cases follow the spec's worked
// examples (docs/logic-registry/LR-005-email-bill-intake.md). The account number is made up.

import { describe, it, expect } from 'vitest';
import { evaluateBillGate, ratioBoundsFromEnv, GATE_CHECKS } from '../api/_lib/billGate.js';
import { addDays, eachDateKey } from '../shared/domain/time.js';

const SOLAR = '9900112233';
const LATEST = { bill_date: '2036-10-03', meter_reading: 48190 };

/** Inverter kWh for every day of the window 2036-10-04 … 2036-11-03 (31 days), 130 kWh a day. */
function fullInverter(perDay = 130, from = '2036-10-04', to = '2036-11-03') {
  return new Map(eachDateKey(from, to).map((d) => [d, perDay]));
}

/** Everything consistent: worked example 1. 31 days × 130 kWh = 4,030; CEB 3,950 → ratio 0.980. */
function facts(overrides = {}) {
  return {
    bill: {
      account_number: SOLAR,
      billing_month: 'OCT',
      billing_period_start: '2036-10-04',
      billing_period_end: '2036-11-03',
      meter_reading_previous: 48190,
      meter_reading_current: 52140,
      units_exported: 3950
    },
    validation: { status: 'auto_approved', validation_errors: [], notes: [] },
    solarAccount: SOLAR,
    latestBill: LATEST,
    monthAlreadyRecorded: false,
    inverterKwhByDate: fullInverter(),
    ratioBounds: { min: 0.9, max: 1.02 },
    ...overrides
  };
}

const check = (result, id) => result.checks.find((c) => c.id === id);
const withBill = (patch) => facts({ bill: { ...facts().bill, ...patch } });

describe('evaluateBillGate', () => {
  it('passes a consistent bill with complete inverter data and the ratio in bounds (example 1)', () => {
    const r = evaluateBillGate(facts());
    expect(r.pass).toBe(true);
    expect(r.checks.map((c) => c.id)).toEqual([...GATE_CHECKS]);
    expect(r.checks.every((c) => c.ok && !c.unknown)).toBe(true);
    expect(r.window).toEqual({ start: '2036-10-04', end: '2036-11-03', days: 31 });
    expect(check(r, 'units').message).toBe('CEB 3,950 kWh ÷ inverter 4,030 kWh = 0.980');
  });

  describe('extraction (5.1)', () => {
    it('fails when the extractor did not approve, naming only the blocking problems', () => {
      const r = evaluateBillGate(facts({ validation: { status: 'pending_review', validation_errors: ['Earnings do not match units × rate', 'Tariff differs from Settings'], notes: ['Tariff differs from Settings'] } }));
      expect(r.pass).toBe(false);
      expect(check(r, 'extraction')).toMatchObject({ ok: false, unknown: false, message: 'The extractor flagged: Earnings do not match units × rate' });
    });

    it('passes with a note, and hands the note on (example 6: tariff differs from Settings)', () => {
      const r = evaluateBillGate(facts({ validation: { status: 'auto_approved', validation_errors: ['The bill states Rs 37.00/kWh; Settings says Rs 35.00'], notes: ['The bill states Rs 37.00/kWh; Settings says Rs 35.00'] } }));
      expect(r.pass).toBe(true);
      expect(r.notes).toEqual(['The bill states Rs 37.00/kWh; Settings says Rs 35.00']);
    });
  });

  describe('account (5.2)', () => {
    it('fails another account, showing only the last 3 digits', () => {
      const r = evaluateBillGate(withBill({ account_number: '4455667788' }));
      expect(check(r, 'account')).toMatchObject({ ok: false, message: 'Account …788 is not the solar account (…233)' });
      expect(JSON.stringify(r)).not.toContain('4455667788');
      expect(JSON.stringify(r)).not.toContain(SOLAR);
    });

    it('ignores spaces and dashes in either number', () => {
      expect(check(evaluateBillGate(withBill({ account_number: '99 0011-2233' })), 'account').ok).toBe(true);
    });

    it('fails a bill with no account number, and is unknown when the solar account is not configured', () => {
      expect(check(evaluateBillGate(withBill({ account_number: null })), 'account')).toMatchObject({ ok: false, unknown: false });
      expect(check(evaluateBillGate(facts({ solarAccount: '' })), 'account')).toMatchObject({ ok: false, unknown: true });
    });
  });

  describe('new month (5.3)', () => {
    it('fails a month that is already recorded (example 7: a reissue)', () => {
      expect(check(evaluateBillGate(facts({ monthAlreadyRecorded: true })), 'new_month')).toMatchObject({ ok: false, message: 'A bill for OCT is already recorded' });
    });

    it('is unknown when the month could not be read or looked up', () => {
      expect(check(evaluateBillGate(withBill({ billing_month: null })), 'new_month').unknown).toBe(true);
      expect(check(evaluateBillGate(facts({ monthAlreadyRecorded: null })), 'new_month').unknown).toBe(true);
    });
  });

  describe('order (5.3 date, 5.7)', () => {
    it('fails a bill dated on or before the latest bill on record', () => {
      for (const date of ['2036-10-03', '2036-09-03']) {
        const r = evaluateBillGate(withBill({ billing_period_end: date }));
        expect(check(r, 'order')).toMatchObject({ ok: false, unknown: false });
        expect(check(r, 'order').message).toContain('reissued bill goes to review');
      }
    });

    it('fails a bill with no date, and is unknown with no earlier bill on record', () => {
      expect(check(evaluateBillGate(withBill({ billing_period_end: null })), 'order')).toMatchObject({ ok: false, unknown: false });
      expect(check(evaluateBillGate(facts({ latestBill: null })), 'order').unknown).toBe(true);
    });
  });

  describe('continuity (5.4)', () => {
    it('fails when the previous reading differs from the last bill (example 3)', () => {
      const r = evaluateBillGate(withBill({ meter_reading_previous: 48210 }));
      expect(check(r, 'continuity').message).toBe('Meter continuity: bill says previous 48,210, last bill ended at 48,190');
    });

    it('fails a previous reading of 0 or missing (null is not zero, and zero is not a reading)', () => {
      expect(check(evaluateBillGate(withBill({ meter_reading_previous: 0 })), 'continuity')).toMatchObject({ ok: false, unknown: false });
      expect(check(evaluateBillGate(withBill({ meter_reading_previous: null })), 'continuity')).toMatchObject({ ok: false, unknown: false });
    });

    it('is unknown when the last bill has no reading', () => {
      expect(check(evaluateBillGate(facts({ latestBill: { bill_date: '2036-10-03', meter_reading: null } })), 'continuity').unknown).toBe(true);
    });
  });

  describe('period (5.5)', () => {
    it('accepts 25 to 35 days and fails outside', () => {
      const days = (n) => check(evaluateBillGate(withBill({ billing_period_end: addDays('2036-10-03', n) })), 'period').ok;
      expect([24, 25, 35, 36].map(days)).toEqual([false, true, true, false]);
    });
  });

  describe('units (5.6)', () => {
    it('is unknown when any inverter day is missing, and never passes by default (example 8)', () => {
      const inverter = fullInverter();
      inverter.delete('2036-10-10');
      inverter.delete('2036-10-11');
      const r = evaluateBillGate(facts({ inverterKwhByDate: inverter }));
      expect(r.pass).toBe(false);
      expect(check(r, 'units')).toMatchObject({ ok: false, unknown: true, message: 'Units check unknown: inverter data incomplete (2 of 31 days missing)' });
    });

    it('treats a null inverter day as missing, not as zero', () => {
      const inverter = fullInverter();
      inverter.set('2036-10-10', null);
      expect(check(evaluateBillGate(facts({ inverterKwhByDate: inverter })), 'units').unknown).toBe(true);
    });

    it('is unknown when the ratio bounds are not set', () => {
      expect(check(evaluateBillGate(facts({ ratioBounds: null })), 'units')).toMatchObject({ unknown: true });
    });

    it('fails a ratio outside the bounds, saying what it was', () => {
      const r = evaluateBillGate(withBill({ units_exported: 2900 }));
      expect(check(r, 'units')).toMatchObject({ ok: false, unknown: false, message: 'CEB 2,900 kWh ÷ inverter 4,030 kWh = 0.720; expected 0.9 to 1.02' });
    });

    it('accepts a plain object of daily kWh as well as a Map', () => {
      const plain = Object.fromEntries(fullInverter());
      expect(evaluateBillGate(facts({ inverterKwhByDate: plain })).pass).toBe(true);
    });

    it('fails when the inverter recorded nothing for a complete window', () => {
      expect(check(evaluateBillGate(facts({ inverterKwhByDate: fullInverter(0) })), 'units')).toMatchObject({ ok: false, unknown: false });
    });
  });

  it('reports every failing check at once, not only the first', () => {
    const r = evaluateBillGate(facts({ monthAlreadyRecorded: true, bill: { ...facts().bill, meter_reading_previous: 1 } }));
    expect(r.checks.filter((c) => !c.ok).map((c) => c.id)).toEqual(['new_month', 'continuity']);
  });
});

describe('ratioBoundsFromEnv', () => {
  it('reads BILL_RATIO_MIN and BILL_RATIO_MAX, and is null unless 0 < min < max', () => {
    expect(ratioBoundsFromEnv({ BILL_RATIO_MIN: '0.9', BILL_RATIO_MAX: '1.02' })).toEqual({ min: 0.9, max: 1.02 });
    expect(ratioBoundsFromEnv({})).toBeNull();
    expect(ratioBoundsFromEnv({ BILL_RATIO_MIN: '0.9' })).toBeNull();
    expect(ratioBoundsFromEnv({ BILL_RATIO_MIN: '1.1', BILL_RATIO_MAX: '1.0' })).toBeNull();
    expect(ratioBoundsFromEnv({ BILL_RATIO_MIN: '0', BILL_RATIO_MAX: '1' })).toBeNull();
    expect(ratioBoundsFromEnv({ BILL_RATIO_MIN: 'abc', BILL_RATIO_MAX: '1' })).toBeNull();
  });
});
