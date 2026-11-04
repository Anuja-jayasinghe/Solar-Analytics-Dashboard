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
