// tests/functionBudget.test.js
//
// Vercel Hobby deploys at most 12 serverless functions. Every .js file under api/ is one, except
// files and folders whose name starts with "_" (api/_lib, api/_config). Going over the cap fails
// the deploy, not the build, so this test catches it in CI instead.

import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const API_DIR = join(import.meta.dirname, '..', 'api');
const HOBBY_FUNCTION_LIMIT = 12;

function functionFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return functionFiles(path);
    return /\.(js|mjs|cjs|ts)$/.test(entry.name) ? [relative(API_DIR, path)] : [];
  });
}

describe('serverless function budget', () => {
  it(`stays within Vercel Hobby's ${HOBBY_FUNCTION_LIMIT} functions`, () => {
    const files = functionFiles(API_DIR);
    expect(files.length, `functions: ${files.join(', ')}`).toBeLessThanOrEqual(HOBBY_FUNCTION_LIMIT);
  });

  it('serves every bill endpoint, the email webhook included, from one function', () => {
    expect(functionFiles(API_DIR).filter((f) => f.startsWith('ceb-bills'))).toEqual(['ceb-bills/[action].js']);
  });
});
