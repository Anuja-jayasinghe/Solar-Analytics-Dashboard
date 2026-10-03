// api/_lib/cebRecordRules.js
//
// Validation for a `ceb_data` record arriving at /api/ceb-bills/records.
//
// `ceb_data` is the canonical billing table: every earnings figure and every CEB-versus-inverter
// comparison reads it. The handler previously coerced the numbers but passed `bill_date` through
// as any string and copied the optional columns without looking at their type, so a malformed
// value reached Postgres and came back as an opaque 500 — or, worse, was stored.
//
// Kept apart from the handler so it can be unit-tested without a database.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NUMERIC_FIELDS = ['meter_reading', 'units_exported', 'earnings'];
// Nothing real is near this; it catches a pasted account number or an unscaled figure.
const MAX_NUMERIC = 1e9;

/** A real calendar date in YYYY-MM-DD form (rejects 2026-02-31, which Date would roll over). */
export function isValidIsoDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const isBlank = (v) => v === undefined || v === null || v === '';

/**
 * Whitelist, validate and coerce the incoming record.
 *
 * A zero is a real measurement and is accepted; only a missing value is rejected.
 *
 * @param {unknown} input
 * @returns {{ record: object, errors: string[] }}
 */
export function sanitizeRecord(input) {
  const errors = [];
  const record = {};

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { record, errors: ['record must be an object'] };
  }

  if (isBlank(input.bill_date)) errors.push('bill_date is required');
  else if (!isValidIsoDate(input.bill_date)) errors.push('bill_date must be a valid YYYY-MM-DD date');
  else record.bill_date = input.bill_date;

  for (const field of NUMERIC_FIELDS) {
    if (isBlank(input[field])) {
      errors.push(`${field} is required`);
      continue;
    }
    // Number(true) is 1 and Number([5]) is 5 — accept only real numbers and numeric strings.
    if (typeof input[field] !== 'number' && typeof input[field] !== 'string') {
      errors.push(`${field} must be a non-negative number`);
      continue;
    }
    const n = Number(input[field]);
    if (!Number.isFinite(n) || n < 0 || n > MAX_NUMERIC) {
      errors.push(`${field} must be a non-negative number`);
      continue;
    }
    record[field] = n;
  }

  // Optional dates: a value, or blank meaning "not provided".
  for (const field of ['billing_period_start', 'billing_period_end']) {
    if (input[field] === undefined) continue;
    if (isBlank(input[field])) record[field] = null;
    else if (!isValidIsoDate(input[field])) errors.push(`${field} must be a valid YYYY-MM-DD date`);
    else record[field] = input[field];
  }
  if (record.billing_period_start && record.billing_period_end && record.billing_period_start > record.billing_period_end) {
    errors.push('billing_period_start must not be after billing_period_end');
  }

  // Optional text columns, with a length cap.
  const TEXT_LIMITS = { account_number: 32, billing_month: 32, data_source: 64, file_path: 512 };
  for (const [field, max] of Object.entries(TEXT_LIMITS)) {
    if (input[field] === undefined) continue;
    if (isBlank(input[field])) record[field] = null;
    else if (typeof input[field] !== 'string' || input[field].length > max) {
      errors.push(`${field} must be text of at most ${max} characters`);
    } else record[field] = input[field];
  }

  if (input.ingestion_id !== undefined) {
    if (isBlank(input.ingestion_id)) record.ingestion_id = null;
    else if (typeof input.ingestion_id !== 'string' || !UUID_RE.test(input.ingestion_id)) {
      errors.push('ingestion_id must be a UUID');
    } else record.ingestion_id = input.ingestion_id;
  }

  return { record, errors };
}
