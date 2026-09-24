// tests/cebBillUploadUtils.test.js
//
// The upload endpoint uses a hand-rolled multipart parser and trusts nothing else about the
// file, so its behaviour is pinned here.

import { describe, it, expect } from 'vitest';
import { Readable } from 'node:stream';
import {
  parseMultipartForm,
  looksLikePdf,
  buildStoragePath,
  sanitizeFilename
} from '../api/_lib/cebBillUploadUtils.js';

const CRLF = '\r\n';

function multipartBody(boundary, { fields = {}, file } = {}) {
  const chunks = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(
      Buffer.from(`--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`)
    );
  }
  if (file) {
    chunks.push(
      Buffer.from(
        `--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="${file.filename}"${CRLF}` +
          `Content-Type: ${file.contentType}${CRLF}${CRLF}`
      ),
      file.buffer,
      Buffer.from(CRLF)
    );
  }
  chunks.push(Buffer.from(`--${boundary}--${CRLF}`));
  return Buffer.concat(chunks);
}

function fakeRequest(contentType, body) {
  const req = Readable.from([body]);
  req.headers = { 'content-type': contentType };
  return req;
}

describe('parseMultipartForm', () => {
  const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.from([0, 255, 13, 10, 128]), Buffer.from('\n%%EOF')]);

  it('extracts fields and a binary file intact', async () => {
    const body = multipartBody('XBOUNDARYX', {
      fields: { source_type: 'manual_upload' },
      file: { filename: 'bill.pdf', contentType: 'application/pdf', buffer: pdf }
    });
    const { fields, files } = await parseMultipartForm(
      fakeRequest('multipart/form-data; boundary=XBOUNDARYX', body)
    );

    expect(fields.source_type).toBe('manual_upload');
    expect(files.file.filename).toBe('bill.pdf');
    expect(files.file.contentType).toBe('application/pdf');
    expect(files.file.buffer.equals(pdf)).toBe(true);
  });

  it('accepts a quoted boundary followed by other parameters', async () => {
    const body = multipartBody('quoted-b', {
      file: { filename: 'a.pdf', contentType: 'application/pdf', buffer: pdf }
    });
    const { files } = await parseMultipartForm(
      fakeRequest('multipart/form-data; boundary="quoted-b"; charset=utf-8', body)
    );
    expect(files.file.buffer.equals(pdf)).toBe(true);
  });

  it('rejects a request that is not multipart', async () => {
    await expect(parseMultipartForm(fakeRequest('application/json', Buffer.from('{}')))).rejects.toThrow(
      /multipart/i
    );
  });

  it('rejects a multipart request that has no boundary', async () => {
    await expect(parseMultipartForm(fakeRequest('multipart/form-data', Buffer.from('x')))).rejects.toThrow();
  });

  it('enforces the size limit', async () => {
    const big = Buffer.alloc(2048, 1);
    const body = multipartBody('B', { file: { filename: 'a.pdf', contentType: 'application/pdf', buffer: big } });
    await expect(
      parseMultipartForm(fakeRequest('multipart/form-data; boundary=B', body), 1024)
    ).rejects.toThrow(/too large/i);
  });
});

describe('looksLikePdf', () => {
  it('accepts a buffer that starts with the PDF marker', () => {
    expect(looksLikePdf(Buffer.from('%PDF-1.4\n...'))).toBe(true);
  });

  it('accepts a marker preceded by junk within the first 1024 bytes, as the spec allows', () => {
    expect(looksLikePdf(Buffer.concat([Buffer.alloc(100, 32), Buffer.from('%PDF-1.4')]))).toBe(true);
  });

  it('rejects a PNG, an HTML file and text renamed to .pdf', () => {
    expect(looksLikePdf(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(false);
    expect(looksLikePdf(Buffer.from('<html><script>alert(1)</script></html>'))).toBe(false);
    expect(looksLikePdf(Buffer.from('just some text'))).toBe(false);
  });

  it('rejects a marker that only appears after the first 1024 bytes', () => {
    expect(looksLikePdf(Buffer.concat([Buffer.alloc(2000, 32), Buffer.from('%PDF-1.4')]))).toBe(false);
  });

  it('rejects empty and non-buffer input', () => {
    expect(looksLikePdf(Buffer.alloc(0))).toBe(false);
    expect(looksLikePdf(null)).toBe(false);
    expect(looksLikePdf('%PDF-1.4')).toBe(false);
  });
});

describe('storage path', () => {
  it('sanitizes hostile file names', () => {
    expect(sanitizeFilename('../../etc/passwd')).not.toMatch(/[\\/]/);
    expect(sanitizeFilename('bill (1) final.pdf')).toBe('bill_1_final.pdf');
  });

  it('always ends in .pdf, whatever name the client sent', () => {
    expect(buildStoragePath({ adminId: 'user_1', filename: 'statement.PNG' })).toMatch(/_statement\.PNG\.pdf$/);
    expect(buildStoragePath({ adminId: 'user_1', filename: 'statement.PDF' })).toMatch(/_statement\.PDF$/);
    expect(buildStoragePath({ adminId: 'user_1', filename: undefined })).toMatch(/_bill\.pdf$/);
  });
});
