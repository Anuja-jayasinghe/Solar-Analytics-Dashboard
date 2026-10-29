// e2e/smoke.spec.js — the v3 app as a signed-out visitor.
//
// Runs against the production build with fake Supabase credentials and no Clerk key, so every
// visitor is on the demo source (src/v3/access/AccessProvider.jsx, LocalAccess). Locks in:
//   - the demo makes no request for real data: not to /api/data/*, not to Supabase
//   - pages render without uncaught errors, and never show the "could not be loaded" note
//   - the gates send a visitor to sign-in; old addresses redirect; unknown paths are a real 404

import { test, expect } from '@playwright/test';

/** Record real-data requests and uncaught page errors. */
function watch(page) {
  const dataRequests = [];
  const pageErrors = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/api/data/') || url.includes('e2e-stub.supabase.co')) dataRequests.push(url);
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  return { dataRequests, pageErrors };
}

test('the Overview renders the demo for a visitor and requests no real data', async ({ page }) => {
  const seen = watch(page);
  await page.goto('/');
  await expect(page.locator('main#main')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Totals' })).toBeVisible();
  await expect(page.getByLabel('Live power').first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('could not be loaded')).toHaveCount(0);
  expect(seen.dataRequests).toEqual([]);
  expect(seen.pageErrors).toEqual([]);
});

for (const path of ['/pro', '/settings']) {
  test(`${path} renders for a visitor without errors or real-data requests`, async ({ page }) => {
    const seen = watch(page);
    await page.goto(path);
    await expect(page.locator('main#main')).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(seen.dataRequests).toEqual([]);
    expect(seen.pageErrors).toEqual([]);
  });
}

test('the admin area sends a visitor to sign-in', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole('heading', { name: 'Sign in for the live plant' })).toBeVisible();
});

test('old v1 addresses redirect to their v3 home', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/demodashbaard');
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/login');
  await expect(page).toHaveURL(/\/signin$/);
});

test('the removed v1 app\'s addresses land in v3', async ({ page }) => {
  await page.goto('/v1');
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/v1/settings');
  await expect(page).toHaveURL(/\/settings$/);
  await page.goto('/v1/admin/dashboard/users');
  await expect(page).toHaveURL(/\/signin$/); // /admin, then the gate sends a visitor to sign-in
});

test('an unknown path is a real not-found page', async ({ page }) => {
  const seen = watch(page);
  await page.goto('/no-such-page');
  await expect(page.getByRole('heading', { name: 'This page does not exist' })).toBeVisible();
  expect(seen.pageErrors).toEqual([]);
});
