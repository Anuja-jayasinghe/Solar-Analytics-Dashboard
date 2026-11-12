// tests/release.test.js
// Versioning: `pnpm release` (scripts/release.mjs) turns the changelog's [Unreleased] into a dated version and bumps
// package.json and shared/version.js together; the Release workflow then tags and publishes that version's notes. The
// version shows in the footer and in /healthz.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { bumpPackageJson, compareVersions, cutChangelog, nextVersion, releaseNotes, versionModule, bumpFor, highestBump, entryFor, addChangelogEntries, isConventionalTitle, parseTitle } from '../scripts/release-lib.mjs';
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

describe('automatic releases: what each merged PR releases', () => {
  it('reads the kind of change from the PR title', () => {
    expect(bumpFor({ title: 'feat(ceb): monthly money gap' })).toBe('minor');
    expect(bumpFor({ title: 'fix(api): 404 for an unknown action' })).toBe('patch');
    for (const t of ['perf: cache', 'refactor(api): one function', 'revert: x', 'build: vite config']) expect(bumpFor({ title: t })).toBe('patch');
    expect(bumpFor({ title: 'feat!: drop the old API' })).toBe('major');
  });

  it('releases dependency updates as patches, and leaves docs, tests and CI for the next release', () => {
    expect(bumpFor({ title: 'chore(deps): Bump vite from 7.1.10 to 8.3.6' })).toBe('patch');
    expect(bumpFor({ title: 'chore(deps-dev): Bump eslint-plugin-react-hooks from 5.2.0 to 7.1.1' })).toBe('patch');
    for (const t of ['docs: roadmap link', 'test: more cases', 'ci: cache pnpm', 'style: format', 'chore: tidy']) expect(bumpFor({ title: t })).toBeNull();
  });

  it('never leaves a badly named PR unreleased: an unknown title is a patch', () => {
    expect(bumpFor({ title: 'Update the dashboard' })).toBe('patch');
    expect(bumpFor({ title: 'feature: x' })).toBe('patch');
    expect(isConventionalTitle('Update the dashboard')).toBe(false);
    expect(isConventionalTitle('feat(ceb): x')).toBe(true);
    expect(parseTitle('fix(api)!: y')).toEqual({ type: 'fix', scope: 'api', breaking: true });
  });

  it('lets a label override the title, and never re-releases a release PR', () => {
    expect(bumpFor({ title: 'docs: x', labels: ['release:patch'] })).toBe('patch');
    expect(bumpFor({ title: 'feat: x', labels: ['release:none'] })).toBeNull();
    expect(bumpFor({ title: 'fix: x', labels: ['release:major'] })).toBe('major');
    expect(bumpFor({ title: 'Release v3.2.0' })).toBeNull();
  });

  it('takes the largest bump of everything merged since the last release', () => {
    expect(highestBump([null, 'patch', 'minor', null])).toBe('minor');
    expect(highestBump(['patch', 'major'])).toBe('major');
    expect(highestBump([null, null])).toBeNull();
  });
});

describe('automatic releases: changelog lines for PRs that did not write one', () => {
  it('turns the title into a line under the matching section', () => {
    expect(entryFor({ number: 9, title: 'fix(api): handle a missing bill' })).toEqual({ section: 'Fixed', line: '- Handle a missing bill (#9).' });
    expect(entryFor({ number: 10, title: 'feat: dark board' })).toEqual({ section: 'Added', line: '- Dark board (#10).' });
    expect(entryFor({ number: 11, title: 'chore(deps): Bump vite from 7 to 8' })).toEqual({ section: 'Changed', line: '- Bump vite from 7 to 8 (#11).' });
  });

  it('adds lines to existing sections and makes missing ones, keeping older versions untouched', () => {
    const text = '# C\n\n## [Unreleased]\n\n### Changed\n- a\n\n## [3.1.1] - x\n- old\n';
    const out = addChangelogEntries(text, [entryFor({ number: 9, title: 'fix: b' }), entryFor({ number: 10, title: 'refactor: c' })]);
    expect(out).toBe('# C\n\n## [Unreleased]\n\n### Changed\n- a\n- C (#10).\n\n### Fixed\n- B (#9).\n\n## [3.1.1] - x\n- old\n');
    expect(cutChangelog(out, '3.1.2', '2026-11-12')).toContain('## [3.1.2] - 2026-11-12\n\n### Changed\n- a\n- C (#10).');
  });

  it('fills an empty [Unreleased] section so the release has notes', () => {
    expect(addChangelogEntries('# C\n\n## [Unreleased]\n\n## [3.1.1] - x\n- old\n', [entryFor({ number: 9, title: 'fix: a thing' })]))
      .toBe('# C\n\n## [Unreleased]\n\n### Fixed\n- A thing (#9).\n\n## [3.1.1] - x\n- old\n');
  });
});
