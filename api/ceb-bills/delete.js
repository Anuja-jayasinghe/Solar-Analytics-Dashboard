// api/ceb-bills/delete.js
//
// Permanently delete a bill, addressed either by its ingestion or by its finalised record:
//
//   POST | DELETE  { ingestionId }  -> the upload, its extraction, any ceb_data row it produced,
//                                      and the stored PDF
//   POST | DELETE  { recordId }     -> one ceb_data row, plus the ingestion / extraction / PDF
//                                      behind it when there is one
//
// This replaces two endpoints (`delete` and `delete-record`) that did the same job in opposite
// orders. The order here is deliberate:
//
//   1. database rows first, every result checked
//   2. the stored file last
//
// Removing the file first (the old `delete`) meant a failed database delete left an ingestion
// pointing at a file that no longer existed. In this order the worst outcome is an unreferenced
// PDF, which scripts/prune-orphaned-bill-files.mjs finds and removes. Every step is idempotent,
// so a failed request can simply be repeated.
//
// It deliberately does not rely on a database trigger to cascade the deletes: the trigger the
// old `delete-record` depended on exists only in the live database, not in any migration.

import { verifyAdminToken } from '../_lib/verifyAdminToken.js';
import { handlePreflightAndMethod } from '../_lib/httpSecurity.js';
import { supabase, blockOnConfigProblem } from '../_lib/supabaseServer.js';

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET_BILLS || 'ceb_bills';

export default async function handler(req, res) {
  if (handlePreflightAndMethod(req, res, ['POST', 'DELETE'])) return;

  const adminUser = await verifyAdminToken(req, res);
  if (!adminUser) return;

  if (blockOnConfigProblem(res)) return;

  try {
    const { ingestionId: requestedIngestionId, recordId } = req.body || {};

    if (!requestedIngestionId && !recordId) {
      return res.status(400).json({ error: 'Provide ingestionId or recordId' });
    }
    if (requestedIngestionId && recordId) {
      return res.status(400).json({ error: 'Provide ingestionId or recordId, not both' });
    }

    let ingestionId = requestedIngestionId || null;

    // A finalised record leads back to its ingestion (which may not exist for manual entries).
    if (recordId) {
      const { data: record, error: recordError } = await supabase
        .from('ceb_data')
        .select('id, ingestion_id')
        .eq('id', recordId)
        .maybeSingle();

      if (recordError) throw new Error(`Record lookup failed: ${recordError.message}`);
      if (!record) return res.status(404).json({ error: 'Record not found' });

      ingestionId = record.ingestion_id || null;
    }

    // Read the file path before anything is deleted — after step 3 the row is gone.
    let filePath = null;
    if (ingestionId) {
      const { data: ingestion, error: ingestionError } = await supabase
        .from('ceb_bill_ingestions')
        .select('id, file_path')
        .eq('id', ingestionId)
        .maybeSingle();

      if (ingestionError) throw new Error(`Ingestion lookup failed: ${ingestionError.message}`);
      if (!ingestion && requestedIngestionId) {
        return res.status(404).json({ error: 'Ingestion not found' });
      }
      filePath = ingestion?.file_path || null;
    }

    // 1. The finalised record(s).
    if (recordId) {
      const { error } = await supabase.from('ceb_data').delete().eq('id', recordId);
      if (error) throw new Error(`Failed to delete ceb_data record: ${error.message}`);
    }
    if (ingestionId) {
      const { error } = await supabase.from('ceb_data').delete().eq('ingestion_id', ingestionId);
      if (error) throw new Error(`Failed to delete ceb_data for ingestion: ${error.message}`);
    }

    // 2. The extraction, then the ingestion.
    if (ingestionId) {
      const { error: extractionError } = await supabase
        .from('ceb_bill_extractions')
        .delete()
        .eq('ingestion_id', ingestionId);
      if (extractionError) throw new Error(`Failed to delete extraction: ${extractionError.message}`);

      const { error: deleteError } = await supabase
        .from('ceb_bill_ingestions')
        .delete()
        .eq('id', ingestionId);
      if (deleteError) throw new Error(`Failed to delete ingestion: ${deleteError.message}`);
    }

    // 3. The stored file, last. The database is already consistent, so a failure here is a
    //    warning rather than an error.
    const warnings = [];
    if (filePath) {
      const { error: storageError } = await supabase.storage.from(BUCKET).remove([filePath]);
      if (storageError) {
        console.warn('Storage file removal failed (non-fatal):', storageError.message);
        warnings.push('The stored PDF could not be removed and is now unreferenced.');
      }
    }

    console.log('ceb bill deleted', {
      ingestionId,
      recordId: recordId || null,
      by: adminUser?.emailAddresses?.[0]?.emailAddress || adminUser?.id
    });

    return res.status(200).json({ success: true, ...(warnings.length ? { warnings } : {}) });
  } catch (error) {
    console.error('CEB delete failed', { message: error?.message });
    return res.status(500).json({ error: 'Failed to delete the bill' });
  }
}
