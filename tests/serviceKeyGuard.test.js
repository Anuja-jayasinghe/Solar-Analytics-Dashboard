// tests/serviceKeyGuard.test.js
//
// The scheduled collectors call this at start-up. It exists because a GitHub Actions secret
// holding an anon key stopped inverter collection for five months without failing a single job.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { exitOnServiceKeyProblem } from '../api/_lib/serviceKeyGuard.js';

const jwt = (role) => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256' })}.${b64({ role })}.signature`;
};

const URL = 'https://example.supabase.co';

afterEach(() => vi.restoreAllMocks());

function run(url, key) {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const exit = vi.fn();
  exitOnServiceKeyProblem(url, key, exit);
  return exit;
}

describe('exitOnServiceKeyProblem', () => {
  it('lets a service-role key through', () => {
    expect(run(URL, jwt('service_role'))).not.toHaveBeenCalled();
    expect(run(URL, 'sb_secret_abc123')).not.toHaveBeenCalled();
  });

  it('exits non-zero for an anon key — the exact misconfiguration behind the outage', () => {
    expect(run(URL, jwt('anon'))).toHaveBeenCalledWith(1);
    expect(run(URL, 'sb_publishable_abc123')).toHaveBeenCalledWith(1);
  });

  it('exits non-zero when the key or URL is missing', () => {
    expect(run(URL, undefined)).toHaveBeenCalledWith(1);
    expect(run(undefined, jwt('service_role'))).toHaveBeenCalledWith(1);
  });

  it('names the fix in what it prints', () => {
    const errors = [];
    vi.spyOn(console, 'error').mockImplementation((m) => errors.push(String(m)));
    exitOnServiceKeyProblem(URL, jwt('anon'), () => {});
    expect(errors.join('\n')).toMatch(/service_role/);
  });
});
