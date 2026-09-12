// api/ceb-bills/records.js
//
// Admin-authenticated writes to `ceb_data` — the canonical billing table the whole analytics
// layer reads.
//
// Why this exists: the admin screens previously wrote to Supabase directly from the browser
// with the public anon key, which forced `ceb_data` to carry `INSERT ... WITH CHECK (true)`
// and `UPDATE ... USING (true)` policies for `anon`. The anon key ships in the JS bundle, so
// any visitor could insert or overwrite billing rows.
//
// Two operations, both service-role:
//   POST  { record }                 -> upsert on (account_number, billing_month)
//   PATCH { id, record }             -> update one row by id
//   PUT   { extractionId, ingestionId, record }
//                                    -> approve a parsed bill: upsert ceb_data, then mark the
//                                       extraction and ingestion approved, as one operation

import { createClient } from '@supabase/supabase-js';
import { verifyAdminToken } from '../middleware/verifyAdminToken.js';
import { handlePreflightAndMethod } from '../_lib/httpSecurity.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVER_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVER_KEY);

const NUMERIC_FIELDS = ['meter_reading', 'units_exported', 'earnings'];

/**
 * Whitelist and coerce the incoming record. The client is not trusted to decide which columns
 * exist, and a non-numeric reading would poison every chart that averages these values.
 */
function sanitizeRecord(input = {}) {
  const errors = [];
  const record = {};

  if (!input.bill_date) errors.push('bill_date is required');
  else record.bill_date = String(input.bill_date);

  for (const field of NUMERIC_FIELDS) {
    if (input[field] === undefined || input[field] === null || input[field] === '') {
      errors.push(`${field} is required`);
      continue;
    }
    const n = Number(input[field]);
    if (!Number.isFinite(n) || n < 0) {
      errors.push(`${field} must be a non-negative number`);
      continue;
    }
    record[field] = n;
  }

  // Optional passthrough columns.
  for (const field of [
    'account_number',
    'billing_month',
    'billing_period_start',
    'billing_period_end',
    'data_source',
    'file_path',
    'ingestion_id'
  ]) {
    if (input[field] !== undefined) record[field] = input[field] || null;
  }

  return { record, errors };
}

export default async function handler(req, res) {
  if (handlePreflightAndMethod(req, res, ['POST', 'PATCH', 'PUT'])) return;

  const adminUser = await verifyAdminToken(req, res);
  if (!adminUser) return; // verifyAdminToken has already sent 401/403

  if (!SUPABASE_URL || !SUPABASE_SERVER_KEY) {
    res.status(500).json({
      error: 'Missing Supabase server configuration',
      details: 'Set SUPABASE_URL and SUPABASE_SERVICE_KEY'
    });
    return;
  }

  const actor = adminUser?.emailAddresses?.[0]?.emailAddress || adminUser?.id || 'unknown_admin';

  try {
    // ---------------------------------------------------------------- PATCH: edit one row
    if (req.method === 'PATCH') {
      const { id, record: raw } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Missing record id' });

      const { record, errors } = sanitizeRecord(raw);
      if (errors.length) return res.status(400).json({ error: 'Invalid record', details: errors });

      const { data, error } = await supabase
        .from('ceb_data')
        .update(record)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(`Update failed: ${error.message}`);
      console.log('ceb_data updated', { id, by: actor });
      return res.status(200).json({ record: data });
    }

    // ------------------------------------------------- POST: manual entry / upsert by month
    if (req.method === 'POST') {
      const { record: raw } = req.body || {};
      const { record, errors } = sanitizeRecord(raw);
      if (errors.length) return res.status(400).json({ error: 'Invalid record', details: errors });

      const { data, error } = await supabase
        .from('ceb_data')
        .upsert([record], { onConflict: 'account_number, billing_month' })
        .select();

      if (error) throw new Error(`Upsert failed: ${error.message}`);
      console.log('ceb_data upserted', { billingMonth: record.billing_month, by: actor });
      return res.status(200).json({ records: data });
    }

    // ------------------------------------------------------ PUT: approve a parsed extraction
    const { extractionId, ingestionId, record: raw } = req.body || {};
    if (!extractionId) return res.status(400).json({ error: 'Missing extractionId' });

    const { record, errors } = sanitizeRecord(raw);
    if (errors.length) return res.status(400).json({ error: 'Invalid record', details: errors });

    const { error: upsertError } = await supabase
      .from('ceb_data')
      .upsert([record], { onConflict: 'account_number, billing_month' });

    if (upsertError) throw new Error(`Approve failed writing ceb_data: ${upsertError.message}`);

    const { error: extractionError } = await supabase
      .from('ceb_bill_extractions')
      .update({
        review_status: 'approved',
        meter_reading: record.meter_reading,
        units_exported: record.units_exported,
        earnings: record.earnings,
        billing_period_start: record.billing_period_start || null,
        billing_period_end: record.billing_period_end || null
      })
      .eq('id', extractionId);

    if (extractionError) {
      throw new Error(`Approve failed updating extraction: ${extractionError.message}`);
    }

    if (ingestionId) {
      const { error: ingestionError } = await supabase
        .from('ceb_bill_ingestions')
        .update({ status: 'approved' })
        .eq('id', ingestionId);

      if (ingestionError) {
        throw new Error(`Approve failed updating ingestion: ${ingestionError.message}`);
      }
    }

    console.log('ceb bill approved', { extractionId, ingestionId, by: actor });
    return res.status(200).json({ approved: true, extractionId, ingestionId });
  } catch (error) {
    console.error('CEB record write failed', { message: error?.message });
    return res.status(500).json({ error: 'Failed to write CEB record', details: error?.message });
  }
}
