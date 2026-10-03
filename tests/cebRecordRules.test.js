// tests/cebRecordRules.test.js
//
// `ceb_data` is the canonical billing table. What may be written to it is pinned here.

import { describe, it, expect } from 'vitest';
import { sanitizeRecord, isValidIsoDate } from '../api/_lib/cebRecordRules.js';

const valid = {
  bill_date: '2026-09-03',
  meter_reading: 97597,
  units_exported: 4007,
  earnings: 148259
};

describe('isValidIsoDate', () => {
  it.each(['2026-09-03', '2024-02-29'])('accepts %s', (d) => expect(isValidIsoDate(d)).toBe(true));

  it.each(['2026-02-31', '2025-02-29', '2026-13-01', '26-09-03', '2026-9-3', '', null, 20260903, '2026-09-03T00:00:00Z'])(
    'rejects %s',
    (d) => expect(isValidIsoDate(d)).toBe(false)
  );
});

describe('sanitizeRecord — required fields', () => {
  it('accepts a complete record and coerces numeric strings', () => {
    const { record, errors } = sanitizeRecord({ ...valid, earnings: '148259.50' });
    expect(errors).toEqual([]);
    expect(record.earnings).toBe(148259.5);
  });

  it('reports every missing required field', () => {
    const { errors } = sanitizeRecord({});
    expect(errors).toEqual(
      expect.arrayContaining([
        'bill_date is required',
        'meter_reading is required',
        'units_exported is required',
        'earnings is required'
      ])
    );
  });

  it('accepts a measured zero — only a missing value is rejected', () => {
    const { record, errors } = sanitizeRecord({ ...valid, units_exported: 0, earnings: '0' });
    expect(errors).toEqual([]);
    expect(record.units_exported).toBe(0);
    expect(record.earnings).toBe(0);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty string', '']
  ])('rejects %s as missing rather than storing zero', (_l, v) => {
    expect(sanitizeRecord({ ...valid, units_exported: v }).errors).toContain('units_exported is required');
  });

  it.each([-1, 'abc', NaN, Infinity, 1e12, true, [5], { a: 1 }])('rejects the number %s', (v) => {
    expect(sanitizeRecord({ ...valid, earnings: v }).errors.join(' ')).toMatch(/earnings must be a non-negative number/);
  });

  it.each([['a non-object', 'x'], ['null', null], ['an array', []], ['undefined', undefined]])(
    'rejects %s as the record',
    (_l, v) => {
      expect(sanitizeRecord(v).errors).toEqual(['record must be an object']);
    }
  );
});

describe('sanitizeRecord — dates', () => {
  it('rejects a bill_date that is not a real calendar date', () => {
    expect(sanitizeRecord({ ...valid, bill_date: '2026-02-31' }).errors).toContain(
      'bill_date must be a valid YYYY-MM-DD date'
    );
    expect(sanitizeRecord({ ...valid, bill_date: 'yesterday' }).errors.length).toBe(1);
  });

  it('rejects a period that runs backwards', () => {
    const { errors } = sanitizeRecord({
      ...valid,
      billing_period_start: '2026-09-03',
      billing_period_end: '2026-08-04'
    });
    expect(errors).toContain('billing_period_start must not be after billing_period_end');
  });

  it('treats blank optional dates as not provided', () => {
    const { record, errors } = sanitizeRecord({ ...valid, billing_period_start: '', billing_period_end: null });
    expect(errors).toEqual([]);
    expect(record.billing_period_start).toBeNull();
    expect(record.billing_period_end).toBeNull();
  });
});

describe('sanitizeRecord — optional columns', () => {
  it('copies only whitelisted columns', () => {
    const { record } = sanitizeRecord({ ...valid, id: 5, created_at: 'x', is_admin: true, ingestion_id: null });
    expect(Object.keys(record).sort()).toEqual(
      ['bill_date', 'earnings', 'ingestion_id', 'meter_reading', 'units_exported'].sort()
    );
  });

  it('omits an optional column that was not sent, so an update does not blank it', () => {
    expect('account_number' in sanitizeRecord(valid).record).toBe(false);
  });

  it('rejects an over-long or non-text value', () => {
    expect(sanitizeRecord({ ...valid, account_number: 'x'.repeat(33) }).errors.length).toBe(1);
    expect(sanitizeRecord({ ...valid, file_path: { a: 1 } }).errors.length).toBe(1);
  });

  it('requires ingestion_id to be a UUID', () => {
    expect(sanitizeRecord({ ...valid, ingestion_id: 'not-a-uuid' }).errors).toContain('ingestion_id must be a UUID');
    const id = '123e4567-e89b-12d3-a456-426614174000';
    expect(sanitizeRecord({ ...valid, ingestion_id: id }).record.ingestion_id).toBe(id);
  });
});
