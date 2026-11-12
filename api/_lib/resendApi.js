// api/_lib/resendApi.js
//
// The few Resend REST calls the email bill intake needs (LR-005), over fetch: no SDK in the bundle.
//   GET  /emails/receiving/{id}              the received email: headers, `authentication` (spf/dkim/dmarc)
//   GET  /emails/receiving/{id}/attachments  attachments with a signed `download_url` (valid about an hour)
//   POST /emails                             send, with an Idempotency-Key so a retry never sends twice
//
// Errors carry the HTTP status and Resend's message, never the API key. Server-only: RESEND_API_KEY must
// never be prefixed VITE_.

const BASE = 'https://api.resend.com';

export class ResendError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ResendError';
    this.status = status;
  }
}

/**
 * @param {{ apiKey: string, fetchImpl?: typeof fetch, base?: string }} options
 */
export function createResendApi({ apiKey, fetchImpl = globalThis.fetch, base = BASE }) {
  async function call(method, path, { body, idempotencyKey } = {}) {
    const headers = { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    const res = await fetchImpl(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    if (!res.ok) {
      const detail = json?.message || json?.error?.message || res.statusText || 'request failed';
      throw new ResendError(`Resend ${method} ${path.split('?')[0]} failed (${res.status}): ${String(detail).slice(0, 200)}`, res.status);
    }
    return json;
  }

  return {
    getReceivedEmail(emailId) {
      return call('GET', `/emails/receiving/${encodeURIComponent(emailId)}`);
    },

    /** Every attachment of a received email (the list pages at 100). */
    async listAttachments(emailId) {
      const out = [];
      let after = null;
      for (let page = 0; page < 10; page++) {
        const q = new URLSearchParams({ limit: '100' });
        if (after) q.set('after', after);
        const json = await call('GET', `/emails/receiving/${encodeURIComponent(emailId)}/attachments?${q}`);
        const data = Array.isArray(json?.data) ? json.data : [];
        out.push(...data);
        if (!json?.has_more || data.length === 0) return out;
        after = data[data.length - 1].id;
      }
      return out;
    },

    /**
     * Download a signed attachment URL into memory. Refuses more than `maxBytes`, whatever the
     * listing said. The URL is already signed, so no API key is sent with it.
     */
    async download(url, maxBytes) {
      const res = await fetchImpl(url);
      if (!res.ok) throw new ResendError(`Attachment download failed (${res.status})`, res.status);
      const declared = Number(res.headers?.get?.('content-length'));
      if (Number.isFinite(declared) && declared > maxBytes) throw new ResendError('Attachment is larger than allowed', 413);
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length > maxBytes) throw new ResendError('Attachment is larger than allowed', 413);
      return buffer;
    },

    /** Send one email. `idempotencyKey` makes a retried send a no-op for 24 hours. Returns { id }. */
    sendEmail(message, idempotencyKey) {
      return call('POST', '/emails', { body: message, idempotencyKey });
    }
  };
}
