// e2e/a11y.spec.js — an automated accessibility scan (axe) of each page a visitor reaches, in both themes.
//
// Fails on serious or critical WCAG 2.x A/AA problems: text too faint to read, controls without a name, broken ARIA.
// Runs with reduced motion so nothing is caught half faded in. An automated scan finds roughly a third of real issues;
// it is a floor, not a sign-off.

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ reducedMotion: 'reduce' });

for (const theme of ['dark', 'light']) {
  for (const path of ['/', '/pro', '/settings']) {
    test(`${path} has no serious accessibility problems (${theme})`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('solar.v3.theme', t), theme);
      await page.goto(path);
      await expect(page.locator('main#main')).toBeVisible();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('.v3-skeleton')).toHaveCount(0);

      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      const report = serious.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.slice(0, 5).map((n) => n.target.join(' ')).join('\n  ')}`).join('\n');
      expect(serious, report).toEqual([]);
    });
  }
}
