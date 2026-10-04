// src/v3/data/adminApi.js
//
// The browser's way of calling the admin-only endpoints (bill pipeline, users). Every call carries the
// Clerk token; the SERVER re-checks the admin role and validates the input, this only carries requests.
// Nothing here writes to Supabase directly. Errors become ApiError with the server's own message, so the
// screen can say exactly what was wrong (for example which bill field failed validation).

import { ApiError } from './client.js';

/**
 * @param {{getToken:()=>Promise<string|null>, fetchImpl?:typeof fetch}} deps
 */
export function createAdminApi({ getToken, fetchImpl = (...a) => globalThis.fetch(...a) }) {
  async function call(method, url, { json, form } = {}) {
    const token = await getToken();
    if (!token) throw new ApiError('Not signed in', { status: 401, code: 'no_session' });
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
    let body;
    if (form) body = form; // the browser sets the multipart boundary itself
    else if (json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
    let res;
    try {
      res = await fetchImpl(url, { method, headers, body });
    } catch {
      throw new ApiError('Network error', { status: 0, code: 'network' });
    }
    let payload = null;
    try { payload = await res.json(); } catch { /* an empty or non-JSON body is handled by the status below */ }
    if (!res.ok) {
      const detail = Array.isArray(payload?.details) ? payload.details.join('; ') : payload?.details;
      throw new ApiError(detail || payload?.error || `Request failed (${res.status})`, { status: res.status, code: payload?.code || `http_${res.status}`, });
    }
    return payload ?? {};
  }

  return {
    /** Verification queue: extractions awaiting review (and already approved), plus ingestions that failed. */
    listQueue: () => call('GET', '/api/ceb-bills/ingestions?view=queue'),
    /** Upload one bill PDF. 409 means this exact file is already ingested (the error carries ingestionId). */
    uploadBill: (file) => {
      const form = new FormData();
      form.append('file', file);
      return call('POST', '/api/ceb-bills/upload', { form });
    },
    /** Read the uploaded PDF into an extraction. */
    extract: (ingestionId) => call('POST', '/api/ceb-bills/extract', { json: { ingestionId } }),
    /** Approve a reviewed bill: one transaction on the server. */
    approve: ({ extractionId, ingestionId, record }) => call('PUT', '/api/ceb-bills/records', { json: { extractionId, ingestionId, record } }),
    /** Permanently discard an upload (file, extraction and anything derived from it). */
    discard: (ingestionId) => call('DELETE', '/api/ceb-bills/delete', { json: { ingestionId } }),
    /** A five-minute link to one bill PDF. */
    signedUrl: (filePath) => call('POST', '/api/ceb-bills/signed-url', { json: { filePath } }),
    /** Every saved bill with all columns (needed for ids and to carry unedited columns through an edit). */
    listRecords: () => call('GET', '/api/ceb-bills/records'),
    /** Edit a saved bill: the endpoint validates the whole record. */
    updateRecord: (id, record) => call('PATCH', '/api/ceb-bills/records', { json: { id, record } }),
    /** Permanently delete one saved bill (and the upload and PDF behind it). */
    deleteRecord: (recordId) => call('DELETE', '/api/ceb-bills/delete', { json: { recordId } }),
    listUsers: () => call('GET', '/api/admin/users'),
    /** Remove a person's account entirely. The server refuses to delete the caller. */
    deleteUser: (userId) => call('DELETE', `/api/admin/users/${encodeURIComponent(userId)}`),
    setRole: (userId, role) => call('PATCH', `/api/admin/users/${encodeURIComponent(userId)}`, { json: { role } })
  };
}
