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

function monthKeyFromDateValue(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
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

    const requestedYear = Number(req.query?.year)
    const year = Number.isFinite(requestedYear) ? requestedYear : new Date().getUTCFullYear()
    const from = `${year}-01-01`
    const to = `${year + 1}-01-01`

    const [{ data: ingestions, error: ingestionsError }, { data: cebRows, error: cebError }] = await Promise.all([
      supabase
        .from('ceb_bill_ingestions')
        .select('id, source_type, status, received_at')
        .gte('received_at', from)
        .lt('received_at', to),
      supabase
        .from('ceb_data')
        .select('id, bill_date')
        .gte('bill_date', from)
        .lt('bill_date', to)
    ])

    if (ingestionsError) {
      throw new Error(`Failed to load ingestion data: ${ingestionsError.message}`)
    }

    if (cebError) {
      throw new Error(`Failed to load CEB data: ${cebError.message}`)
    }

    const map = new Map()

    for (let month = 1; month <= 12; month += 1) {
      const key = `${year}-${String(month).padStart(2, '0')}`
      map.set(key, {
        month: key,
        uploadedDocs: 0,
        received: 0,
        failed: 0,
        cebRecords: 0,
        delta: 0
      })
    }

    for (const row of ingestions || []) {
      const key = monthKeyFromDateValue(row.received_at)
      if (!key || !map.has(key)) continue
      const current = map.get(key)
      current.uploadedDocs += 1
      if (row.status === 'failed') {
        current.failed += 1
      } else {
        current.received += 1
      }
    }

    for (const row of cebRows || []) {
      const key = monthKeyFromDateValue(row.bill_date)
      if (!key || !map.has(key)) continue
      const current = map.get(key)
      current.cebRecords += 1
    }

    const months = Array.from(map.values()).map((entry) => ({
      ...entry,
      delta: entry.uploadedDocs - entry.cebRecords
    }))

    const totals = months.reduce((acc, item) => {
      acc.uploadedDocs += item.uploadedDocs
      acc.received += item.received
      acc.failed += item.failed
      acc.cebRecords += item.cebRecords
      return acc
    }, { uploadedDocs: 0, received: 0, failed: 0, cebRecords: 0 })

    totals.delta = totals.uploadedDocs - totals.cebRecords

    res.status(200).json({
      year,
      months,
      totals
    })
  } catch (error) {
    console.error('CEB reconciliation fetch failed', {
      message: error?.message,
      stack: error?.stack
    })

    res.status(500).json({
      error: 'Failed to load backfill reconciliation data',
      details: error?.message
    })
  }
}
