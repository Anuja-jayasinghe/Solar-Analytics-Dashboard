# Working Rules

The rules this project follows, each with the incident or reason behind it. They apply to every
change, human or AI. `CLAUDE.md` links here; where the two disagree, fix both.

---

## 1. Data honesty

1. **`null` means unavailable; `0` means a measured zero.** Never conflate them — in the database,
   in functions, or in what the screen renders. Fabricated zeros have corrupted data twice.
   - A failed or pending fetch renders "No data" / "Awaiting …", never `0`.
   - A comparison against an unknown side is *undefined*; do not render a number for it.
2. **A bill received in month N reports month N−1.** Period windows come from bill dates (LR-001).
   Never label a bill period with a calendar month name as if they were the same thing.
3. **Night is not downtime.** Uptime is measured inside a daylight window only (LR-002).
4. **Estimates are labelled.** Anything derived from a model rather than a measurement (weather,
   projections, pro-rating) must say so and must never sit inside a comparison figure.
5. **A batch job that processed nothing has not succeeded.** Fail loudly; never exit 0 over an
   empty result.

## 2. Dates and time

- Site timezone is **Asia/Colombo (UTC+5:30)**. Solis `timeZone` parameter is `5.5`, not `8`.
- Serialise dates with **local components**; never `.toISOString()` on a local-midnight `Date`
  (it shifts the date back a day). Use `toLocalIsoDate`.
- Store instants as `timestamptz`; store calendar days as `date`. Never `timestamp without time zone`.

## 3. Security

- The browser client **never writes**. Every write goes through an admin-authenticated API
  endpoint using the service-role key.
- Real data is **private**: reads go through the authenticated API (target state, tracked in
  `docs/V3_REFACTOR_PLAN.md`). `VITE_SUPABASE_ANON_KEY` is public and ships in the bundle.
- **Never prefix a secret with `VITE_`.** Server-only helpers live outside `src/`.
- Roles live in Clerk `publicMetadata.role` (`admin` | `viewer`); absent role = demo. Verified
  **server-side** only. A client-side check is a convenience, never a control.
- `SUPABASE_SERVICE_KEY` must be the `service_role` key. Vercel and GitHub Actions hold
  **separate** copies of every secret.
- No secrets, tokens or user metadata in logs. No sample API responses committed with secrets.

## 4. Database changes

1. **Take a DB Snapshot workflow run before anything that writes.**
2. Migrations live in `scripts/sql/YYYY-MM-DD_description.sql`, are idempotent, and are applied
   to a Supabase **branch** first; run the security/performance advisors before and after.
3. New tables are created **private** (RLS on, no `anon` policy) from day one.
4. Destructive changes (drop table/column, revoke) are called out in the PR and need explicit
   owner confirmation.

## 5. Code

- Plain JavaScript, ESM. No TypeScript unless it is introduced deliberately and completely.
- Vercel Hobby caps serverless functions at **12**; anything under `api/_lib/` or `api/_config/`
  does not count. Check the count before adding a handler. Currently 10/12.
- **Spec → tests → code** for domain logic: write/update the `docs/logic-registry/LR-*` spec,
  write failing tests, then implement. Domain logic lives in pure functions that can be tested
  without a browser or a database.
- Native modules fail at *module* level, outside any `try/catch`; prefer pure-JS dependencies in `api/`.
- A dependency only used at runtime must be in `dependencies`, not `devDependencies`
  (`tests/runtimeDependencies.test.js` enforces this).

## 6. Quality gates

CI runs all four and none may be skipped or `--if-present`:

```
pnpm lint    # 0 errors
pnpm test
pnpm build
pnpm audit --prod --audit-level high
```

UI work additionally holds: Lighthouse accessibility 100, every chart has a table equivalent,
body text ≥ 14px / labels ≥ 12px, contrast checked against the surface the text is on.

## 7. Tracking work

- **Before starting a long-running branch, `git fetch` and compare with `origin/main`.** The v3 branch was cut from a stale local
  `main` and duplicated a week of merged work (audit, security hardening, doc reorganisation) before the merge exposed it.

- `docs/V3_REFACTOR_PLAN.md` is the source of truth for the v3 refactor: checklists, a progress
  log, and the **deferred / bypassed register**.
- Anything skipped, bypassed, partially done or knowingly worked around gets (a) a row in the
  register and (b) a GitHub issue labelled `v3-deferred`, **at the moment it happens**.
- Commits reference the phase (`chore(v3/P0): …`). Superseded docs move to `docs/archive/`.

## 7a. Branching and merging

`main` is always deployable and only changes through a pull request with green CI (`build` and `secrets`).

- **Small changes**: `type/short-slug` branched from a fresh `origin/main`, one PR, merged with a merge commit.
- **Long efforts** (the v3 frontend, #160) use an **integration branch**: `integration/<name>`, cut from `origin/main`.
  Each feature is its own sub-branch `feat/<name>-<slice>` cut from the integration branch, merged back into it by PR
  (CI runs on every PR, whatever its base). Keep slices small enough to review in one sitting.
- The integration branch is merged into `main` by PR when a coherent, working set is ready (never half a feature), after
  merging `origin/main` into it first so the PR is conflict-free. Merge commits, so the history of each slice stays visible.
- Delete a sub-branch when its PR merges. Never push straight to `main` or an integration branch.
- Exception: the keepalive workflow's heartbeat commit pushes to `main` as `github-actions[bot]`; any branch rule must allow it
  or scheduled workflows get disabled again (see `.github/workflows/keepalive.yml`).
- Every PR states what changed, what did not, and the checks run; anything skipped is a `v3-deferred` issue (section 7).

## 8. Operating

- One site, one inverter (SN `1811040244070066`, 40 kW). Do not build multi-plant abstractions.
- Prefer reading the live system (read-only) over assuming; record what was verified and how.
- Outward-facing or irreversible actions (deleting data, rotating secrets, running writing
  workflows, publishing) need explicit confirmation first.
