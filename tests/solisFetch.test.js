// tests/solisFetch.test.js — every SolisCloud request carries an abort deadline.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { solisFetch, SOLIS_TIMEOUT_MS } from '../api/_lib/solisAuth.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('solisFetch()', () => {
  it('passes an AbortSignal so a hung gateway cannot hold the caller', async () => {
    vi.stubEnv('SOLIS_API_ID', 'id');
    vi.stubEnv('SOLIS_API_SECRET', 'secret');
    vi.stubEnv('SOLIS_API_URL', 'https://solis.example');
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => '{"success":true,"code":"0"}' }));
    vi.stubGlobal('fetch', fetchMock);

    await solisFetch('/v1/api/inverterList', { pageNo: 1 });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(SOLIS_TIMEOUT_MS).toBeGreaterThan(0);
    expect(SOLIS_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
  });
});
