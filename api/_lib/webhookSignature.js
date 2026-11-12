// api/_lib/webhookSignature.js
//
// Verifies a Resend webhook (LR-005 rule 2). Resend signs webhooks with Svix:
//   headers   svix-id, svix-timestamp (Unix seconds), svix-signature ("v1,<base64> v1,<base64> …")
//   secret    "whsec_<base64>": the HMAC key is the base64-decoded part after the prefix
//   signed    `${svix-id}.${svix-timestamp}.${raw body}`, HMAC-SHA256, base64
// The body must be the raw bytes as received: parsing and re-serialising JSON changes them.
// A timestamp more than 5 minutes from now is refused, so a captured request cannot be replayed later.
//
// Written out here rather than adding the `svix` package: it is twenty lines of node:crypto, and every
// dependency is one more thing in the function bundle.

import crypto from 'node:crypto';

export const SIGNATURE_TOLERANCE_SEC = 5 * 60;

const header = (headers, name) => {
  const v = headers?.[name] ?? headers?.[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
};

/** The HMAC key from a `whsec_…` secret, or null when the secret is unusable. */
function keyOf(secret) {
  if (typeof secret !== 'string' || !secret.trim()) return null;
  const raw = secret.trim().startsWith('whsec_') ? secret.trim().slice(6) : secret.trim();
  const key = Buffer.from(raw, 'base64');
  return key.length > 0 ? key : null;
}

/** The v1 signature for a payload (exported for tests, which sign their own fixtures). */
export function signPayload({ secret, id, timestamp, body }) {
  const key = keyOf(secret);
  if (!key) throw new Error('unusable webhook secret');
  return crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
}

/**
 * @param {{ secret: string, headers: object, body: string|Buffer, nowMs?: number }} input
 * @returns {{ ok: true } | { ok: false, reason: string }}  the reason names what was wrong, never a value
 */
export function verifyWebhookSignature({ secret, headers, body, nowMs = Date.now() }) {
  const key = keyOf(secret);
  if (!key) return { ok: false, reason: 'no_secret' };

  const id = header(headers, 'svix-id');
  const timestamp = header(headers, 'svix-timestamp');
  const signatures = header(headers, 'svix-signature');
  if (!id || !timestamp || !signatures) return { ok: false, reason: 'missing_headers' };

  const ts = Number(timestamp);
  if (!Number.isInteger(ts)) return { ok: false, reason: 'bad_timestamp' };
  if (Math.abs(nowMs / 1000 - ts) > SIGNATURE_TOLERANCE_SEC) return { ok: false, reason: 'stale_timestamp' };

  const payload = Buffer.isBuffer(body) ? body.toString('utf8') : String(body ?? '');
  const expected = Buffer.from(crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${payload}`).digest('base64'));

  for (const part of String(signatures).split(' ')) {
    const [version, sig] = part.split(',');
    if (version !== 'v1' || !sig) continue;
    const given = Buffer.from(sig);
    if (given.length === expected.length && crypto.timingSafeEqual(given, expected)) return { ok: true };
  }
  return { ok: false, reason: 'no_matching_signature' };
}
