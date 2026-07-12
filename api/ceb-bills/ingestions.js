import { createClient } from '@supabase/supabase-js'
import { verifyAdminToken } from '../middleware/verifyAdminToken.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVER_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVER_KEY)

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  )
}

export default async function handler(req, res) {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVER_KEY) {
      res.status(500).json({
        error: 'Missing Supabase server configuration',
        details: 'Set SUPABASE_URL and either SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY'
      })
      return
    }

    const adminUser = await verifyAdminToken(req, res)
    if (!adminUser) return

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
