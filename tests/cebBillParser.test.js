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
  extractBillIssueDate,
  validateExtraction
} from '../api/_lib/cebBillParser.js';

const here = dirname(fileURLToPath(import.meta.url));
const legacyBill = readFileSync(join(here, 'fixtures', 'ceb-bill-legacy.txt'), 'utf8');
// Real 2026 `ebill-edl-v.1.0.2` bill, redacted: name, address and phone replaced, every
// number and the whole structure preserved exactly as pdf-parse emits it.
const bill2026 = readFileSync(join(here, 'fixtures', 'ceb-bill-2026.txt'), 'utf8');

describe('parseCebBillText — legacy (pre-2026) bill layout', () => {
  const parsed = parseCebBillText(legacyBill);

  it('extracts the account number', () => {
    expect(parsed.account_number).toBe('4924089702');
  });

  it('extracts the billing month, uppercased', () => {
    expect(parsed.billing_month).toBe('2024 SEP');
  });

  it('extracts the bill issue date', () => {
    expect(parsed.bill_issue_date).toBe('2024-09-05'); // normalised from M/D/YYYY
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

  it('degrades to zeros — never partial garbage — if every label were to change', () => {
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

// ---------------------------------------------------------------------------
// The 2026 redesign
//
// CEB reissued the bill as `ebill-edl-v.1.0.2` with a different layout. This was assumed to
// have broken extraction wholesale. It did not: of the six anchors, five still matched, and
// the only casualty was the "Bill Date:" label. The new format also ADDS two useful fields.
//
// These tests pin both formats so the next redesign is caught here rather than in production.
// ---------------------------------------------------------------------------

describe('parseCebBillText — 2026 redesigned bill', () => {
  const parsed = parseCebBillText(bill2026);

  it('still finds the account number despite the trailing region code', () => {
    // "Electricity A/C No.: 4924089702\tWPN"
    expect(parsed.account_number).toBe('4924089702');
  });

  it('still finds the billing month', () => {
    expect(parsed.billing_month).toBe('2026 SEP');
  });

  it('recovers the issue date from the bill reference, which replaced "Bill Date:"', () => {
    // "Bill Ref: 457-4924089702-20260903082730"
    expect(parsed.bill_issue_date).toBe('2026-09-03');
  });

  it('still finds units exported and earnings', () => {
    expect(parsed.units_exported).toBe(4007);
    expect(parsed.earnings).toBe(148259.0);
  });

  it('still reads the tab-delimited meter table', () => {
    expect(parsed.meter_reading_previous).toBe(93590);
    expect(parsed.meter_reading_current).toBe(97597);
    expect(parsed.billing_period_start).toBe('2026-08-04');
    expect(parsed.billing_period_end).toBe('2026-09-03');
  });

  it('extracts the export rate the bill now states', () => {
    expect(parsed.export_rate).toBe(37.0);
  });

  it('extracts units consumed, which the old format did not report here', () => {
    expect(parsed.units_consumed).toBe(5);
  });

  it('is internally consistent: meter delta equals units exported', () => {
    expect(parsed.meter_reading_current - parsed.meter_reading_previous).toBe(parsed.units_exported);
  });

  it('is internally consistent: units × stated rate equals earnings', () => {
    expect(parsed.units_exported * parsed.export_rate).toBeCloseTo(parsed.earnings, 2);
  });

  it('auto-approves at full confidence', () => {
    const result = validateExtraction(parsed, 37.0);
    expect(result.status).toBe('auto_approved');
    expect(result.confidence_score).toBe(100);
    expect(result.validation_errors).toEqual([]);
  });
});

describe('validateExtraction — tariff taken from the bill', () => {
  const parsed = parseCebBillText(bill2026);

  it('validates against the bill’s own rate, not system_settings', () => {
    // system_settings is wrong/stale here. The bill says 37.00 and its maths is consistent,
    // so this must still pass — previously a stale setting looked identical to a parse
    // failure, and every bill would have been flagged for review.
    const result = validateExtraction(parsed, 99.0);
    expect(result.status).toBe('auto_approved');
    expect(result.validation_errors.join(' ')).not.toMatch(/Math mismatch/);
  });

  it('surfaces a tariff change as a note without blocking approval', () => {
    const result = validateExtraction(parsed, 99.0);
    expect(result.validation_errors.join(' ')).toMatch(/Tariff changed/);
  });

  it('says nothing about tariffs when the setting agrees with the bill', () => {
    const result = validateExtraction(parsed, 37.0);
    expect(result.validation_errors.join(' ')).not.toMatch(/Tariff changed/);
  });

  it('falls back to system_settings for older bills that omit the rate', () => {
    const legacy = parseCebBillText(legacyBill);
    expect(legacy.export_rate).toBeNull();
    expect(validateExtraction(legacy, 37.0).status).toBe('auto_approved');
    expect(validateExtraction(legacy, 45.0).status).toBe('pending_review');
  });
});

describe('extractBillIssueDate', () => {
  it('reads the legacy "Bill Date: M/D/YYYY" label and normalises it', () => {
    expect(extractBillIssueDate('Bill Date: 9/5/2024 9:59:05 AM')).toBe('2024-09-05');
  });

  it('reads the 2026 bill reference', () => {
    expect(extractBillIssueDate('Bill Ref: 457-4924089702-20260903082730')).toBe('2026-09-03');
  });

  it('prefers the explicit label when a bill somehow carries both', () => {
    const both = 'Bill Ref: 457-4924089702-20260903082730\nBill Date: 1/2/2020 0:00:00 AM';
    expect(extractBillIssueDate(both)).toBe('2020-01-02');
  });

  it('returns null when neither is present', () => {
    expect(extractBillIssueDate('no date here')).toBeNull();
  });
});
