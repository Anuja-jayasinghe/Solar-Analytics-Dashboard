import { createClient } from '@supabase/supabase-js'
import { verifyAdminToken } from '../middleware/verifyAdminToken.js'
import { buildStoragePath, createSha256, parseMultipartForm } from '../lib/cebBillUploadUtils.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVER_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET_BILLS || 'ceb_bills'
const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg'])

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVER_KEY)

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  )
}

function getAdminIdentity(user) {
  const email = user?.emailAddresses?.[0]?.emailAddress
  return {
    id: user?.id || 'unknown_admin',
    createdBy: email || user?.id || null
  }
}

export default async function handler(req, res) {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const startedAt = Date.now()

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

    const { fields, files } = await parseMultipartForm(req, MAX_BYTES)
    const file = files.file

    if (!file) {
      res.status(400).json({ error: 'Missing file field in multipart payload' })
      return
    }

    if (!ALLOWED_TYPES.has(file.contentType)) {
      res.status(400).json({
        error: 'Unsupported file type',
        allowed: Array.from(ALLOWED_TYPES)
      })
      return
    }

    if (!file.buffer || file.buffer.length === 0) {
      res.status(400).json({ error: 'Uploaded file is empty' })
      return
    }

    const fileSha256 = createSha256(file.buffer)
    const sourceType = fields.source_type || 'manual_upload'
    const identity = getAdminIdentity(adminUser)

    const { data: duplicateRow, error: duplicateError } = await supabase
      .from('ceb_bill_ingestions')
      .select('id, file_path, received_at, status')
      .eq('file_sha256', fileSha256)
      .order('received_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (duplicateError) {
      throw new Error(`Duplicate check failed: ${duplicateError.message}`)
    }

    if (duplicateRow) {
      res.status(409).json({
        error: 'Duplicate file detected',
        ingestionId: duplicateRow.id,
        filePath: duplicateRow.file_path,
        receivedAt: duplicateRow.received_at,
        status: duplicateRow.status,
        fileSha256
      })
      return
    }

    const filePath = buildStoragePath({ adminId: identity.id, filename: file.filename })

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, file.buffer, {
        contentType: file.contentType,
        upsert: false,
        cacheControl: '3600'
      })

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`)
    }

    const payload = {
      source_type: sourceType,
      file_path: filePath,
      file_sha256: fileSha256,
      status: 'received',
      created_by: identity.createdBy
    }

    const { data: insertedRow, error: insertError } = await supabase
      .from('ceb_bill_ingestions')
      .insert(payload)
      .select('id, received_at, status')
      .single()

    if (insertError) {
      await supabase.storage.from(BUCKET).remove([filePath])
      throw new Error(`Failed to create ingestion row: ${insertError.message}`)
    }

    const latencyMs = Date.now() - startedAt
    console.log('CEB bill upload successful', {
      ingestionId: insertedRow.id,
      filePath,
      sourceType,
      mimeType: file.contentType,
      sizeBytes: file.buffer.length,
      adminId: identity.id,
      latencyMs
    })

    res.status(201).json({
      ingestionId: insertedRow.id,
      filePath,
      fileSha256,
      status: insertedRow.status,
      receivedAt: insertedRow.received_at
    })
  } catch (error) {
    console.error('CEB bill upload failed', {
      message: error?.message,
      stack: error?.stack
    })

    const errorMessage = error?.message || 'Unknown error'
    if (errorMessage.toLowerCase().includes('too large')) {
      res.status(400).json({ error: errorMessage })
      return
    }

    res.status(500).json({ error: 'Failed to upload CEB bill', details: errorMessage })
  }
}
