#!/usr/bin/env node
// scripts/make-icons.mjs
//
// Renders the home-screen / favicon / manifest icons from the one logo source, public/favicon.svg (the orange
// bolt mark the sidebar shows), onto the app's dark navy (--bg of "Sunrise Night"). Re-run after changing the logo:
//   node scripts/make-icons.mjs
// Uses the Chromium that Playwright already installs for the e2e job, so there is no image tooling to add.
// iOS rounds the corners itself and turns any transparent pixel black, so every icon is a fully opaque square.

import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const NAVY = '#0A0F1F';
const svg = `data:image/svg+xml;base64,${readFileSync('public/favicon.svg').toString('base64')}`;

// `mark` is the logo's share of the icon edge. The maskable icon keeps it inside the central 80% "safe zone"
// that Android may crop to a circle; the rest leave room for iOS's rounded corners.
const ICONS = [
  { file: 'apple-touch-icon.png', size: 180, mark: 0.66 },
  { file: 'icon-192.png', size: 192, mark: 0.66 },
  { file: 'icon-512.png', size: 512, mark: 0.66 },
  { file: 'icon-maskable-512.png', size: 512, mark: 0.56 },
  { file: 'favicon-32.png', size: 32, mark: 0.9, bg: 'transparent' }
];

const browser = await chromium.launch();
try {
  for (const { file, size, mark, bg = NAVY } of ICONS) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    const px = Math.round(size * mark);
    await page.setContent(`<style>html,body{margin:0;width:${size}px;height:${size}px;background:${bg};display:grid;place-items:center}
      img{width:${px}px;height:${px}px;display:block}</style><img src="${svg}">`);
    await page.waitForFunction(() => document.images[0].complete);
    writeFileSync(`public/${file}`, await page.screenshot({ type: 'png', omitBackground: bg === 'transparent' }));
    await page.close();
    console.log('wrote public/' + file);
  }
} finally {
  await browser.close();
}
