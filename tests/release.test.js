// tests/release.test.js
// Versioning: `pnpm release` (scripts/release.mjs) turns the changelog's [Unreleased] into a dated version and bumps
// package.json and shared/version.js together; the Release workflow then tags and publishes that version's notes. The
// version shows in the footer and in /healthz.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { bumpPackageJson, compareVersions, cutChangelog, nextVersion, releaseNotes, versionModule } from '../scripts/release-lib.mjs';
import { APP_VERSION } from '../shared/version.js';
import { Footer } from '../src/v3/shell/Footer.jsx';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

describe('version numbers', () => {
  it('bumps major, minor and patch, or takes an exact higher version', () => {
    expect(nextVersion('3.0.0', 'minor')).toBe('3.1.0');
    expect(nextVersion('3.1.4', 'patch')).toBe('3.1.5');
    expect(nextVersion('3.1.4', 'major')).toBe('4.0.0');
    expect(nextVersion('3.0.0', '3.2.0')).toBe('3.2.0');
    expect(() => nextVersion('3.1.0', '3.0.9')).toThrow(/not higher/);
    expect(() => nextVersion('3.1.0', '3.1')).toThrow(/Not a version/);
    expect(compareVersions('3.10.0', '3.9.9')).toBe(1); // numeric, not text
  });
});

describe('changelog', () => {
  const log = '# Changelog\n\n## [Unreleased]\n\n### Added\n- **A thing.** It works.\n\n### Fixed\n- **A fix.**\n\n## [3.0.0] - 2026-10-04\n- old\n';
  it('turns [Unreleased] into a dated version and leaves a fresh, empty [Unreleased] above it', () => {
    const cut = cutChangelog(log, '3.1.0', '2026-11-04');
    expect(cut).toContain('## [Unreleased]\n\n## [3.1.0] - 2026-11-04\n\n### Added\n- **A thing.** It works.');
    expect(cut).toContain('## [3.0.0] - 2026-10-04\n- old');
    expect(releaseNotes(cut, '3.1.0')).toBe('### Added\n- **A thing.** It works.\n\n### Fixed\n- **A fix.**');
    expect(releaseNotes(cut, '3.0.0')).toBe('- old');
  });
  it('refuses a release with no entries, or a version that is already there', () => {
    expect(() => cutChangelog('## [Unreleased]\n\n## [3.0.0] - x\n- old\n', '3.1.0', 'd')).toThrow(/nothing to release/);
    expect(() => cutChangelog(log.replace('[3.0.0]', '[3.1.0]'), '3.1.0', 'd')).toThrow(/already has/);
    expect(() => releaseNotes(log, '9.9.9')).toThrow(/no \[9\.9\.9\]/);
  });
  it('the real changelog has an [Unreleased] section to cut', () => {
    expect(read('docs/CHANGELOG.md')).toContain('## [Unreleased]\n');
  });
});

describe('the version is in one place, shown everywhere', () => {
  it('package.json and shared/version.js agree (the release script writes both)', () => {
    expect(JSON.parse(read('package.json')).version).toBe(APP_VERSION);
    expect(read('shared/version.js')).toBe(versionModule(APP_VERSION));
  });
  it('bumps package.json without touching anything else', () => {
    const text = '{\n  "name": "x",\n  "version": "3.0.0",\n  "type": "module"\n}\n';
    expect(bumpPackageJson(text, '3.1.0')).toBe(text.replace('3.0.0', '3.1.0'));
    expect(() => bumpPackageJson('{"name":"x"}', '3.1.0')).toThrow(/no "version"/);
  });
  it('the footer shows the version and build, linked to its release notes', () => {
    const html = renderToString(h(Footer));
    expect(html).toContain(`v${APP_VERSION}`);
    expect(html).toContain(`releases/tag/v${APP_VERSION}`);
  });
  it('/healthz reports the version next to the commit, in both probes', () => {
    const src = read('api/health.js');
    expect(src).toContain("import { APP_VERSION } from '../shared/version.js';");
    expect(src.match(/version: APP_VERSION,\n\s+revision: REVISION,/g)).toHaveLength(2);
  });
  it('the Release workflow runs only when the version changes on main, and never re-tags', () => {
    const wf = read('.github/workflows/release.yml');
    expect(wf).toMatch(/branches: \[main\]\n\s+paths: \[shared\/version\.js\]/);
    expect(wf).toContain('is already tagged: nothing to do');
    expect(wf).toContain('gh release create "v$VERSION" --target "$GITHUB_SHA"');
  });
});
