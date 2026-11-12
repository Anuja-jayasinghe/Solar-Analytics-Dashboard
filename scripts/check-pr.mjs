#!/usr/bin/env node
// scripts/check-pr.mjs — run by .github/workflows/pr-check.yml on every PR. Says which release merging the PR will make
// (scripts/auto-release.mjs releases every merge), and keeps the inputs of that automation honest:
//   - fails when the title is not a Conventional Commits title (feat: … / fix(api): …) and no release:* label decides,
//     because the title is what picks the version;
//   - warns when a PR that will be released has no docs/CHANGELOG.md entry: the release then uses a line made from
//     the title, which is rarely as clear as one written by hand. Dependabot is exempt.
//
// Env: PR_TITLE, PR_LABELS (JSON array of names), PR_AUTHOR, BASE_SHA, HEAD_SHA, GITHUB_STEP_SUMMARY (optional).

import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { bumpFor, isConventionalTitle, nextVersion } from './release-lib.mjs';

const title = process.env.PR_TITLE ?? '';
const labels = JSON.parse(process.env.PR_LABELS || '[]');
const author = process.env.PR_AUTHOR ?? '';
const labelled = labels.some((l) => /^release:(major|minor|patch|none)$/.test(l));
const bump = bumpFor({ title, labels });
const current = JSON.parse(readFileSync('package.json', 'utf8')).version;
const changed = execFileSync('git', ['diff', '--name-only', `${process.env.BASE_SHA}...${process.env.HEAD_SHA}`], { encoding: 'utf8' }).split('\n');
const wroteChangelog = changed.includes('docs/CHANGELOG.md');

const lines = [];
const out = (s) => { console.log(s); lines.push(s); };
out(bump ? `When merged, this PR releases a **${bump}** version: ${current} → ${nextVersion(current, bump)}.` : 'When merged, this PR makes **no release**: its changelog entries go out with the next one.');

let failed = false;
if (!isConventionalTitle(title) && !labelled) {
  failed = true;
  out(`::error title=PR title::"${title}" does not say what kind of change this is. Start it with feat:, fix:, perf:, refactor:, docs:, test:, ci: or chore: (a scope is optional, e.g. "fix(api): …"), or add a release:major|minor|patch|none label.`);
}
if (bump && !wroteChangelog && author !== 'dependabot[bot]') {
  out('::warning title=Changelog::This PR will be released but adds nothing under "## [Unreleased]" in docs/CHANGELOG.md. The release will use a line made from the title; a sentence written for the reader is better.');
}
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.map((l) => l.replace(/^::\w+ title=[^:]+::/, '')).join('\n\n')}\n`);
process.exit(failed ? 1 : 0);
