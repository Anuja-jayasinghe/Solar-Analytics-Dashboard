// tests/healthProbe.test.js — /healthz and /ready (api/health.js) answer HEAD as well as GET, because uptime
// monitors probe with HEAD (UptimeRobot's default) and a 405 there looked like an outage (#241).

import { describe, it, expect, vi } from 'vitest';

vi.mock('../api/_lib/supabaseServer.js', () => ({
  supabase: { from: () => ({ select: () => ({ limit: async () => ({ error: null }) }) }) },
  readKeyRole: () => 'service_role',
  describeConfigProblem: () => null,
  SUPABASE_SERVICE_KEY: 'x'
}));

const { default: handler } = await import('../api/health.js');

function mockRes() {
  const res = { statusCode: 200, headers: {} };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.end = () => res;
  return res;
}

describe('health probes', () => {
  for (const method of ['GET', 'HEAD']) {
    it(`/ready answers 200 to ${method}`, async () => {
      const res = mockRes();
      await handler({ method, headers: {}, query: { probe: 'ready' } }, res);
      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({ status: 'ok', probe: 'ready' });
    });

    it(`/healthz answers 200 to ${method}`, async () => {
      const res = mockRes();
      await handler({ method, headers: {}, query: { probe: 'live' } }, res);
      expect(res.statusCode).toBe(200);
    });
  }

  it('still refuses methods that change things', async () => {
    const res = mockRes();
    await handler({ method: 'POST', headers: {}, query: { probe: 'ready' } }, res);
    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe('GET,HEAD,OPTIONS');
  });
});
