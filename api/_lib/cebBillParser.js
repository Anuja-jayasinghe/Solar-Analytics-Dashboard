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

/** Anchors for the pre-2026 CEB bill layout. Each is documented with the text it matches. */
export const LEGACY_PATTERNS = {
  // "Electricity A/C No.: 4924089702"
  accountNumber: /Electricity A\/C No\.:\s*(\d+)/i,
  // "2024 SEP\tMonth:" — tab between the year+month and the label
  billingMonth: /([0-9]{4} [A-Z]{3})\s+Month:/i,
  // "Bill Date: 9/5/2024 9:59:05 AM"
  billIssueDate: /Bill Date:\s*([0-9/]+)/i,
  // "No. of Units Exported (kWh) 3676"
  unitsExported: /No\. of Units Exported \(kWh\)\s+(\d+)/i,
  // "Charge for Units Exported (Rs.) 136,012.00"
  earnings: /Charge for Units Exported \(Rs\.\)\s+([\d,]+\.\d{2})/i,
  // Meter rows: "14\t3679\t2024-09-05" — reading and date separated by literal tabs.
  // This is the most fragile anchor in the set: it depends on pdf-parse emitting real tabs
  // between table cells, which is a property of the PDF's internal text layout rather than
  // anything visible on the page.
  meterRow: /\t(\d+)\t(\d{4}-\d{2}-\d{2})/g
};

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
  const pattern = new RegExp(LEGACY_PATTERNS.meterRow.source, 'g');
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
      earnings: 0,
      meter_reading_current: 0,
      meter_reading_previous: 0
    };
  }

  const accountMatch = text.match(LEGACY_PATTERNS.accountNumber);
  const monthMatch = text.match(LEGACY_PATTERNS.billingMonth);
  const issueDateMatch = text.match(LEGACY_PATTERNS.billIssueDate);
  const unitsMatch = text.match(LEGACY_PATTERNS.unitsExported);
  const earningsMatch = text.match(LEGACY_PATTERNS.earnings);

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
    bill_issue_date: issueDateMatch ? issueDateMatch[1] : null,
    billing_period_start: periodStart,
    billing_period_end: periodEnd,
    units_exported: unitsMatch ? parseInt(unitsMatch[1], 10) : 0,
    earnings: earningsMatch ? parseFloat(earningsMatch[1].replace(/,/g, '')) : 0,
    meter_reading_current: readingCurr,
    meter_reading_previous: readingPrev
  };
}

/**
 * Score and sanity-check an extraction.
 *
 * The tariff check assumes ONE FLAT EXPORT RATE. If CEB moves to tiered or time-of-use export
 * rates, or adds levies, every bill will flag for review even when the extraction is perfect.
 * That is a separate decision from whether the parsing worked.
 *
 * @param {object} result        Output of parseCebBillText
 * @param {number} currentTariff Rs per kWh, from system_settings.rate_per_kwh
 */
export function validateExtraction(result, currentTariff = 37.0) {
  const errors = [];
  let status = 'auto_approved';

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
  const expectedEarnings = (result.units_exported * currentTariff).toFixed(2);
  const earningsDifference = Math.abs(parseFloat(expectedEarnings) - result.earnings);
  if (earningsDifference >= 1.0) {
    errors.push(
      `Math mismatch: ${result.units_exported} units at Rs.${currentTariff} should be Rs.${expectedEarnings}, but extracted Rs.${result.earnings}`
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

  if (errors.length > 0) status = 'pending_review';

  return {
    status,
    validation_errors: errors,
    confidence_score: Math.min(100, Math.max(0, confidence_score)),
    clean_data: result
  };
}
