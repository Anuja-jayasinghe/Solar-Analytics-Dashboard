# Releasing

Versions follow [SemVer](https://semver.org): **minor** for new features (3.0.0 → 3.1.0), **patch** for fixes only
(3.1.0 → 3.1.1), **major** for a change that breaks how the dashboard is used or deployed. The version lives in
`package.json` and `shared/version.js` (a test keeps them in step). It shows in the footer, linked to its release notes,
as `v3.1.0`, and `/healthz` reports it as `version` next to `revision` (the commit).

## Every merge is released automatically

`main` deploys to production on every merge (Vercel), so every merge is also released, and the version on screen always
matches what is running. After each push to `main`, the **auto-release** workflow (`.github/workflows/auto-release.yml`,
`scripts/auto-release.mjs`):

1. collects every PR merged since the last release (the last commit that changed `shared/version.js`), so a run that
   was skipped is caught up by the next one;
2. picks the version from their **titles** (Conventional Commits), the largest one winning:

   | PR title starts with | Release |
   |---|---|
   | `feat:` | minor (3.2.0 → 3.3.0) |
   | `fix:` `perf:` `refactor:` `revert:` `build:` `chore(deps):` `chore(deps-dev):` | patch (3.2.0 → 3.2.1) |
   | `docs:` `test:` `ci:` `style:` `chore:` | none: their changelog entries go out with the next release |
   | a `!` after the type (`feat!:`) | major |
   | anything else | patch, so nothing is ever left unreleased |

   A label overrides the title: `release:major`, `release:minor`, `release:patch` or `release:none`;
3. writes a changelog line from the title for a released PR that added none (Dependabot's, for example);
4. turns `## [Unreleased]` into the new version, bumps `package.json` and `shared/version.js`, and pushes
   **Release vX.Y.Z** to `main`. The **release** workflow then tags it and publishes the GitHub Release, as below.

The push to the protected `main` uses the owner's fine-grained PAT (Contents: read and write, this repository only):
the secret `RELEASE_PAT`, or `KEEPALIVE_PAT` when that is not set. If the token expires, the workflow fails visibly and
nothing is lost: renew the token and run *auto-release → Run workflow*.

On every PR, the **pr-check** workflow says which release merging it will make, fails on a title it cannot read, and
warns when a released change has no changelog entry. Write the entry under `## [Unreleased]` in the PR itself.

Preview what would be released now: `node scripts/auto-release.mjs --dry-run`.

## Releasing by hand

Still available, for an exact version or a release outside the automation:


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

- **auto-release failed:** usually an expired token (see above). Run it again from the Actions tab once fixed; it
  releases everything merged since the last release. If `main` moved while it ran, the next run releases it.

- **The workflow failed** (for example a GitHub outage): fix the cause, then run it again from the Actions tab
  (*release → Run workflow*). It picks up the version on `main` and skips it if it is already tagged.
- **A wrong version was released:** releases are not rewritten. Fix forward with the next patch version.
- **Writing the release by hand:** tag `vX.Y.Z` on the release commit on `main` and create the GitHub Release with the
  version's changelog section. This is the same thing the workflow does.
