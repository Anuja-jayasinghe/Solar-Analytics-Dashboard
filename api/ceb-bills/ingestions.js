import { createClient } from '@supabase/supabase-js'
import { verifyAdminToken } from '../middleware/verifyAdminToken.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVER_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET_BILLS || 'ceb_bills'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVER_KEY)
const PAGE_SIZE = 100

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  )
}

function isFolderEntry(item) {
  return !item?.id && !item?.metadata
}

async function listFolderEntries(bucket, prefix) {
  const entries = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, {
        limit: PAGE_SIZE,
        offset,
        sortBy: { column: 'created_at', order: 'desc' }
      })

    if (error) {
      throw new Error(`Failed to fetch storage files: ${error.message}`)
    }

    const page = data || []
    entries.push(...page)

    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return entries
}

async function listAllFilesRecursive(bucket) {
  const files = []
  const queue = ['']

  while (queue.length > 0) {
    const prefix = queue.shift()
    const entries = await listFolderEntries(bucket, prefix)

    for (const entry of entries) {
      if (isFolderEntry(entry)) {
        const nextPrefix = prefix ? `${prefix}/${entry.name}` : entry.name
        queue.push(nextPrefix)
      } else {
        const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name
        files.push({
          id: entry.id || fullPath,
          name: fullPath,
          createdAt: entry.created_at,
          updatedAt: entry.updated_at,
          sizeBytes: Number(entry.metadata?.size || 0)
        })
      }
    }
  }

  return files
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

    const allFiles = await listAllFilesRecursive(BUCKET)
    const files = allFiles
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, limit)

    res.status(200).json({ files })
  } catch (error) {
    console.error('CEB ingestion list fetch failed', {
      message: error?.message,
      stack: error?.stack
    })

    res.status(500).json({ error: 'Failed to load CEB storage file list', details: error?.message })
  }
}
