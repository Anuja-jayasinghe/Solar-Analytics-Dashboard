// e2e/behaviour.spec.js — how the Overview behaves in a real browser, beyond "it renders".
//
// Same set-up as smoke.spec.js: the production build, a signed-out visitor, the demo data (fixed, dated 2035+).
// Locks in the things unit tests cannot see: the motion ends on the real figures, charts draw when they are scrolled
// to, the date pickers jump by month and year, the Mark above line stays inside its chart, nothing scrolls sideways
// on a small phone, and light mode really is light.

import { test, expect } from '@playwright/test';

const desktopOnly = (testInfo) => test.skip(testInfo.project.name !== 'chromium', 'desktop layout');

/** The three headline figures once they have stopped changing. */
async function settledHeadline(page) {
  const values = page.getByRole('region', { name: 'Totals' }).locator('.v3-kpi-value');
  await expect(values).toHaveCount(3);
  let last = '';
  await expect.poll(async () => {
    const now = (await values.allTextContents()).join(' | ');
    const stable = now === last && /\d/.test(now);
    last = now;
    return stable;
  }, { intervals: [400], timeout: 10_000 }).toBe(true);
  return last;
}

test('the headline figures count up and land on exactly the real values', async ({ browser }) => {
  const still = await browser.newContext({ reducedMotion: 'reduce' });
  const truthPage = await still.newPage();
  await truthPage.goto('/');
  const truth = await settledHeadline(truthPage); // reduced motion: shown as is, no counting
  await still.close();

  const moving = await browser.newContext();
  const page = await moving.newPage();
  await page.goto('/');
  expect(await settledHeadline(page)).toBe(truth);
  await moving.close();
});

test('with reduced motion nothing is held back: no hidden section, no chart waiting to draw', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  await settledHeadline(page);
  await expect(page.locator('[data-reveal="pending"]')).toHaveCount(0);
  await expect(page.locator('[data-draw="pending"]')).toHaveCount(0);
  await ctx.close();
});

test('a chart below the first screen waits, then draws when it is scrolled to', async ({ page }) => {
  await page.goto('/');
  await settledHeadline(page);
  const chart = page.locator('[data-draw]').last();
  await expect(chart).toHaveAttribute('data-draw', 'pending');
  await chart.scrollIntoViewIfNeeded();
  await expect(chart).toHaveAttribute('data-draw', 'in');
});

test('the day calendar jumps by month and year', async ({ page }) => {
  await page.goto('/');
  const dateButton = page.getByRole('button', { name: /^Day: / });
  await dateButton.scrollIntoViewIfNeeded();
  await dateButton.click();
  const dialog = page.getByRole('dialog', { name: 'Choose day' });
  await dialog.getByRole('button', { name: /choose month and year/ }).click();
  await dialog.getByRole('button', { name: 'Previous year' }).click();
  await dialog.getByRole('button', { name: 'Mar', exact: true }).click();
  await dialog.getByRole('gridcell', { name: '10 Mar 2035', exact: true }).click();
  await expect(dateButton).toHaveText('10 Mar 2035');
});

test('week and month labels open a picker', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await page.goto('/');
  await page.getByRole('tab', { name: 'Over time' }).click();
  await page.getByRole('button', { name: 'Week', exact: true }).click();
  await page.getByRole('button', { name: 'Choose a week' }).click();
  await page.getByRole('dialog', { name: 'Choose a week' }).getByRole('gridcell', { name: '1 Sep 2036', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Week' })).toContainText('Week 36 · 2036');

  await page.getByRole('button', { name: 'Month', exact: true }).click();
  await page.getByRole('button', { name: /^Month: / }).click();
  const months = page.getByRole('dialog', { name: 'Choose a month' });
  await months.getByRole('button', { name: 'Previous year' }).click();
  await months.getByRole('button', { name: 'Mar', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Month' })).toContainText('March 2035');
});

test('the Mark above line stops at the top of its chart, however long it is held there', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await page.goto('/');
  const plot = page.locator('.v3-ceb .v3-plot');
  await plot.scrollIntoViewIfNeeded();
  const handle = plot.getByRole('slider', { name: 'Mark above' });
  const box = await handle.boundingBox();
  const top = (await plot.boundingBox()).y;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 0; i < 15; i++) await page.mouse.move(box.x + box.width / 2, top - 30 - i);
  await page.mouse.up();
  const max = await handle.getAttribute('aria-valuemax');
  await expect(handle).toHaveAttribute('aria-valuenow', max);
  await expect(page.locator('.v3-ceb .v3-yaxis span').first()).toHaveText(Number(max).toLocaleString('en-US')); // the scale did not grow
});

test('nothing scrolls sideways on a small phone, on any Explore tab', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  await settledHeadline(page);
  const sideways = () => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(await sideways()).toBe(false);
  for (const tab of ['Generation', 'Day', 'Stats']) {
    await page.getByRole('tab', { name: tab }).click();
    await page.waitForTimeout(300);
    expect(await sideways(), `sideways scroll on the ${tab} tab`).toBe(false);
  }
  await ctx.close();
});

test('light mode is light: the date picker is not a dark panel', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('solar.v3.theme', 'light'));
  await page.goto('/');
  const dateButton = page.getByRole('button', { name: /^Day: / });
  await dateButton.scrollIntoViewIfNeeded();
  await dateButton.click();
  const luminance = await page.locator('.v3-cal').evaluate((el) => {
    const [r, g, b] = getComputedStyle(el).backgroundColor.match(/\d+(\.\d+)?/g).map(Number);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  });
  expect(luminance).toBeGreaterThan(0.85);
});

test('the rising sun lights one ray per 2.5% of the maximum and marks today\'s peak', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  const meter = page.getByRole('meter', { name: 'Live power' });
  await expect(meter).toHaveAttribute('aria-valuenow', /\d/);
  const now = Number(await meter.getAttribute('aria-valuenow'));
  const max = Number(await meter.getAttribute('aria-valuemax'));
  await expect(meter.locator('.v3-sun-ray[data-lit]')).toHaveCount(Math.ceil((now / max) * 40));
  await expect(meter.locator('.v3-sun-peak')).toBeVisible();
  await expect(page.locator('.v3-gauge-peak')).toContainText(/^Peak \d+(\.\d)? kW/);
  await ctx.close();
});
