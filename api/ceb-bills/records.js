// api/ceb-bills/records.js
//
// Admin-authenticated writes to `ceb_data` — the canonical billing table the whole analytics
// layer reads.
//
// Why GET is here: the public dashboard reads only four columns of `ceb_data` (id, bill_date,
// earnings, units_exported), and the `anon` role is granted exactly those — see
// scripts/sql/2026-09-24_ceb_data_public_columns.sql. The admin table needs the rest
// (account number, file path, ingestion id), which it now gets through this admin-authenticated
// call instead of a browser query with the public key.
//
// Why writes are here: the admin screens previously wrote to Supabase directly from the browser
// with the public anon key, which forced `ceb_data` to carry `INSERT ... WITH CHECK (true)`
// and `UPDATE ... USING (true)` policies for `anon`. The anon key ships in the JS bundle, so
// any visitor could insert or overwrite billing rows.
//
// Operations, all service-role:
//   GET                              -> every row, all columns (the admin table)
//   POST  { record }                 -> upsert on (account_number, billing_month)
//   PATCH { id, record }             -> update one row by id
//   PUT   { extractionId, ingestionId, record }
//                                    -> approve a parsed bill: upsert ceb_data and mark the
//                                       extraction and ingestion approved, in ONE transaction
//                                       (public.approve_ceb_extraction, see
//                                       scripts/sql/2026-09-24_approve_ceb_extraction.sql)

import { verifyAdminToken } from '../_lib/verifyAdminToken.js';
import { handlePreflightAndMethod } from '../_lib/httpSecurity.js';
import { supabase, blockOnConfigProblem } from '../_lib/supabaseServer.js';
import { sanitizeRecord } from '../_lib/cebRecordRules.js';

// PostgREST answers PGRST202 when the RPC it was asked to call is not installed.
const isMissingFunction = (error) =>
  error?.code === 'PGRST202' || /could not find the function/i.test(error?.message || '');

/**
 * The pre-transaction approval path, kept only so the API keeps working on a database that does
 * not yet have approve_ceb_extraction(). Three independent writes: a failure part-way leaves
 * the earlier ones in place. Remove once the function is installed everywhere.
 */
async function approveSequentially({ extractionId, ingestionId, record }) {
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
  if (extractionError) throw new Error(`Approve failed updating extraction: ${extractionError.message}`);

  if (ingestionId) {
    const { error: ingestionError } = await supabase
      .from('ceb_bill_ingestions')
      .update({ status: 'approved' })
      .eq('id', ingestionId);
    if (ingestionError) throw new Error(`Approve failed updating ingestion: ${ingestionError.message}`);
  }
}

export default async function handler(req, res) {
  if (handlePreflightAndMethod(req, res, ['GET', 'POST', 'PATCH', 'PUT'])) return;

  const adminUser = await verifyAdminToken(req, res);
  if (!adminUser) return; // verifyAdminToken has already sent 401/403

  if (blockOnConfigProblem(res)) return;

  const actor = adminUser?.emailAddresses?.[0]?.emailAddress || adminUser?.id || 'unknown_admin';

  try {
    // ---------------------------------------------------------------- GET: list every row
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('ceb_data')
        .select('*')
        .order('bill_date', { ascending: false });

      if (error) throw new Error(`Read failed: ${error.message}`);
      return res.status(200).json({ records: data || [] });
    }

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

    // One transaction: ceb_data, the extraction and the ingestion are approved together or not
    // at all. Three separate writes could leave a bill promoted into ceb_data with an ingestion
    // still labelled `auto_approved` — the state 20 ingestions were found in.
    const { error: rpcError } = await supabase.rpc('approve_ceb_extraction', {
      p_extraction_id: extractionId,
      p_ingestion_id: ingestionId || null,
      p_record: record
    });

    if (rpcError && isMissingFunction(rpcError)) {
      console.warn(
        'approve_ceb_extraction() is not installed — approving with sequential, non-atomic ' +
          'writes. Apply scripts/sql/2026-09-24_approve_ceb_extraction.sql.'
      );
      await approveSequentially({ extractionId, ingestionId, record });
    } else if (rpcError) {
      throw new Error(`Approve failed: ${rpcError.message}`);
    }

    console.log('ceb bill approved', { extractionId, ingestionId, by: actor });
    return res.status(200).json({ approved: true, extractionId, ingestionId });
  } catch (error) {
    console.error('CEB record write failed', { message: error?.message });
    return res.status(500).json({ error: 'Failed to write CEB record' });
  }
}
