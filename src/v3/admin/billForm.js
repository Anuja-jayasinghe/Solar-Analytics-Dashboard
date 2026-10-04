// src/v3/admin/billForm.js
//
// Reviewing an extracted CEB bill. The extractor returns what it could read (a figure it could not read is
// null, a printed 0 is 0). The admin confirms or corrects, and the SERVER validates again on approval.
// Rules kept here: null is shown as an empty box (never 0), a blank required field blocks Approve, and the
// record sent is exactly the fields the records endpoint accepts.

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export const BILL_FIELDS = Object.freeze([
  { key: 'billing_period_start', label: 'Period start', type: 'date', required: true },
  { key: 'billing_period_end', label: 'Period end (bill date)', type: 'date', required: true },
  { key: 'meter_reading', label: 'Meter reading', type: 'number', required: true },
  { key: 'units_exported', label: 'Units exported (kWh)', type: 'number', required: true },
  { key: 'earnings', label: 'Earnings (LKR)', type: 'number', required: true }
]);

/** A figure the parser did not find is '' (blank); a figure it read as 0 stays '0'. */
const text = (v) => (v === null || v === undefined ? '' : String(v));

/** Extraction row -> editable text draft. */
export function toBillDraft(extraction) {
  return {
    billing_period_start: text(extraction?.billing_period_start),
    billing_period_end: text(extraction?.billing_period_end),
    meter_reading: text(extraction?.meter_reading),
    units_exported: text(extraction?.units_exported),
    earnings: text(extraction?.earnings)
  };
}

const isDateKey = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** Problems with the draft, keyed by field. */
export function validateBillDraft(draft) {
  const errors = {};
  for (const f of BILL_FIELDS) {
    const v = (draft?.[f.key] ?? '').trim();
    if (v === '') { errors[f.key] = 'Required'; continue; }
    if (f.type === 'date' && !isDateKey(v)) errors[f.key] = 'Use a date like 2036-09-03';
    if (f.type === 'number' && !(Number.isFinite(Number(v)) && Number(v) >= 0)) errors[f.key] = 'Must be a number, zero or more';
  }
  if (!errors.billing_period_start && !errors.billing_period_end && draft.billing_period_start >= draft.billing_period_end) {
    errors.billing_period_end = 'Must be after the period start';
  }
  return errors;
}

/** The `record` for PUT /api/ceb-bills/records, or throws if the draft is not valid. */
export function buildRecord(draft, extraction) {
  const errors = validateBillDraft(draft);
  if (Object.keys(errors).length) throw new RangeError(`invalid bill draft: ${Object.keys(errors).join(', ')}`);
  return {
    bill_date: draft.billing_period_end, // the bill date anchors LR-001 (a bill in month N reports N-1)
    billing_period_start: draft.billing_period_start,
    billing_period_end: draft.billing_period_end,
    meter_reading: Number(draft.meter_reading),
    units_exported: Number(draft.units_exported),
    earnings: Number(draft.earnings),
    account_number: extraction?.account_number || null,
    billing_month: extraction?.billing_month || null,
    ingestion_id: extraction?.ingestion_id,
    data_source: 'dashboard_upload',
    file_path: extraction?.ceb_bill_ingestions?.file_path || null
  };
}

/** The rate this bill implies (LKR per kWh), shown beside the earnings so a typo is obvious. */
export function impliedRate(draft) {
  const units = Number(draft?.units_exported);
  const earn = Number(draft?.earnings);
  if (!(draft?.units_exported ?? '').trim() || !(draft?.earnings ?? '').trim()) return null;
  return isNum(units) && isNum(earn) && units > 0 ? earn / units : null;
}

/** Queue rows: extractions still to review (not approved) plus uploads that failed, oldest first is not needed: newest first. */
export function queueItems(queue) {
  const items = [];
  for (const e of queue?.extractions ?? []) {
    if (e.review_status === 'approved') continue;
    items.push({ kind: 'extraction', id: e.id, ingestionId: e.ingestion_id, status: e.review_status, extraction: e, problems: Array.isArray(e.validation_errors) ? e.validation_errors : [] });
  }
  for (const f of queue?.failedIngestions ?? []) {
    items.push({ kind: 'failed', id: `failed-${f.id}`, ingestionId: f.id, status: f.status, extraction: null, problems: [], filePath: f.file_path ?? null });
  }
  return items;
}

/** A readable message for an upload failure. */
export function uploadProblem(err) {
  if (err?.status === 409) return 'This exact file has already been uploaded.';
  if (err?.status === 400) return err.message || 'That file was not accepted. Bills must be PDFs under 10 MB.';
  if (err?.status === 403 || err?.status === 401) return 'Only an admin can upload bills.';
  return `Upload failed (${err?.code ?? 'error'}).`;
}

/** A saved bill (ceb_data row) -> the same text draft the review form uses. */
export function rowToDraft(row) {
  return toBillDraft({
    billing_period_start: row?.billing_period_start,
    billing_period_end: row?.billing_period_end ?? row?.bill_date,
    meter_reading: row?.meter_reading,
    units_exported: row?.units_exported,
    earnings: row?.earnings
  });
}

/**
 * The `record` for PATCH /api/ceb-bills/records when editing a saved bill. The endpoint validates a whole
 * record, so the columns we do not edit (account, month, file, ingestion) are carried over unchanged.
 * Throws if the draft is not valid.
 */
export function buildRecordFromRow(draft, row) {
  const errors = validateBillDraft(draft);
  if (Object.keys(errors).length) throw new RangeError(`invalid bill draft: ${Object.keys(errors).join(', ')}`);
  const record = {
    bill_date: draft.billing_period_end,
    billing_period_start: draft.billing_period_start,
    billing_period_end: draft.billing_period_end,
    meter_reading: Number(draft.meter_reading),
    units_exported: Number(draft.units_exported),
    earnings: Number(draft.earnings)
  };
  for (const k of ['account_number', 'billing_month', 'data_source', 'file_path', 'ingestion_id']) {
    if (row?.[k] !== undefined && row?.[k] !== null && row?.[k] !== '') record[k] = row[k];
  }
  return record;
}

/** What an edit changes, in words, for the confirmation line. Empty when nothing differs. */
export function describeChanges(row, draft) {
  const before = rowToDraft(row);
  return BILL_FIELDS.filter((f) => before[f.key] !== (draft[f.key] ?? '').trim()).map((f) => `${f.label}: ${before[f.key] || 'blank'} → ${draft[f.key].trim()}`);
}

/** A readable message for a failed edit or delete of a saved bill. */
export function recordProblem(err) {
  if (err?.status === 400) return err.message || 'The server refused those values.';
  if (err?.status === 404) return 'That bill no longer exists. Reload the list.';
  if (err?.status === 403 || err?.status === 401) return 'Only an admin can change bills.';
  return `Could not save (${err?.code ?? 'error'}).`;
}
