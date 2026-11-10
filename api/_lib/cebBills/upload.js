// api/_lib/cebBills/upload.js — served at /api/ceb-bills/upload by api/ceb-bills/[action].js

import { verifyAdminToken } from '../verifyAdminToken.js'
import { parseMultipartForm, MAX_UPLOAD_BYTES } from '../cebBillUploadUtils.js'
import { handlePreflightAndMethod } from '../httpSecurity.js';
import { supabase, blockOnConfigProblem } from '../supabaseServer.js';
import { audit, actorOf, withRequestLog } from '../log.js';
import { createBillIntake, pdfProblem } from '../billIntake.js';
import { extractPdfText } from '../pdfText.js';

const intake = createBillIntake({ db: supabase, extractText: extractPdfText })
const MAX_BYTES = MAX_UPLOAD_BYTES
// PDF only: the extractor reads the PDF text layer and cannot parse images, so accepting them
// would only create ingestions that are guaranteed to fail extraction.
const ALLOWED_TYPES = new Set(['application/pdf'])



function getAdminIdentity(user) {
  const email = user?.emailAddresses?.[0]?.emailAddress
  return {
    id: user?.id || 'unknown_admin',
    createdBy: email || user?.id || null
  }
}

async function handler(req, res) {
  if (handlePreflightAndMethod(req, res, ['POST'])) return;

  const startedAt = Date.now()

  try {

    const adminUser = await verifyAdminToken(req, res)
    if (!adminUser) return

    if (blockOnConfigProblem(res)) return;

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

    // The declared type is client-supplied; check the bytes too.
    const problem = pdfProblem(file.buffer)
    if (problem === 'empty') {
      res.status(400).json({ error: 'Uploaded file is empty' })
      return
    }
    if (problem === 'not_pdf') {
      res.status(400).json({ error: 'Uploaded file is not a valid PDF' })
      return
    }

    const fileSha256 = intake.sha256(file.buffer)
    const sourceType = fields.source_type || 'manual_upload'
    const identity = getAdminIdentity(adminUser)

    const duplicateRow = await intake.findDuplicate(fileSha256)

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

    const stored = await intake.store({
      buffer: file.buffer,
      filename: file.filename,
      contentType: file.contentType,
      ownerId: identity.id,
      createdBy: identity.createdBy,
      sourceType,
      fileSha256
    })

    audit(req, {
      action: 'bill.upload',
      actor: actorOf(adminUser),
      target: { ingestionId: stored.ingestionId },
      changes: { sourceType, sizeBytes: file.buffer.length, latencyMs: Date.now() - startedAt }
    })

    res.status(201).json({
      ingestionId: stored.ingestionId,
      filePath: stored.filePath,
      fileSha256,
      status: stored.status,
      receivedAt: stored.receivedAt
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

    res.status(500).json({ error: 'Failed to upload CEB bill' })
  }
}

export default withRequestLog('ceb-bills/upload', handler);
