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
      ? Math.min(Math.max(requestedLimit, 1), 50)
      : 12

    const { data, error } = await supabase
      .from('ceb_bill_ingestions')
      .select('id, source_type, file_path, file_sha256, status, error_message, received_at, created_by')
      .order('received_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to fetch ingestions: ${error.message}`)
    }

    res.status(200).json({ ingestions: data || [] })
  } catch (error) {
    console.error('CEB ingestion list fetch failed', {
      message: error?.message,
      stack: error?.stack
    })

    res.status(500).json({ error: 'Failed to load CEB ingestion list', details: error?.message })
  }
}
