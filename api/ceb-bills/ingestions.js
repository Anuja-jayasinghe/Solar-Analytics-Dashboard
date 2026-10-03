// api/ceb-bills/ingestions.js
//
// Admin-authenticated reads of the CEB bill ingestion pipeline.
//
//   GET /api/ceb-bills/ingestions?limit=N        -> recent uploads, for the admin file list
//   GET /api/ceb-bills/ingestions?view=queue     -> the verification queue
//
// Why the queue is served from here: the review screen used to query `ceb_bill_extractions`
// and `ceb_bill_ingestions` straight from the browser with the public anon key. That data
// carries account numbers, admin e-mail addresses and the path of every private bill PDF, and
// the anon key ships in the bundle — so serving it that way meant granting `anon` SELECT on
// tables that are meant for admins only. Reads now go through the service-role key here, and
// the anon policies on those tables are dropped by
// scripts/sql/2026-09-24_revoke_anon_bill_access.sql.

import { verifyAdminToken } from '../_lib/verifyAdminToken.js'
import { handlePreflightAndMethod } from '../_lib/httpSecurity.js';
import { supabase, blockOnConfigProblem } from '../_lib/supabaseServer.js';

// Ingestions whose extraction never completed. They have no extraction row, so the queue
// lists them separately for a retry or a delete.
const FAILED_STATUSES = ['failed_api_limit', 'failed_extraction'];

// Extractions the reviewer sees: waiting, parsed-and-ready, and already approved (history).
const QUEUE_REVIEW_STATUSES = ['pending_review', 'auto_approved', 'approved'];

async function loadQueue() {
  const { data: extractions, error: extractionError } = await supabase
    .from('ceb_bill_extractions')
    .select(`
      *,
      ceb_bill_ingestions(file_path, status, id)
    `)
    .in('review_status', QUEUE_REVIEW_STATUSES)
    .order('created_at', { ascending: false });

  if (extractionError) throw extractionError;

  const { data: failedIngestions, error: failedError } = await supabase
    .from('ceb_bill_ingestions')
    .select('id, file_path, status, received_at')
    .in('status', FAILED_STATUSES)
    .order('received_at', { ascending: false });

  if (failedError) throw failedError;

  return { extractions: extractions || [], failedIngestions: failedIngestions || [] };
}

export default async function handler(req, res) {
  if (handlePreflightAndMethod(req, res, ['GET'])) return;

  try {
    const adminUser = await verifyAdminToken(req, res)
    if (!adminUser) return

    if (blockOnConfigProblem(res)) return;

    if (req.query?.view === 'queue') {
      res.status(200).json(await loadQueue())
      return
    }

    const requestedLimit = Number(req.query?.limit || 12)
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 12

    // Query database instead of storage for metadata
    const { data: ingestions, error: dbError } = await supabase
      .from('ceb_bill_ingestions')
      .select(`
        *,
        ceb_bill_extractions (
          billing_month,
          units_exported,
          earnings,
          review_status
        )
      `)
      .order('received_at', { ascending: false })
      .limit(limit);

    if (dbError) throw dbError;

    const files = ingestions.map(ing => ({
      id: ing.id,
      name: (ing.file_path || '').split('/').pop(),
      fullPath: ing.file_path,
      createdAt: ing.received_at,
      status: ing.status,
      extraction: ing.ceb_bill_extractions?.[0] || null
    }));

    res.status(200).json({ files })
  } catch (error) {
    console.error('CEB ingestion list fetch failed', error);
    res.status(500).json({ error: 'Failed to load CEB ingestion records' })
  }
}
