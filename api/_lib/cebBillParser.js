// api/_lib/cebBillParser.js
//
// Pure parsing and validation for CEB bills. Extracted from api/ceb-bills/extract.js so it
// can be tested without a database, Supabase storage, or a live upload.
//
// ============================================================================
// WHY THIS IS ITS OWN MODULE
// ============================================================================
// CEB redesigned the bill and the extractor silently stopped working. Nobody noticed for
// months, because the only way to exercise this logic was to upload a real PDF to production
// and look at the result. The regexes below are pinned to the *exact text layout* of the old
// bill — label wording, and in one case literal tab characters between table cells — so a
// visual redesign alone is enough to break them.
//
// Keeping the parsing pure means a fixture can prove it works. When the new format arrives,
// add its extracted text as a second fixture and both are covered permanently.
//
// The input is whatever pdf-parse@2.4.5's getText() returns for the PDF.

/**
 * Anchors, each documented with the text it matches.
 *
 * Verified against two real formats — the pre-2026 bill and the 2026 `ebill-edl-v.1.0.2`
 * redesign. All but one survived the redesign unchanged; see BILL_REF_DATE below.
 */
export const PATTERNS = {
  // legacy: "Electricity A/C No.: 4924089702"
  // 2026:   "Electricity A/C No.: 4924089702\tWPN"
  accountNumber: /Electricity A\/C No\.:\s*(\d+)/i,
  // legacy: "2024 SEP\tMonth:"   2026: "2026 SEP\tMonth:"
  billingMonth: /([0-9]{4} [A-Z]{3})\s+Month:/i,
  // legacy only: "Bill Date: 9/5/2024 9:59:05 AM". The 2026 bill dropped this label.
  billDateLabel: /Bill Date:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i,
  // 2026 replacement: "Bill Ref: 457-4924089702-20260903082730"
  //                                             ^^^^^^^^ YYYYMMDD (+ HHMMSS)
  billRefDate: /Bill Ref:\s*\d+-\d+-(\d{4})(\d{2})(\d{2})\d{6}/i,
  // both: "No. of Units Exported (kWh) 4007"
  unitsExported: /No\. of Units Exported \(kWh\)\s+(\d+)/i,
  // both: "Charge for Units Exported (Rs.) 148,259.00"
  earnings: /Charge for Units Exported \(Rs\.\)\s+([\d,]+\.\d{2})/i,
  // 2026 only: "Export Rate (Rs.) 37.00" — the bill now states its own export tariff.
  exportRate: /Export Rate \(Rs\.\)\s+([\d,]+\.\d{2})/i,
  // 2026 only: "No. of Units Consumed (kWh) 5"
  unitsConsumed: /No\. of Units Consumed \(kWh\)\s+(\d+)/i,
  // Meter rows — legacy: "14\t3679\t2024-09-05", 2026: "129\t97597\t2026-09-03".
  // The most fragile anchor in the set: it depends on pdf-parse emitting real tabs between
  // table cells, which is a property of the PDF's internal text layout rather than anything
  // visible on the page. It survived the 2026 redesign, but that was luck, not design.
  meterRow: /\t(\d+)\t(\d{4}-\d{2}-\d{2})/g
};

// Kept as an alias so existing imports keep working.
export const LEGACY_PATTERNS = PATTERNS;

/**
 * The bill's issue date, as ISO `YYYY-MM-DD`.
 *
 * The 2026 redesign removed the "Bill Date:" label — this was the ONLY field the new format
 * broke. The date is still present, encoded in the bill reference
 * (`457-4924089702-20260903082730`), so we read it from there.
 *
 * Legacy dates were previously returned raw as `9/5/2024`, which is ambiguous and was being
 * written straight into a DATE column. Both paths now normalise to ISO.
 */
export function extractBillIssueDate(text) {
  const labelled = text.match(PATTERNS.billDateLabel);
  if (labelled) {
    // CEB writes this as M/D/YYYY.
    const [, month, day, year] = labelled;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const fromRef = text.match(PATTERNS.billRefDate);
  if (fromRef) {
    const [, year, month, day] = fromRef;
    return `${year}-${month}-${day}`;
  }

  return null;
}

/**
 * Extract the meter readings, sorted oldest-first.
 *
 * NOTE: this is positional — the earliest row is treated as the previous reading and the
 * latest as the current one. If a redesigned bill puts additional rows of the same shape in
 * the table, this will happily pick the wrong pair. Any new-format fixture should assert on
 * the specific readings, not just the count.
 *
 * @param {string} text
 * @returns {{reading: number, date: string}[]}
 */
export function extractMeterReadings(text) {
  const pattern = new RegExp(PATTERNS.meterRow.source, 'g');
  const matches = [];
  let hit;

  while ((hit = pattern.exec(text)) !== null) {
    matches.push({ reading: parseInt(hit[1], 10), date: hit[2] });
  }

  return matches.sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Parse the text of a CEB bill into the extraction payload.
 *
 * Always returns an object. Fields it cannot find come back as null or 0 — the caller is
 * expected to run validateExtraction() and route low-confidence results to human review
 * rather than trusting this blindly.
 *
 * @param {string} text  Raw text from pdf-parse
 */
export function parseCebBillText(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    return {
      account_number: null,
      billing_month: null,
      bill_issue_date: null,
      billing_period_start: null,
      billing_period_end: null,
      units_exported: 0,
      units_consumed: null,
      earnings: 0,
      export_rate: null,
      meter_reading_current: 0,
      meter_reading_previous: 0
    };
  }

  const accountMatch = text.match(PATTERNS.accountNumber);
  const monthMatch = text.match(PATTERNS.billingMonth);
  const unitsMatch = text.match(PATTERNS.unitsExported);
  const earningsMatch = text.match(PATTERNS.earnings);
  const consumedMatch = text.match(PATTERNS.unitsConsumed);
  const rateMatch = text.match(PATTERNS.exportRate);

  const meterMatches = extractMeterReadings(text);

  let readingPrev = 0;
  let readingCurr = 0;
  let periodStart = null;
  let periodEnd = null;

  if (meterMatches.length >= 2) {
    readingPrev = meterMatches[0].reading;
    readingCurr = meterMatches[meterMatches.length - 1].reading;
    periodStart = meterMatches[0].date;
    periodEnd = meterMatches[meterMatches.length - 1].date;
  } else if (meterMatches.length === 1) {
    readingCurr = meterMatches[0].reading;
    periodEnd = meterMatches[0].date;
  }

  return {
    account_number: accountMatch ? accountMatch[1] : null,
    billing_month: monthMatch ? monthMatch[1].toUpperCase() : null,
    bill_issue_date: extractBillIssueDate(text),
    billing_period_start: periodStart,
    billing_period_end: periodEnd,
    units_exported: unitsMatch ? parseInt(unitsMatch[1], 10) : 0,
    // 2026 format only — null on older bills, which did not report consumption here.
    units_consumed: consumedMatch ? parseInt(consumedMatch[1], 10) : null,
    earnings: earningsMatch ? parseFloat(earningsMatch[1].replace(/,/g, '')) : 0,
    // 2026 format only. When present this is authoritative: the bill states the rate it was
    // actually billed at, so validation no longer has to assume system_settings matches.
    export_rate: rateMatch ? parseFloat(rateMatch[1].replace(/,/g, '')) : null,
    meter_reading_current: readingCurr,
    meter_reading_previous: readingPrev
  };
}

/**
 * Score and sanity-check an extraction.
 *
 * Tariff source, in order of preference:
 *
 *   1. `result.export_rate` — the rate printed on the bill itself. The 2026 format states it
 *      ("Export Rate (Rs.) 37.00"), which makes the maths check self-contained: we compare
 *      the bill against itself rather than against whatever `system_settings` happens to say.
 *   2. `currentTariff` — `system_settings.rate_per_kwh`, for older bills that omit the rate.
 *
 * This removes a real fragility. Previously a tariff change would make every correctly-parsed
 * bill fail validation until someone remembered to update the setting, which looks identical
 * to a parsing failure.
 *
 * @param {object} result        Output of parseCebBillText
 * @param {number} currentTariff Fallback Rs per kWh, from system_settings.rate_per_kwh
 */
export function validateExtraction(result, currentTariff = 37.0) {
  const errors = [];
  let status = 'auto_approved';

  const billStatesRate = Number.isFinite(result.export_rate) && result.export_rate > 0;
  const tariff = billStatesRate ? result.export_rate : currentTariff;

  // Notes are surfaced to the reviewer but do NOT block auto-approval. `errors` decides
  // status, so anything informational has to live separately — otherwise a advisory message
  // silently downgrades a perfectly good extraction to pending_review.
  const notes = [];

  // A rate on the bill that disagrees with our configured one is worth surfacing — it is how
  // a tariff change announces itself — but the bill's own maths is still internally
  // consistent, so it is not an extraction problem.
  if (billStatesRate && Number.isFinite(currentTariff) && Math.abs(result.export_rate - currentTariff) > 0.001) {
    notes.push(
      `Tariff changed: bill states Rs.${result.export_rate}/kWh but system_settings.rate_per_kwh is Rs.${currentTariff}. ` +
      `Validated against the bill. Update the setting so dashboard projections match.`
    );
  }

  const fieldChecks = {
    account_number: !!result.account_number,
    billing_month: !!result.billing_month,
    billing_period_start: !!result.billing_period_start,
    billing_period_end: !!result.billing_period_end,
    meter_reading_current: result.meter_reading_current > 0,
    meter_reading_previous: result.meter_reading_previous >= 0,
    units_exported: result.units_exported > 0,
    earnings: result.earnings > 0
  };

  const extractedCount = Object.values(fieldChecks).filter(Boolean).length;
  let confidence_score = Math.round((extractedCount / Object.keys(fieldChecks).length) * 100);

  // 1. Sanity
  if (!result.meter_reading_current || result.meter_reading_current <= 0) {
    errors.push('Invalid current meter reading');
  }
  if (!result.units_exported || result.units_exported < 0) errors.push('Invalid exported units');
  if (!result.earnings || result.earnings < 0) errors.push('Invalid earnings');
  if (!result.billing_month) errors.push('Missing billing month');

  // 2. Tariff maths
  const expectedEarnings = (result.units_exported * tariff).toFixed(2);
  const earningsDifference = Math.abs(parseFloat(expectedEarnings) - result.earnings);
  if (earningsDifference >= 1.0) {
    errors.push(
      `Math mismatch: ${result.units_exported} units at Rs.${tariff} should be Rs.${expectedEarnings}, but extracted Rs.${result.earnings}`
    );
    confidence_score = Math.max(0, confidence_score - 20);
  }

  // 3. Meter delta
  const calculatedUnits = result.meter_reading_current - result.meter_reading_previous;
  if (result.meter_reading_previous > 0 && calculatedUnits !== result.units_exported) {
    errors.push(
      `Meter mismatch: Current (${result.meter_reading_current}) - Prev (${result.meter_reading_previous}) = ${calculatedUnits}, but extracted units = ${result.units_exported}`
    );
    confidence_score = Math.max(0, confidence_score - 15);
  }

  // 4. Timeline
  if (result.billing_period_start && result.billing_period_end) {
    if (new Date(result.billing_period_start) >= new Date(result.billing_period_end)) {
      errors.push('Timeline error: Billing period start is not before end date.');
    }
  } else {
    errors.push('Missing billing period dates.');
  }

  // Status is decided by blocking errors only. Notes ride along in validation_errors so the
  // reviewer still sees them in the queue.
  if (errors.length > 0) status = 'pending_review';

  return {
    status,
    validation_errors: [...errors, ...notes],
    notes,
    confidence_score: Math.min(100, Math.max(0, confidence_score)),
    clean_data: result
  };
}
