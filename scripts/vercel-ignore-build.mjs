// scripts/vercel-ignore-build.mjs — Vercel's "Ignored Build Step" (vercel.json `ignoreCommand`).
//
// Vercel Hobby allows 100 deployments a day, and on 2026-11-24 the project ran out. Every merge to main
// deployed TWICE: the merge commit, then a minute later the "Release vX.Y.Z" commit that auto-release pushes
// (docs/RELEASING.md), which is the one whose version the site reports. This skips the first.
//
// Production builds therefore happen only for:
//   - a "Release v…" commit (what the site should run),
//   - any commit whose message contains "[deploy]" (escape hatch, e.g. when auto-release is broken),
//   - a deployment with no commit message (a CLI deploy or a dashboard redeploy).
// Everything else on main (the merge commit, docs/chore merges that make no release, the keepalive heartbeat)
// is skipped; its changes go live with the next release. Previews always build.
//
// Vercel's contract: exit 1 = build, exit 0 = skip. Dependabot branches never reach this: vercel.json
// `git.deploymentEnabled` turns their deployments off entirely (GitHub CI still builds and tests them).

/** @param {{ env?: string, message?: string }} d  VERCEL_ENV and VERCEL_GIT_COMMIT_MESSAGE */
export function shouldBuild({ env, message } = {}) {
  if (env !== 'production') return true;
  const msg = String(message ?? '').trim();
  if (!msg) return true;
  return msg.startsWith('Release v') || msg.includes('[deploy]');
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const build = shouldBuild({ env: process.env.VERCEL_ENV, message: process.env.VERCEL_GIT_COMMIT_MESSAGE });
  const first = String(process.env.VERCEL_GIT_COMMIT_MESSAGE ?? '').split('\n')[0].slice(0, 80);
  console.log(build ? `Building (${process.env.VERCEL_ENV}): ${first || 'no commit message'}` : `Skipping production build of "${first}": only Release commits deploy (scripts/vercel-ignore-build.mjs)`);
  process.exit(build ? 1 : 0);
}
