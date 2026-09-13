import { verifyAdminToken } from '../_lib/verifyAdminToken.js'
import { handlePreflightAndMethod } from '../_lib/httpSecurity.js';
import { supabase, blockOnConfigProblem } from '../_lib/supabaseServer.js';




export default async function handler(req, res) {
  if (handlePreflightAndMethod(req, res, ['GET'])) return;

  try {

    const adminUser = await verifyAdminToken(req, res)
    if (!adminUser) return

    if (blockOnConfigProblem(res)) return;

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
      name: ing.file_path.split('/').pop(),
      fullPath: ing.file_path,
      createdAt: ing.received_at,
      status: ing.status,
      extraction: ing.ceb_bill_extractions?.[0] || null
    }));

    res.status(200).json({ files })
  } catch (error) {
    console.error('CEB ingestion list fetch failed', error);
    res.status(500).json({ error: 'Failed to load CEB ingestion records', details: error?.message })
  }
}
