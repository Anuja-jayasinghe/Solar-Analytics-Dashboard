// e2e/goal.spec.js — the daily goal tile, drawn as a little power grid: ten buildings, each 10% of today's target.
// Same set-up as smoke.spec.js: the production build, a signed-out visitor on demo data.

import { test, expect } from '@playwright/test';

test('the daily goal town lights one building per 10% of today\'s target', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  const tile = page.getByRole('region', { name: 'Today and live' }).locator('.v3-today');
  const pctText = await tile.locator('.v3-kpi-value').textContent();
  const pct = Number(pctText.match(/(\d+)%/)[1]);
  const fullyLit = await tile.locator('.v3-town').evaluate((svg) => {
    const groups = [...svg.querySelectorAll('g')].filter((g) => g.querySelector('.v3-town-win'));
    return groups.filter((g) => [...g.querySelectorAll('.v3-town-win')].every((w) => w.hasAttribute('data-on'))).length;
  });
  expect(fullyLit).toBe(Math.min(10, Math.floor(pct / 10)));
  await expect(tile).toContainText(pct >= 100 ? 'The whole town is powered' : `${Math.min(10, Math.floor(pct / 10))} of 10 buildings powered`);
  await ctx.close();
});
