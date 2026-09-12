// tests/httpSecurity.test.js
//
// Covers the shared CORS / preflight helper. Before this existed, every endpoint sent
// `Access-Control-Allow-Origin: *` together with `Access-Control-Allow-Credentials: true` —
// an invalid pairing that was simultaneously too permissive and non-functional. These tests
// pin the allowlist behaviour so it cannot quietly regress to a wildcard.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { applyCors, handlePreflightAndMethod } from '../api/_lib/httpSecurity.js';

/** Minimal stand-ins for Node's req/res, capturing what the handler sets. */
function mockReq({ origin, method = 'POST' } = {}) {
  return { headers: origin ? { origin } : {}, method };
}

function mockRes() {
  return {
    headers: {},
    statusCode: null,
    body: null,
    ended: false,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    }
  };
}

const ORIGINAL_ENV = process.env.ALLOWED_ORIGINS;

beforeEach(() => {
  delete process.env.ALLOWED_ORIGINS;
});

afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.ALLOWED_ORIGINS;
  else process.env.ALLOWED_ORIGINS = ORIGINAL_ENV;
});

describe('applyCors', () => {
  it('reflects an allowed origin and permits credentials', () => {
    const res = mockRes();
    applyCors(mockReq({ origin: 'https://solaredge.anujajay.com' }), res);

    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://solaredge.anujajay.com');
    expect(res.headers['Access-Control-Allow-Credentials']).toBe('true');
  });

  it('sets Vary: Origin so a cache cannot serve one origin the other’s response', () => {
    const res = mockRes();
    applyCors(mockReq({ origin: 'https://solaredge.anujajay.com' }), res);
    expect(res.headers.Vary).toBe('Origin');
  });

  it('never emits a wildcard origin', () => {
    const res = mockRes();
    applyCors(mockReq({ origin: 'https://evil.example.com' }), res);
    expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('sends no allow-origin at all for a disallowed origin, so the browser blocks it', () => {
    const res = mockRes();
    applyCors(mockReq({ origin: 'https://attacker.test' }), res);
    expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
    expect(res.headers['Access-Control-Allow-Credentials']).toBeUndefined();
  });

  it('allows localhost dev origins', () => {
    const res = mockRes();
    applyCors(mockReq({ origin: 'http://localhost:5173' }), res);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
  });

  it('allows this project’s Vercel preview deployments', () => {
    const res = mockRes();
    applyCors(mockReq({ origin: 'https://solar-analytics-dashboard-abc123.vercel.app' }), res);
    expect(res.headers['Access-Control-Allow-Origin']).toBe(
      'https://solar-analytics-dashboard-abc123.vercel.app'
    );
  });

  it('does not allow an unrelated vercel.app project', () => {
    const res = mockRes();
    applyCors(mockReq({ origin: 'https://some-other-app.vercel.app' }), res);
    expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('honours ALLOWED_ORIGINS when set', () => {
    process.env.ALLOWED_ORIGINS = 'https://staging.example.com';
    const allowed = mockRes();
    applyCors(mockReq({ origin: 'https://staging.example.com' }), allowed);
    expect(allowed.headers['Access-Control-Allow-Origin']).toBe('https://staging.example.com');

    // Overriding replaces the defaults rather than appending to them.
    const previouslyDefault = mockRes();
    applyCors(mockReq({ origin: 'https://solaredge.anujajay.com' }), previouslyDefault);
    expect(previouslyDefault.headers['Access-Control-Allow-Origin']).toBeUndefined();
  });
});

describe('handlePreflightAndMethod', () => {
  it('answers OPTIONS with 204 and tells the handler to stop', () => {
    const res = mockRes();
    const stop = handlePreflightAndMethod(mockReq({ method: 'OPTIONS' }), res, ['POST']);

    expect(stop).toBe(true);
    expect(res.statusCode).toBe(204);
    expect(res.ended).toBe(true);
  });

  it('rejects a method the endpoint does not accept', () => {
    const res = mockRes();
    const stop = handlePreflightAndMethod(mockReq({ method: 'DELETE' }), res, ['POST']);

    expect(stop).toBe(true);
    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toContain('POST');
  });

  it('lets an accepted method through', () => {
    const res = mockRes();
    const stop = handlePreflightAndMethod(mockReq({ method: 'POST' }), res, ['POST']);

    expect(stop).toBe(false);
    expect(res.statusCode).toBeNull();
  });

  it('advertises OPTIONS alongside the accepted methods', () => {
    const res = mockRes();
    handlePreflightAndMethod(mockReq({ method: 'POST' }), res, ['GET', 'POST']);
    expect(res.headers['Access-Control-Allow-Methods']).toBe('GET,POST,OPTIONS');
  });
});
