#!/usr/bin/env node
// scripts/check-bundle-size.mjs
//
// Fails the build when the production bundle grows past its budget (bundle-budget.json), so a slower page is a
// decision someone makes, not something that creeps in. Sizes are gzipped, as a browser downloads them. Run after
// `pnpm build`:  node scripts/check-bundle-size.mjs
//
// A budget is about 10% over the size when it was set. To raise one, change bundle-budget.json in the same PR and
// say why; never raise it just to make CI pass.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const budget = JSON.parse(readFileSync('bundle-budget.json', 'utf8'));
if (!existsSync(join(DIST, 'index.html'))) {
  console.error('No dist/index.html: run `pnpm build` first.');
  process.exit(1);
}

const kb = (bytes) => bytes / 1024;
const gz = (file) => gzipSync(readFileSync(join(DIST, 'assets', file))).length;
const files = readdirSync(join(DIST, 'assets'));
const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const entryName = html.match(/assets\/(index-[^"']+\.js)/)?.[1];
if (!entryName) {
  console.error('Could not find the entry script in dist/index.html.');
  process.exit(1);
}

const measured = {
  entryJs: kb(gz(entryName)),
  totalJs: kb(files.filter((f) => f.endsWith('.js')).reduce((s, f) => s + gz(f), 0)),
  totalCss: kb(files.filter((f) => f.endsWith('.css')).reduce((s, f) => s + gz(f), 0))
};

let failed = false;
for (const [key, limit] of Object.entries(budget.gzipKb)) {
  const size = measured[key];
  const ok = size <= limit;
  if (!ok) failed = true;
  console.log(`${ok ? 'ok  ' : 'OVER'} ${key.padEnd(9)} ${size.toFixed(1).padStart(6)} KB gzip  (budget ${limit} KB)`);
}
if (failed) {
  console.error('\nThe bundle is over budget. Shrink it, or raise the budget in bundle-budget.json with a reason in the PR.');
  process.exit(1);
}
