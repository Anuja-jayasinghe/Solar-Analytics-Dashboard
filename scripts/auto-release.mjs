#!/usr/bin/env node
// scripts/auto-release.mjs — release whatever has been merged to main since the last release. Run by
// .github/workflows/auto-release.yml after every push to main; it can also be run by hand with --dry-run.
//
//   node scripts/auto-release.mjs            release (commit + push the version to main)
//   node scripts/auto-release.mjs --dry-run  show what it would release, change nothing
//   node scripts/auto-release.mjs --dry-run --since <sha>  the same, counting from another release commit (for checking)
//
// 1. The last release is the last commit that changed shared/version.js. Everything merged on main after it (first
//    parent only) is unreleased, so a run that was skipped or lost is caught up by the next one.
// 2. Each commit's merged PR decides the bump from its title or a release:* label (release-lib.mjs#bumpFor). The
//    largest wins. Nothing releasable (docs, tests, CI) means no release: those changelog entries wait for the next.
// 3. A releasable PR that did not touch docs/CHANGELOG.md gets a line made from its title, so no change ships unrecorded.
// 4. The changelog's [Unreleased] becomes the new version, package.json and shared/version.js are bumped, and the
//    commit "Release vX.Y.Z" is pushed to main. The Release workflow (release.yml) then tags and publishes it, exactly
//    as for a release made with `pnpm release`.
//
// Needs: git with push access to main (the workflow checks out with a token that may bypass the ruleset) and `gh`
// authenticated for reading PRs (GH_TOKEN). GITHUB_REPOSITORY names the repository.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  addChangelogEntries, bumpFor, bumpPackageJson, cutChangelog, entryFor, highestBump, nextVersion, releaseNotes, versionModule
} from './release-lib.mjs';

const dryRun = process.argv.includes('--dry-run');
const sh = (cmd, ...a) => execFileSync(cmd, a, { encoding: 'utf8' }).trim();
const gh = (...a) => JSON.parse(sh('gh', 'api', ...a) || 'null');
const repo = process.env.GITHUB_REPOSITORY || sh('gh', 'repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner');
const stop = (msg) => { console.log(msg); process.exit(0); };

// 1. What is unreleased.
const sinceArg = process.argv.indexOf('--since');
if (sinceArg > 0 && !dryRun) { console.error('--since is only for --dry-run'); process.exit(1); }
const since = sinceArg > 0 ? process.argv[sinceArg + 1] : sh('git', 'log', '-1', '--format=%H', '--', 'shared/version.js');
const commits = sh('git', 'rev-list', '--first-parent', `${since}..HEAD`).split('\n').filter(Boolean);
if (commits.length === 0) stop(`Nothing merged since the last release (${since.slice(0, 7)}).`);

// 2. Their PRs, once each.
const prs = new Map();
for (const sha of commits) {
  for (const pr of gh(`repos/${repo}/commits/${sha}/pulls`) ?? []) {
    if (!pr.merged_at || prs.has(pr.number)) continue;
    prs.set(pr.number, { number: pr.number, title: pr.title, labels: (pr.labels ?? []).map((l) => l.name) });
  }
}
const decided = [...prs.values()].map((pr) => ({ ...pr, bump: bumpFor(pr) }));
for (const pr of decided) console.log(`#${pr.number} ${pr.bump ?? 'no release'}  ${pr.title}`);
const bump = highestBump(decided.map((pr) => pr.bump));
if (!bump) stop('Nothing releasable since the last release (docs, tests or CI only): no release.');

// 3. Changelog lines for releasable PRs that did not write one.
let changelog = readFileSync('docs/CHANGELOG.md', 'utf8');
const missing = [];
for (const pr of decided.filter((p) => p.bump)) {
  const files = sh('gh', 'api', '--paginate', `repos/${repo}/pulls/${pr.number}/files`, '--jq', '.[].filename').split('\n');
  if (!files.includes('docs/CHANGELOG.md')) missing.push(entryFor(pr));
}
if (missing.length) changelog = addChangelogEntries(changelog, missing);

// 4. The release.
const pkgText = readFileSync('package.json', 'utf8');
const current = JSON.parse(pkgText).version;
const version = nextVersion(current, bump);
const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });
const cut = cutChangelog(changelog, version, date);
console.log(`\nRelease ${current} -> ${version} (${bump}, ${date})\n\n${releaseNotes(cut, version)}\n`);
if (dryRun) stop('Dry run: nothing changed.');

writeFileSync('docs/CHANGELOG.md', cut);
writeFileSync('package.json', bumpPackageJson(pkgText, version));
writeFileSync('shared/version.js', versionModule(version));
sh('git', 'add', 'docs/CHANGELOG.md', 'package.json', 'shared/version.js');
const list = decided.filter((p) => p.bump).map((p) => `- #${p.number} ${p.title}`).join('\n');
sh('git', 'commit', '--quiet', '-m', `Release v${version}`, '-m', `Released automatically (${bump}):\n${list}`);
try {
  sh('git', 'push', '--quiet', 'origin', 'HEAD:main');
} catch {
  // main moved while this ran. Nothing is lost: the newer push starts another run, which includes these PRs.
  stop(`main moved on before v${version} could be pushed; the next run will release it.`);
}
console.log(`Pushed Release v${version}; the Release workflow tags and publishes it.`);
