// scripts/release-lib.mjs
//
// The pure parts of a release (no git, no files), so they are unit-tested: the next version number, cutting the
// changelog's [Unreleased] section into a dated version, the release notes for a version, and the two files that carry
// the version (package.json and shared/version.js). Used by scripts/release.mjs and the Release workflow.

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

export function parseVersion(v) {
  const m = SEMVER.exec(String(v).trim());
  if (!m) throw new Error(`Not a version (x.y.z): ${v}`);
  return m.slice(1).map(Number);
}

/** -1, 0 or 1. */
export function compareVersions(a, b) {
  const [x, y] = [parseVersion(a), parseVersion(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}

/** The version after `current` for 'major' | 'minor' | 'patch' or an explicit 'x.y.z' (which must be higher). */
export function nextVersion(current, arg) {
  const [ma, mi, pa] = parseVersion(current);
  let next;
  if (arg === 'major') next = `${ma + 1}.0.0`;
  else if (arg === 'minor') next = `${ma}.${mi + 1}.0`;
  else if (arg === 'patch') next = `${ma}.${mi}.${pa + 1}`;
  else next = parseVersion(arg).join('.');
  if (compareVersions(next, current) <= 0) throw new Error(`${next} is not higher than the current ${current}`);
  return next;
}

const UNRELEASED = '## [Unreleased]\n';

/**
 * The changelog with its [Unreleased] section turned into `## [version] - date`, and a fresh, empty [Unreleased]
 * above it. Throws when there is nothing unreleased (a release with no notes is a mistake).
 */
export function cutChangelog(text, version, date) {
  const start = text.indexOf(UNRELEASED);
  if (start < 0) throw new Error('CHANGELOG.md has no "## [Unreleased]" section');
  const bodyStart = start + UNRELEASED.length;
  const next = text.indexOf('\n## [', bodyStart);
  const body = text.slice(bodyStart, next < 0 ? text.length : next + 1);
  if (!/^- /m.test(body)) throw new Error('The [Unreleased] section has no entries: nothing to release');
  if (text.includes(`## [${version}]`)) throw new Error(`CHANGELOG.md already has a [${version}] section`);
  return `${text.slice(0, start)}${UNRELEASED}\n## [${version}] - ${date}\n${body}${next < 0 ? '' : text.slice(next + 1)}`;
}

/** The body of a version's section (the GitHub Release notes), trimmed. Throws when the section is missing. */
export function releaseNotes(text, version) {
  const head = `## [${version}]`;
  const start = text.indexOf(head);
  if (start < 0) throw new Error(`CHANGELOG.md has no [${version}] section`);
  const bodyStart = text.indexOf('\n', start) + 1;
  const next = text.indexOf('\n## [', bodyStart);
  return text.slice(bodyStart, next < 0 ? text.length : next).trim();
}

/** package.json text with its version replaced, everything else (order, spacing) untouched. */
export function bumpPackageJson(text, version) {
  const out = text.replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`);
  if (out === text && !text.includes(`"version": "${version}"`)) throw new Error('package.json has no "version" field');
  return out;
}

/** shared/version.js for a version. */
export function versionModule(version) {
  return `// shared/version.js\n//\n// The app's release version, shown in the footer and reported by /healthz. Written by \`pnpm release\`\n// (scripts/release.mjs) together with package.json; tests/release.test.js checks the two agree.\n\nexport const APP_VERSION = '${version}';\n`;
}

// ---------------------------------------------------------------------------------------------------------------
// Automatic releases (scripts/auto-release.mjs, .github/workflows/auto-release.yml).
// Every merge to main is released by the kind of change its PR title names (Conventional Commits):
//   feat            -> minor
//   fix, perf, refactor, revert, build, chore(deps), chore(deps-dev) -> patch
//   docs, test, ci, style, chore -> no release (their changelog entries go out with the next release)
//   a "!" after the type (feat!: …) -> major
//   a title that names no known type -> patch, so nothing is ever left unreleased by a badly named PR
// A label overrides the title: release:major | release:minor | release:patch | release:none.
// ---------------------------------------------------------------------------------------------------------------

const TITLE = /^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?(?<bang>!)?: \S/;
const MINOR_TYPES = new Set(['feat']);
const PATCH_TYPES = new Set(['fix', 'perf', 'refactor', 'revert', 'build']);
const QUIET_TYPES = new Set(['docs', 'test', 'ci', 'style', 'chore']);
const RANK = { patch: 1, minor: 2, major: 3 };

/** The parts of a Conventional Commits title, or null when it does not follow the convention. */
export function parseTitle(title) {
  const m = TITLE.exec(String(title ?? '').trim());
  return m ? { type: m.groups.type, scope: m.groups.scope ?? null, breaking: !!m.groups.bang } : null;
}

/** Is this a title the automation understands: a known type, a colon, a description. */
export function isConventionalTitle(title) {
  const t = parseTitle(title);
  return !!t && (MINOR_TYPES.has(t.type) || PATCH_TYPES.has(t.type) || QUIET_TYPES.has(t.type));
}

/** 'major' | 'minor' | 'patch' | null (no release) for one merged PR. */
export function bumpFor({ title, labels = [] }) {
  for (const level of ['major', 'minor', 'patch', 'none']) {
    if (labels.includes(`release:${level}`)) return level === 'none' ? null : level;
  }
  if (/^Release v\d+\.\d+\.\d+/.test(String(title ?? ''))) return null; // a release PR made by `pnpm release`
  const t = parseTitle(title);
  if (!t) return 'patch';
  if (t.breaking) return 'major';
  if (MINOR_TYPES.has(t.type)) return 'minor';
  if (PATCH_TYPES.has(t.type)) return 'patch';
  if (t.type === 'chore' && /^deps(-dev)?$/.test(t.scope ?? '')) return 'patch';
  if (QUIET_TYPES.has(t.type)) return null;
  return 'patch';
}

/** The largest of several bumps (null when all are null). */
export function highestBump(bumps) {
  return bumps.reduce((best, b) => (b && (!best || RANK[b] > RANK[best]) ? b : best), null);
}

/** A changelog line for a PR that did not write its own: the title without its prefix, and the PR number. */
export function entryFor({ number, title }) {
  const t = parseTitle(title);
  const text = String(title).replace(/^[a-z]+(?:\([^)]+\))?!?: /, '').trim();
  const section = !t ? 'Changed' : t.type === 'feat' ? 'Added' : t.type === 'fix' ? 'Fixed' : 'Changed';
  return { section, line: `- ${text.charAt(0).toUpperCase()}${text.slice(1)} (#${number}).` };
}

/** The changelog with these entries added to [Unreleased], each under its "### Section" (made when missing). */
export function addChangelogEntries(text, entries) {
  const start = text.indexOf(UNRELEASED);
  if (start < 0) throw new Error('CHANGELOG.md has no "## [Unreleased]" section');
  const bodyStart = start + UNRELEASED.length;
  const nextIdx = text.indexOf('\n## [', bodyStart);
  const end = nextIdx < 0 ? text.length : nextIdx + 1;
  let body = text.slice(bodyStart, end);
  for (const { section, line } of entries) {
    const head = `### ${section}\n`;
    const at = body.indexOf(head);
    if (at < 0) {
      body = body.trim() ? `${body.replace(/\n*$/, '\n')}\n${head}${line}\n` : `\n${head}${line}\n`;
    } else {
      const after = at + head.length;
      const nextHead = body.indexOf('\n### ', after);
      const insertAt = nextHead < 0 ? body.replace(/\n*$/, '').length : nextHead;
      body = `${body.slice(0, insertAt).replace(/\n*$/, '')}\n${line}\n${body.slice(insertAt).replace(/^\n*/, '\n')}`;
    }
  }
  if (!body.endsWith('\n\n') && nextIdx >= 0) body = `${body.replace(/\n*$/, '')}\n\n`;
  return `${text.slice(0, bodyStart)}${body}${text.slice(end)}`;
}
