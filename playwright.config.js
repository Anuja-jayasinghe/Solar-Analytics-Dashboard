// Playwright smoke suite — the safety net for the UI redesign.
//
// It runs the production build under `vite preview` with fake Supabase credentials and no Clerk
// key, so it needs no secrets and no network beyond localhost, and every visitor is on the demo.
// That fixes what it can check: the pages a visitor reaches, the access gates, redirects, and that
// none of it requests real data. Signed-in flows need a Clerk test user and are not covered.
//
//   pnpm test:e2e                          build, serve, test (Chromium)
//   pnpm exec playwright install chromium  once, to download the browser

import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } }
  ],
  webServer: {
    command: `pnpm exec vite build && pnpm exec vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // A host the tests can recognise: any request to it is a dashboard query.
      VITE_SUPABASE_URL: 'https://e2e-stub.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'e2e-anon-key',
      // Empty: no ClerkProvider, every visitor is on the demo (AccessProvider -> LocalAccess).
      VITE_CLERK_PUBLISHABLE_KEY: '',
      VITE_USE_CLERK_AUTH: 'false',
      VITE_ENABLE_DEVTOOLS: 'false'
    }
  }
});
