// e2e/goal.spec.js — the daily goal tile, drawn as a little power grid: ten buildings, each 10% of today's target.
// Same set-up as smoke.spec.js: the production build, a signed-out visitor on demo data.

import { test, expect } from '@playwright/test';

test('the daily goal town lights one building per 10% of today\'s target', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  const tile = page.getByRole('region', { name: 'Today and live' }).locator('.v3-today');
  await expect(tile.locator('.v3-board')).toHaveAttribute('data-reading', /^\d+\.\d$/); // today's kWh on the billboard
  const pctText = await tile.locator('.v3-today-pct').textContent();
  const pct = Number(pctText.match(/(\d+)%/)[1]);
  const fullyLit = await tile.locator('.v3-town').evaluate((svg) => {
    const groups = [...svg.querySelectorAll('g')].filter((g) => g.querySelector('.v3-town-win'));
    return groups.filter((g) => [...g.querySelectorAll('.v3-town-win')].every((w) => w.hasAttribute('data-on'))).length;
  });
  expect(fullyLit).toBe(Math.min(10, Math.floor(pct / 10)));
  await expect(tile.locator('.v3-town')).toHaveAttribute('aria-label', pct >= 100 ? /the whole town is powered/ : new RegExp(`${Math.min(10, Math.floor(pct / 10))} of 10 buildings powered`));
  await ctx.close();
});

test('the kWh billboard follows the theme: dark board in dark mode, light board in light mode', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  // how bright the board face is, 0 (black) to 255 (white)
  const faceLightness = () => page.locator('.v3-board-face').evaluate((el) => {
    const [r, g, b] = getComputedStyle(el).fill.match(/\d+/g).map(Number);
    return (r + g + b) / 3;
  });
  for (const [theme, isLight] of [['dark', false], ['light', true]]) {
    await page.addInitScript((t) => localStorage.setItem('solar.v3.theme', t), theme);
    await page.goto('/');
    await expect(page.locator('.v3-board-face')).toBeVisible();
    const l = await faceLightness();
    if (isLight) expect(l, 'light mode board face').toBeGreaterThan(200);
    else expect(l, 'dark mode board face').toBeLessThan(60);
  }
  await ctx.close();
});
