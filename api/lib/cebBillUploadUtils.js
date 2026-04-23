import crypto from 'crypto'

const CRLF = '\r\n'

function readRawBody(req, maxBytes = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0

    req.on('data', (chunk) => {
      total += chunk.length
      if (total > maxBytes) {
        reject(new Error(`File too large. Max supported size is ${Math.floor(maxBytes / (1024 * 1024))}MB`))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })

    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function parseHeaders(headerText) {
  const headers = {}
  const lines = headerText.split(CRLF)

  for (const line of lines) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim().toLowerCase()
    const value = line.slice(idx + 1).trim()
    headers[key] = value
  }

  return headers
}

function parseContentDisposition(value = '') {
  const result = {}
  const parts = value.split(';').map((p) => p.trim())

  for (const part of parts) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const key = part.slice(0, eq).trim()
    let val = part.slice(eq + 1).trim()
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1)
    }
    result[key] = val
  }

  return result
}

export async function parseMultipartForm(req, maxBytes = 10 * 1024 * 1024) {
  const contentType = req.headers['content-type'] || ''
  const boundaryMatch = contentType.match(/boundary=(.+)$/i)

  if (!contentType.toLowerCase().includes('multipart/form-data') || !boundaryMatch) {
    throw new Error('Unsupported content type. Expected multipart/form-data')
  }

  const boundary = boundaryMatch[1]
  const body = await readRawBody(req, maxBytes)
  const boundaryBuffer = Buffer.from(`--${boundary}`)

  const parts = []
  let start = 0
  while (start < body.length) {
    const boundaryIndex = body.indexOf(boundaryBuffer, start)
    if (boundaryIndex === -1) break

    const nextBoundaryIndex = body.indexOf(boundaryBuffer, boundaryIndex + boundaryBuffer.length)
    if (nextBoundaryIndex === -1) break

    const partBuffer = body.slice(boundaryIndex + boundaryBuffer.length + 2, nextBoundaryIndex - 2)
    if (partBuffer.length > 0) {
      parts.push(partBuffer)
    }

    start = nextBoundaryIndex
  }

  const fields = {}
  const files = {}

  for (const part of parts) {
    const headerEnd = part.indexOf(Buffer.from(`${CRLF}${CRLF}`))
    if (headerEnd === -1) continue

    const headerText = part.slice(0, headerEnd).toString('utf8')
    const content = part.slice(headerEnd + 4)

    const headers = parseHeaders(headerText)
    const disposition = parseContentDisposition(headers['content-disposition'] || '')
    const fieldName = disposition.name

    if (!fieldName) continue

    if (disposition.filename) {
      files[fieldName] = {
        filename: disposition.filename,
        contentType: headers['content-type'] || 'application/octet-stream',
        buffer: content
      }
      continue
    }

    fields[fieldName] = content.toString('utf8').trim()
  }

  return { fields, files }
}

export function sanitizeFilename(filename = 'bill') {
  const cleaned = filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120)

  return cleaned || 'bill'
}

export function createSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

export function buildStoragePath({ adminId, filename }) {
  const now = new Date()
  const yyyy = String(now.getUTCFullYear())
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const ts = now.toISOString().replace(/[:.]/g, '-')
  return `ceb/${yyyy}/${mm}/${adminId}/${ts}_${sanitizeFilename(filename)}`
}
