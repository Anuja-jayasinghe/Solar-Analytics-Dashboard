#!/usr/bin/env node
// scripts/release.mjs — prepare a release in one command.
//
//   pnpm release minor            3.0.0 -> 3.1.0 (features)      also: patch (fixes), major, or an exact 3.1.0
//   pnpm release minor --dry-run  show the version and the release notes, change nothing
//
// It checks you are on an up-to-date, clean `main`, then on a new branch release/vX.Y.Z: turns the changelog's
// [Unreleased] section into "## [X.Y.Z] - today", sets the version in package.json and shared/version.js, commits,
// pushes and opens a PR. `main` is protected, so the release goes through review and CI like any change. When that PR
// is merged, the Release workflow (.github/workflows/release.yml) tags vX.Y.Z and publishes the GitHub Release with
// the same notes. Nothing here tags or publishes by itself.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { bumpPackageJson, cutChangelog, nextVersion, releaseNotes, versionModule } from './release-lib.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const which = args.find((a) => !a.startsWith('--'));
const sh = (cmd, ...a) => execFileSync(cmd, a, { encoding: 'utf8' }).trim();
const fail = (msg) => { console.error(`release: ${msg}`); process.exit(1); };

if (!which) fail('say which release: patch | minor | major | x.y.z   (add --dry-run to preview)');

// 1. Start from an up-to-date, clean main.
if (sh('git', 'branch', '--show-current') !== 'main') fail('switch to main first');
if (sh('git', 'status', '--porcelain', '--untracked-files=no')) fail('commit or stash your changes first');
sh('git', 'fetch', '--quiet', '--tags', 'origin', 'main');
if (sh('git', 'rev-parse', 'HEAD') !== sh('git', 'rev-parse', 'origin/main')) fail('main is not the same as origin/main: pull (or push) first');

// 2. Work out the version and the notes.
const pkgText = readFileSync('package.json', 'utf8');
const current = JSON.parse(pkgText).version;
let version;
try { version = nextVersion(current, which); } catch (e) { fail(e.message); }
const tag = `v${version}`;
if (sh('git', 'tag', '--list', tag)) fail(`${tag} already exists`);
const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' }); // YYYY-MM-DD, in the plant's timezone
const changelog = readFileSync('docs/CHANGELOG.md', 'utf8');
let cut;
try { cut = cutChangelog(changelog, version, date); } catch (e) { fail(e.message); }
const notes = releaseNotes(cut, version);

console.log(`Release ${current} -> ${version} (${date})\n\n${notes}\n`);
if (dryRun) { console.log('Dry run: nothing changed.'); process.exit(0); }

// 3. A release branch, the version bumped, a PR.
const branch = `release/${tag}`;
sh('git', 'switch', '--quiet', '-c', branch);
writeFileSync('docs/CHANGELOG.md', cut);
writeFileSync('package.json', bumpPackageJson(pkgText, version));
writeFileSync('shared/version.js', versionModule(version));
sh('git', 'add', 'docs/CHANGELOG.md', 'package.json', 'shared/version.js');
sh('git', 'commit', '--quiet', '-m', `Release ${tag}`);
sh('git', 'push', '--quiet', '-u', 'origin', branch);
const body = `Releases **${tag}**. When this is merged, the Release workflow tags \`${tag}\` on \`main\` and publishes the GitHub Release with the notes below.\n\n---\n\n${notes}`;
const url = sh('gh', 'pr', 'create', '--base', 'main', '--head', branch, '--title', `Release ${tag}`, '--body', body);
console.log(`Opened ${url}\nMerge it once CI passes; the Release workflow does the rest.`);
