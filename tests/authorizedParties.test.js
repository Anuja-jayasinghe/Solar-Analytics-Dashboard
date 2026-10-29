// tests/authorizedParties.test.js — which origins may mint tokens the API accepts.

import { describe, it, expect, vi } from 'vitest';

vi.mock('@clerk/backend', () => ({ createClerkClient: () => ({}), verifyToken: vi.fn() }));
const { getAuthorizedParties } = await import('../api/_lib/verifyAdminToken.js');

const PROD = 'https://solaredge.anujajay.com';

describe('getAuthorizedParties()', () => {
  it('production: the site and local dev ports only', () => {
    const parties = getAuthorizedParties({ VERCEL_ENV: 'production', VERCEL_URL: 'solar-x.vercel.app' });
    expect(parties).toContain(PROD);
    expect(parties.some((p) => p.includes('vercel.app'))).toBe(false);
  });

  it('preview: adds exactly this deployment and its branch alias', () => {
    const parties = getAuthorizedParties({
      VERCEL_ENV: 'preview',
      VERCEL_URL: 'solar-analytics-dashboard-abc123-anuja-jayasinghes-projects.vercel.app',
      VERCEL_BRANCH_URL: 'solar-analytics-dashboard-git-chore-x-anuja-jayasinghes-projects.vercel.app'
    });
    expect(parties).toContain('https://solar-analytics-dashboard-abc123-anuja-jayasinghes-projects.vercel.app');
    expect(parties).toContain('https://solar-analytics-dashboard-git-chore-x-anuja-jayasinghes-projects.vercel.app');
    expect(parties).toContain(PROD);
  });

  it('preview: ignores a malformed host rather than trusting it', () => {
    const parties = getAuthorizedParties({ VERCEL_ENV: 'preview', VERCEL_URL: 'evil.com/https://x' });
    expect(parties.some((p) => p.includes('evil'))).toBe(false);
  });

  it('an explicit CLERK_AUTHORIZED_PARTIES replaces the defaults', () => {
    expect(getAuthorizedParties({ CLERK_AUTHORIZED_PARTIES: 'https://a.example, https://b.example' }))
      .toEqual(['https://a.example', 'https://b.example']);
  });
});
