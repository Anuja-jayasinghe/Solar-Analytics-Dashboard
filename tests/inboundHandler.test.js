// tests/inboundHandler.test.js
//
// api/_lib/cebBills/inbound.js: the HTTP side of the email bill intake (LR-005). The signature is checked
// over the raw body before anything else, a bad one is a 401 (so a mistyped secret is visible in Resend),
// a missing configuration is a 500 (so Resend retries instead of the bill being dropped), and every
// deliberate outcome is a 200.

import { describe, it, expect, vi } from 'vitest';
import { Readable } from 'node:stream';
import { randomBytes } from 'node:crypto';

// The real module builds a Supabase client at import; these tests pass their own fakes.
vi.mock('../api/_lib/supabaseServer.js', () => ({ supabase: {}, blockOnConfigProblem: () => false }));

const { createInboundHandler, readRawBody, MAX_WEBHOOK_BYTES } = await import('../api/_lib/cebBills/inbound.js');
const { signPayload } = await import('../api/_lib/webhookSignature.js');

/** A fresh secret in Resend's format, never written into the repository. */
const testSecret = () => `whsec_${randomBytes(24).toString('base64')}`;
const SECRET = testSecret();
const NOW = 1_900_000_000_000;
const ENV = {
  RESEND_WEBHOOK_SECRET: SECRET,
  RESEND_API_KEY: 're_test',
  BILL_INTAKE_ADDRESS: 'bills-x7k2@mail.example.test',
  BILL_SENDER_DOMAINS: 'edl.lk',
  SOLAR_CEB_ACCOUNT: '1234567890',
  BILL_ALERT_TO: 'owner@example.test'
};

function request(body, { secret = SECRET, timestamp = String(NOW / 1000), method = 'POST', signature } = {}) {
  const id = 'msg_1';
  const req = Readable.from([Buffer.from(body)]);
  req.method = method;
  req.headers = {
    'content-type': 'application/json',
    'svix-id': id,
    'svix-timestamp': timestamp,
    'svix-signature': signature ?? `v1,${signPayload({ secret, id, timestamp, body })}`
  };
  return req;
}

function mockRes() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; }
  };
}

/** A webhook for an email not addressed to the intake: processing stops at the recipient check, no I/O. */
const NOT_FOR_US = JSON.stringify({ type: 'email.received', data: { email_id: 'em_1', to: ['x@y.example'], received_for: [] } });

function handlerWith(env = ENV) {
  const intake = { findByMessage: vi.fn(async () => null) };
  const resend = { getReceivedEmail: vi.fn() };
  const handler = createInboundHandler({ env, nowMs: NOW, db: {}, intake, resend, notifier: { notify: vi.fn() } });
  return { handler, intake, resend };
}

describe('inbound webhook handler', () => {
  it('answers 200 with the outcome for a correctly signed webhook', async () => {
    const { handler, intake } = handlerWith();
    const res = mockRes();
    await handler(request(NOT_FOR_US), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ outcome: 'ignored' });
    expect(intake.findByMessage).toHaveBeenCalledWith('email_forward', 'em_1');
  });

  it('answers 401 for a bad or stale signature, and does nothing', async () => {
    for (const opts of [{ secret: testSecret() }, { timestamp: String(NOW / 1000 - 600) }, { signature: 'v1,bogus' }]) {
      const { handler, intake } = handlerWith();
      const res = mockRes();
      await handler(request(NOT_FOR_US, opts), res);
      expect(res.statusCode).toBe(401);
      expect(intake.findByMessage).not.toHaveBeenCalled();
    }
  });

  it('answers 500 when the secret or another setting is missing, so Resend retries', async () => {
    const noSecret = handlerWith({ ...ENV, RESEND_WEBHOOK_SECRET: '' });
    const r1 = mockRes();
    await noSecret.handler(request(NOT_FOR_US), r1);
    expect(r1.statusCode).toBe(500);
    const noAlert = handlerWith({ ...ENV, BILL_ALERT_TO: '' });
    const r2 = mockRes();
    await noAlert.handler(request(NOT_FOR_US), r2);
    expect(r2.statusCode).toBe(500);
    expect(noAlert.intake.findByMessage).not.toHaveBeenCalled();
  });

  it('answers 200 and does nothing in mode off, even with settings missing', async () => {
    const { handler, intake } = handlerWith({ RESEND_WEBHOOK_SECRET: SECRET, BILL_INTAKE_MODE: 'off' });
    const res = mockRes();
    await handler(request(NOT_FOR_US), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ outcome: 'off' });
    expect(intake.findByMessage).not.toHaveBeenCalled();
  });

  it('answers 400 for a signed body that is not JSON, and 405 for GET', async () => {
    const { handler } = handlerWith();
    const res = mockRes();
    await handler(request('not json'), res);
    expect(res.statusCode).toBe(400);
    const get = mockRes();
    await handler(request(NOT_FOR_US, { method: 'GET' }), get);
    expect(get.statusCode).toBe(405);
  });

  it('answers 500 when processing fails unexpectedly', async () => {
    const { handler, intake } = handlerWith();
    intake.findByMessage.mockRejectedValueOnce(new Error('db down'));
    const res = mockRes();
    await handler(request(NOT_FOR_US), res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Email intake failed' });
  });
});

describe('readRawBody', () => {
  it('returns the bytes as sent, and refuses a body over the limit', async () => {
    expect((await readRawBody(Readable.from([Buffer.from('{"a": 1}')]))).toString()).toBe('{"a": 1}');
    const big = Readable.from([Buffer.alloc(MAX_WEBHOOK_BYTES + 1)]);
    await expect(readRawBody(big)).rejects.toMatchObject({ status: 413 });
  });
});
