// tests/cebBillParser.test.js
//
// The CEB bill extractor is the piece that broke when the electricity company redesigned the
// bill — and it went unnoticed for months because there was no way to exercise it except
// uploading a real PDF to production. These tests give it a floor.
//
// ⚠️  About the fixture: `tests/fixtures/ceb-bill-legacy.txt` is a RECONSTRUCTION of the
// pre-2026 bill's extracted text, rebuilt from the anchors documented in the parser and the
// worked values in the original code comments. It is not a real customer bill, and it does
// not contain real account data. It is good enough to pin the parsing contract; when a real
// new-format bill is available, add its pdf-parse output as a second fixture and extend the
// "new format" block below with the real expectations.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import {
  parseCebBillText,
  extractMeterReadings,
  validateExtraction
} from '../api/_lib/cebBillParser.js';

const here = dirname(fileURLToPath(import.meta.url));
const legacyBill = readFileSync(join(here, 'fixtures', 'ceb-bill-legacy.txt'), 'utf8');

describe('parseCebBillText — legacy (pre-2026) bill layout', () => {
  const parsed = parseCebBillText(legacyBill);

  it('extracts the account number', () => {
    expect(parsed.account_number).toBe('4924089702');
  });

  it('extracts the billing month, uppercased', () => {
    expect(parsed.billing_month).toBe('2024 SEP');
  });

  it('extracts the bill issue date', () => {
    expect(parsed.bill_issue_date).toBe('9/5/2024');
  });

  it('extracts units exported', () => {
    expect(parsed.units_exported).toBe(3676);
  });

  it('strips thousands separators from earnings', () => {
    expect(parsed.earnings).toBe(136012.0);
  });

  it('derives the billing period from the meter-reading dates', () => {
    expect(parsed.billing_period_start).toBe('2024-08-06');
    expect(parsed.billing_period_end).toBe('2024-09-05');
  });

  it('takes the oldest reading as previous and the newest as current', () => {
    expect(parsed.meter_reading_previous).toBe(3);
    expect(parsed.meter_reading_current).toBe(3679);
  });
});

describe('extractMeterReadings', () => {
  it('returns readings sorted oldest first regardless of their order in the text', () => {
    const scrambled = '\t500\t2024-09-05\n\t100\t2024-08-06\n\t300\t2024-08-20\n';
    expect(extractMeterReadings(scrambled)).toEqual([
      { reading: 100, date: '2024-08-06' },
      { reading: 300, date: '2024-08-20' },
      { reading: 500, date: '2024-09-05' }
    ]);
  });

  it('is stateless across calls — the global regex must not leak lastIndex', () => {
    const text = '\t100\t2024-08-06\n\t200\t2024-09-05\n';
    expect(extractMeterReadings(text)).toHaveLength(2);
    expect(extractMeterReadings(text)).toHaveLength(2); // would be 0 if lastIndex persisted
  });

  it('finds nothing when the table is not tab-delimited', () => {
    // The single most fragile assumption in the parser: cells separated by literal tabs.
    const spaceDelimited = '  100  2024-08-06\n  200  2024-09-05\n';
    expect(extractMeterReadings(spaceDelimited)).toEqual([]);
  });
});

describe('parseCebBillText — failure behaviour', () => {
  it('returns a fully-null shape for empty input rather than throwing', () => {
    const parsed = parseCebBillText('');
    expect(parsed.account_number).toBeNull();
    expect(parsed.units_exported).toBe(0);
    expect(parsed.meter_reading_current).toBe(0);
  });

  it('returns a fully-null shape for non-string input', () => {
    expect(() => parseCebBillText(null)).not.toThrow();
    expect(parseCebBillText(null).billing_month).toBeNull();
  });

  it('degrades to zeros — never partial garbage — when the labels change', () => {
    // This is what a redesigned bill looks like to the current parser: the numbers are all
    // present, but under different wording, so every anchor misses.
    const newFormat = [
      'Account Number 4924089702',
      'Statement Date 05-Sep-2026',
      'Billing Period SEP 2026',
      'Units Exported to Grid 3676 kWh',
      'Export Credit Rs 136,012.00'
    ].join('\n');

    const parsed = parseCebBillText(newFormat);
    expect(parsed.account_number).toBeNull();
    expect(parsed.units_exported).toBe(0);
    expect(parsed.earnings).toBe(0);
    expect(parsed.meter_reading_current).toBe(0);
  });
});

describe('validateExtraction', () => {
  const good = {
    account_number: '4924089702',
    billing_month: '2024 SEP',
    billing_period_start: '2024-08-06',
    billing_period_end: '2024-09-05',
    units_exported: 100,
    earnings: 3700,
    meter_reading_current: 1100,
    meter_reading_previous: 1000
  };

  it('auto-approves a clean, internally consistent extraction', () => {
    const result = validateExtraction(good, 37);
    expect(result.status).toBe('auto_approved');
    expect(result.validation_errors).toEqual([]);
    expect(result.confidence_score).toBe(100);
  });

  it('routes a failed parse to human review rather than saving zeros', () => {
    const result = validateExtraction(parseCebBillText(''), 37);
    expect(result.status).toBe('pending_review');
    expect(result.validation_errors.length).toBeGreaterThan(0);
  });

  it('flags a tariff mismatch and docks confidence', () => {
    const result = validateExtraction({ ...good, earnings: 9999 }, 37);
    expect(result.status).toBe('pending_review');
    expect(result.validation_errors.join(' ')).toMatch(/Math mismatch/);
    expect(result.confidence_score).toBeLessThan(100);
  });

  it('flags a meter delta that disagrees with the exported units', () => {
    const result = validateExtraction({ ...good, meter_reading_current: 1234 }, 37);
    expect(result.validation_errors.join(' ')).toMatch(/Meter mismatch/);
  });

  it('flags a billing period that runs backwards', () => {
    const result = validateExtraction(
      { ...good, billing_period_start: '2024-09-05', billing_period_end: '2024-08-06' },
      37
    );
    expect(result.validation_errors.join(' ')).toMatch(/Timeline error/);
  });

  it('honours a changed tariff — a flat-rate assumption the new bill may break', () => {
    // Same bill, different rate: what used to validate now does not. Documents the coupling
    // so that a tiered/TOU export tariff is recognised as a validation problem rather than
    // mistaken for a parsing failure.
    expect(validateExtraction(good, 37).status).toBe('auto_approved');
    expect(validateExtraction(good, 45).status).toBe('pending_review');
  });
});
