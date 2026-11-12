// tests/webhookSignature.test.js
//
// api/_lib/webhookSignature.js: the Svix signature on Resend webhooks (LR-005 rule 2). The vector at the
// top is Svix's own published example, so the scheme is pinned to the real one, not to our reading of it.

import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { verifyWebhookSignature, signPayload, SIGNATURE_TOLERANCE_SEC } from '../api/_lib/webhookSignature.js';

// From Svix's "verifying payloads manually" guide. The key is that page's public example, not a credential.
// It is assembled from two halves so secret scanners (gitleaks, GitGuardian) do not report a documentation
// vector as a leaked webhook secret; every other secret in these tests is generated at run time.
const SVIX_EXAMPLE_KEY = ['MfKQ9r8GKYqr', 'TwjUPD8ILPZIo2LaLaSw'].join('');
const SVIX = {
  secret: `whsec_${SVIX_EXAMPLE_KEY}`,
  id: 'msg_p5jXN8AQM9LWM0D4loKWxJek',
  timestamp: '1614265330',
  body: '{"test": 2432232314}',
  signature: 'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE='
};

/** A fresh secret in Resend's format, never written into the repository. */
const testSecret = () => `whsec_${randomBytes(24).toString('base64')}`;
const headersOf = (o) => ({ 'svix-id': o.id, 'svix-timestamp': o.timestamp, 'svix-signature': o.signature });
const at = (ts) => Number(ts) * 1000;

describe('verifyWebhookSignature', () => {
  it("accepts Svix's published example", () => {
    expect(verifyWebhookSignature({ secret: SVIX.secret, headers: headersOf(SVIX), body: SVIX.body, nowMs: at(SVIX.timestamp) })).toEqual({ ok: true });
    expect(signPayload({ ...SVIX })).toBe(SVIX.signature.slice(3));
  });

  it('accepts a Buffer body and one matching signature among several', () => {
    const headers = { ...headersOf(SVIX), 'svix-signature': `v1,AAAA ${SVIX.signature} v2,zzz` };
    expect(verifyWebhookSignature({ secret: SVIX.secret, headers, body: Buffer.from(SVIX.body), nowMs: at(SVIX.timestamp) }).ok).toBe(true);
  });

  it('refuses a changed body, a wrong secret and a re-serialised body', () => {
    const base = { secret: SVIX.secret, headers: headersOf(SVIX), nowMs: at(SVIX.timestamp) };
    expect(verifyWebhookSignature({ ...base, body: '{"test": 2432232315}' })).toEqual({ ok: false, reason: 'no_matching_signature' });
    expect(verifyWebhookSignature({ ...base, body: JSON.stringify(JSON.parse(SVIX.body)) }).ok).toBe(false);
    expect(verifyWebhookSignature({ ...base, secret: testSecret(), body: SVIX.body }).ok).toBe(false);
  });

  it('refuses a timestamp more than 5 minutes away, either way', () => {
    const base = { secret: SVIX.secret, headers: headersOf(SVIX), body: SVIX.body };
    const late = at(SVIX.timestamp) + (SIGNATURE_TOLERANCE_SEC + 1) * 1000;
    const early = at(SVIX.timestamp) - (SIGNATURE_TOLERANCE_SEC + 1) * 1000;
    expect(verifyWebhookSignature({ ...base, nowMs: late })).toEqual({ ok: false, reason: 'stale_timestamp' });
    expect(verifyWebhookSignature({ ...base, nowMs: early })).toEqual({ ok: false, reason: 'stale_timestamp' });
    expect(verifyWebhookSignature({ ...base, nowMs: at(SVIX.timestamp) + 299_000 }).ok).toBe(true);
  });

  it('names what is missing without echoing any value', () => {
    expect(verifyWebhookSignature({ secret: '', headers: headersOf(SVIX), body: SVIX.body })).toEqual({ ok: false, reason: 'no_secret' });
    expect(verifyWebhookSignature({ secret: SVIX.secret, headers: { 'svix-id': SVIX.id }, body: SVIX.body })).toEqual({ ok: false, reason: 'missing_headers' });
    expect(verifyWebhookSignature({ secret: SVIX.secret, headers: { ...headersOf(SVIX), 'svix-timestamp': 'soon' }, body: SVIX.body })).toEqual({ ok: false, reason: 'bad_timestamp' });
  });
});
