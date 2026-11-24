// tests/vercelIgnoreBuild.test.js — which pushes Vercel builds (scripts/vercel-ignore-build.mjs, vercel.json).
// Hobby allows 100 deployments a day; on 2026-11-24 merges (two production builds each) and Dependabot
// rebases (one preview each) used them up.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { shouldBuild } from '../scripts/vercel-ignore-build.mjs';

describe('shouldBuild', () => {
  it('builds production only for Release commits, [deploy], or a deploy without a commit', () => {
    expect(shouldBuild({ env: 'production', message: 'Release v3.9.4\n\nReleased automatically (patch)' })).toBe(true);
    expect(shouldBuild({ env: 'production', message: 'Merge pull request #276 from Anuja-jayasinghe/ci/x' })).toBe(false);
    expect(shouldBuild({ env: 'production', message: 'chore: keepalive heartbeat [skip ci]' })).toBe(false);
    expect(shouldBuild({ env: 'production', message: 'fix: urgent [deploy]' })).toBe(true);
    expect(shouldBuild({ env: 'production', message: '' })).toBe(true);
    expect(shouldBuild({ env: 'production' })).toBe(true);
  });

  it('always builds previews', () => {
    expect(shouldBuild({ env: 'preview', message: 'Merge branch main' })).toBe(true);
    expect(shouldBuild({})).toBe(true);
  });
});

describe('vercel.json', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  it('runs the ignore step and never deploys Dependabot branches', () => {
    expect(config.ignoreCommand).toBe('node scripts/vercel-ignore-build.mjs');
    expect(config.git.deploymentEnabled).toEqual({ 'dependabot/**': false });
  });
});
