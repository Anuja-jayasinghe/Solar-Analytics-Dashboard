# Releasing

Versions follow [SemVer](https://semver.org): **minor** for new features (3.0.0 → 3.1.0), **patch** for fixes only
(3.1.0 → 3.1.1), **major** for a change that breaks how the dashboard is used or deployed. The version lives in
`package.json` and `shared/version.js` (a test keeps them in step). It shows in the footer, linked to its release notes,
as `v3.1.0 · 7371efb` (version · commit), and `/healthz` reports it as `version` next to `revision`.

## How to release

Everything you want in the release is merged to `main`, and `docs/CHANGELOG.md` has its entries under `## [Unreleased]`.

```bash
git switch main && git pull
pnpm release minor --dry-run   # shows the next version and the release notes; changes nothing
pnpm release minor             # or: patch | major | an exact 3.1.0
```

`pnpm release` (`scripts/release.mjs`):

1. checks you are on `main`, with no uncommitted changes, and level with `origin/main`;
2. on a new branch `release/vX.Y.Z`, turns `## [Unreleased]` into `## [X.Y.Z] - today` (Colombo date) under a fresh,
   empty `## [Unreleased]`, and sets the version in `package.json` and `shared/version.js`;
3. commits, pushes and opens a PR "Release vX.Y.Z".

`main` is protected, so the release goes through CI and review like any change. **Merge that PR**, and the Release
workflow (`.github/workflows/release.yml`) tags `vX.Y.Z` on `main` and publishes the GitHub Release, with that version's
changelog section as its notes. It runs only when `shared/version.js` changes on `main`, and never re-tags an existing
version.

## If something goes wrong

- **The workflow failed** (for example a GitHub outage): fix the cause, then run it again from the Actions tab
  (*release → Run workflow*). It picks up the version on `main` and skips it if it is already tagged.
- **A wrong version was released:** releases are not rewritten. Fix forward with the next patch version.
- **Writing the release by hand:** tag `vX.Y.Z` on the release commit on `main` and create the GitHub Release with the
  version's changelog section. This is the same thing the workflow does.
