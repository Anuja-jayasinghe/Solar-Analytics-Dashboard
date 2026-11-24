// tests/errorEvents.test.js
//
// Self-hosted error tracking (#241): redaction (no personal data stored), grouping that survives a
// redeploy, validation of browser reports, the API error shape, the storage call, and the public
// POST /api/ops/error endpoint's guards (same site, size, rate, input).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { redact, pathOnly, fingerprintOf, parseClientError, apiErrorEvent, recordErrorEvent, __test } from '../api/_lib/errorEvents.js';
import { createClientErrorHandler, isSameSite } from '../api/_lib/ops/clientError.js';
import { createRateLimiter } from '../api/_lib/data/rateLimit.js';
import opsRouter, { OPS_ACTIONS } from '../api/ops/[action].js';

beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => { vi.restoreAllMocks(); __test.reset(); });

describe('redact', () => {
  it('removes e-mail addresses, tokens, secret query values and account-length numbers', () => {
    const out = redact('user a.b@example.com sent Bearer abcdefgh12345 eyJhbGciOi.eyJzdWIiOi.sig_x /p?token=s3cret&x=1 acct 1234567890 reading 48190');
    expect(out).not.toMatch(/example\.com|abcdefgh12345|eyJhbGciOi|s3cret|1234567890/);
    expect(out).toContain('[email]');
    expect(out).toContain('Bearer [token]');
    expect(out).toContain('?token=[redacted]&x=1');
    expect(out).toContain('[number]');
    expect(out).toContain('48190'); // short numbers are kept: they are what makes an error readable
  });
});

describe('pathOnly', () => {
  it('keeps the path and drops origin, query and fragment', () => {
    expect(pathOnly('https://solaredge.anujajay.com/explore/day?date=2036-01-01#x')).toBe('/explore/day');
    expect(pathOnly('/admin?tab=bills')).toBe('/admin');
    expect(pathOnly('')).toBeNull();
    expect(pathOnly(42)).toBeNull();
  });
});

describe('fingerprintOf', () => {
  it('is the same across releases, line numbers and changing values', () => {
    const a = fingerprintOf({ source: 'browser:x', message: 'Cannot read "foo" of row 12', stack: 'TypeError\n    at renderTile (https://s/assets/index-AbC123xy.js:1:2345)' });
    const b = fingerprintOf({ source: 'browser:x', message: 'Cannot read "bar" of row 99', stack: 'TypeError\n    at renderTile (https://s/assets/index-ZZZ999qq.js:1:9876)' });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
  });

  it('separates different functions and sources', () => {
    const base = { source: 'browser:x', message: 'boom', stack: 'at f (a.js:1:1)' };
    expect(fingerprintOf(base)).not.toBe(fingerprintOf({ ...base, stack: 'at g (a.js:1:1)' }));
    expect(fingerprintOf(base)).not.toBe(fingerprintOf({ ...base, source: 'browser:y' }));
    expect(fingerprintOf({ ...base, stack: 'f@https://s/a.js:1:1' })).toBe(fingerprintOf({ ...base, stack: 'f@https://s/b.js:9:9' }));
  });
});

describe('parseClientError', () => {
  it('keeps only known fields, cut to length and redacted', () => {
    const r = parseClientError({
      message: 'x'.repeat(2000) + ' a@example.com',
      stack: 'at f (a.js:1:1)',
      source: 'window.error<script>',
      route: 'https://solaredge.anujajay.com/admin?tab=bills',
      release: '3.5.0+abc1234',
      file: 'https://solaredge.anujajay.com/assets/index.js?v=1',
      line: 3,
      email: 'b@example.com',
      user: { id: 'user_1' }
    });
    expect(r.ok).toBe(true);
    expect(r.event.message.length).toBe(500);
    expect(r.event).toMatchObject({ source: 'browser', route: '/admin', release: '3.5.0+abc1234', actor: null, context: { where: 'window.errorscript', file: '/assets/index.js', line: 3 } });
    expect(JSON.stringify(r.event)).not.toContain('example.com');
    expect(r.event.fingerprint).toMatch(/^[0-9a-f]{32}$/);
  });

  it('refuses a report without a message', () => {
    expect(parseClientError(null)).toEqual({ ok: false, reason: 'not an object' });
    expect(parseClientError([])).toEqual({ ok: false, reason: 'not an object' });
    expect(parseClientError({ message: '  ' })).toEqual({ ok: false, reason: 'message is required' });
  });
});

describe('apiErrorEvent', () => {
  it('groups by route, method and status, and redacts the message', () => {
    const e1 = apiErrorEvent({ route: 'data/live', method: 'GET', status: 500, error: new Error('for a@example.com'), actor: 'user_1', release: 'abc1234' });
    const e2 = apiErrorEvent({ route: 'data/live', method: 'GET', status: 500, error: new Error('something else') });
    expect(e1.fingerprint).toBe(e2.fingerprint);
    expect(e1).toMatchObject({ source: 'api', route: 'data/live', actor: 'user_1', release: 'abc1234', context: { status: 500, method: 'GET' } });
    expect(e1.message).toBe('500 on GET data/live: for [email]');
    expect(apiErrorEvent({ route: 'x', method: 'GET', status: 504 }).message).toBe('504 on GET x');
  });
});

describe('recordErrorEvent', () => {
  const event = { fingerprint: 'f', source: 'api', message: 'm', stack: null, route: 'r', release: null, context: null, actor: null };

  it('calls record_error_event with every field', async () => {
    const rpc = vi.fn(async () => ({ data: 3, error: null }));
    expect(await recordErrorEvent({ rpc }, event)).toBe(3);
    expect(rpc).toHaveBeenCalledWith('record_error_event', expect.objectContaining({ p_fingerprint: 'f', p_source: 'api', p_message: 'm', p_route: 'r' }));
  });

  it('warns once and stops when the function does not exist yet; never throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rpc = vi.fn(async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.record_error_event' } }));
    expect(await recordErrorEvent({ rpc }, event)).toBeNull();
    expect(await recordErrorEvent({ rpc }, event)).toBeNull();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    __test.reset();
    expect(await recordErrorEvent({ rpc: async () => { throw new Error('net'); } }, event)).toBeNull();
  });
});

// ------------------------------------------------------------------------------------------------
// POST /api/ops/error
// ------------------------------------------------------------------------------------------------

function mockRes() {
  const res = { statusCode: 200, headers: {}, body: undefined };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.end = () => res;
  return res;
}

const SITE = 'https://solaredge.anujajay.com';
const req = (over = {}) => ({ method: 'POST', headers: { origin: SITE, 'x-forwarded-for': '203.0.113.9' }, body: { message: 'boom', source: 'window.error' }, ...over });

describe('POST /api/ops/error', () => {
  it('stores a valid same-site report and answers 204', async () => {
    const record = vi.fn(async () => 1);
    const handler = createClientErrorHandler({ record, limiter: createRateLimiter({ limit: 10 }) });
    const res = mockRes();
    await handler(req(), res);
    expect(res.statusCode).toBe(204);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ source: 'browser', message: 'boom' }));
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('accepts a text body (sendBeacon) and a same-origin fetch without Origin', async () => {
    const record = vi.fn(async () => 1);
    const handler = createClientErrorHandler({ record, limiter: createRateLimiter({ limit: 10 }) });
    const res = mockRes();
    await handler(req({ headers: { 'sec-fetch-site': 'same-origin' }, body: JSON.stringify({ message: 'x' }) }), res);
    expect(res.statusCode).toBe(204);
  });

  it('refuses other sites, oversized and malformed reports, and floods', async () => {
    const record = vi.fn(async () => 1);
    const handler = createClientErrorHandler({ record, limiter: createRateLimiter({ limit: 2 }) });
    const run = async (r) => { const res = mockRes(); await handler(r, res); return res.statusCode; };

    expect(await run(req({ headers: { origin: 'https://evil.example' } }))).toBe(403);
    expect(await run(req({ headers: { 'sec-fetch-site': 'cross-site' } }))).toBe(403);
    expect(await run(req({ headers: { origin: SITE, 'content-length': '99999' } }))).toBe(413);
    expect(await run(req({ body: 'not json' }))).toBe(400);
    expect(await run(req({ body: 'x'.repeat(9000) }))).toBe(413); // a body over 8 KB without a content-length
    expect(await run(req())).toBe(429); // the third counted call from this address in a minute
    expect(record).not.toHaveBeenCalled();
  });

  it('answers 400 when Vercel cannot parse the JSON body', async () => {
    const handler = createClientErrorHandler({ record: vi.fn(), limiter: createRateLimiter({ limit: 10 }) });
    const r = req();
    Object.defineProperty(r, 'body', { get() { throw new Error('Invalid JSON'); } });
    const res = mockRes();
    await handler(r, res);
    expect(res.statusCode).toBe(400);
  });

  it('only POST', async () => {
    const handler = createClientErrorHandler({ record: vi.fn(), limiter: createRateLimiter() });
    const res = mockRes();
    await handler(req({ method: 'GET' }), res);
    expect(res.statusCode).toBe(405);
  });

  it('same-site check', () => {
    expect(isSameSite({ headers: { origin: SITE } })).toBe(true);
    expect(isSameSite({ headers: { origin: 'https://evil.example', 'sec-fetch-site': 'same-origin' } })).toBe(false);
    expect(isSameSite({ headers: {} })).toBe(false);
  });
});

describe('api/ops/[action].js', () => {
  it('routes known actions and 404s the rest', async () => {
    expect(OPS_ACTIONS).toEqual(['error', 'watch', 'status']);
    const res = mockRes();
    await opsRouter({ query: { action: 'nope' } }, res);
    expect(res.statusCode).toBe(404);
    const res2 = mockRes();
    await opsRouter({ query: { action: '__proto__' } }, res2);
    expect(res2.statusCode).toBe(404);
  });
});
