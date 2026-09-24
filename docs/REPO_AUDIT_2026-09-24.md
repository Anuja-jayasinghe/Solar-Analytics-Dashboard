# Repository Audit — 2026-09-24

**Commit:** `main` at `721ac9d` (after PR #143, which removed the dashboard v2 preview)
**Scope:** dead code, outdated documentation, symptom-level fixes, security, endpoint and
API validation, documentation gaps.
**Method:** static read of every API handler, shared library, SQL migration, workflow, script
and the client's data-access paths; import-graph analysis from the real entry points; a
dependency-usage scan; a markdown link check; `pnpm audit`, `pnpm lint`, `pnpm test`,
`pnpm build`.

> Finding IDs (`S1`…) in **this** document are local to it. The `S1`…`S7` in
> [`PROJECT_AUDIT_2026-09.md`](./PROJECT_AUDIT_2026-09.md) are a different, earlier audit.

## What this audit could not verify

I had no access to the live Supabase project, Vercel or Clerk. Everything below is derived
from the repository. Anything that depends on live state is marked **verify**, and comes with
the query that settles it.

---

## Status tracker

The remediation is a stack of pull requests, each targeting the one before it.

| Step | PR | Findings | Status |
|---|---|---|---|
| 0 — audit log | [#144](https://github.com/Anuja-jayasinghe/Solar-Analytics-Dashboard/pull/144) | — | done |
| 1 — security | [#145](https://github.com/Anuja-jayasinghe/Solar-Analytics-Dashboard/pull/145) | S1, S4, S8, S9, S10, S11, S12 | code done; **S1 migration not applied** |
| 2 — root cause | [#146](https://github.com/Anuja-jayasinghe/Solar-Analytics-Dashboard/pull/146) | S2, S3, S5, S6, S7 | code done; **two migrations not applied** |
| 3 — dead code | [#147](https://github.com/Anuja-jayasinghe/Solar-Analytics-Dashboard/pull/147) | Section 3 | done, except the items listed under *Not remediated* |
| 4 — documentation | see the PR that carries this update | Section 4 | done |

"Code done" means the change is written, tested and built. It does not mean it is deployed or
that the database has been changed. Database migrations are added under `scripts/sql/` and are
**not** applied automatically; the ledger of what has been applied is
[`MIGRATIONS.md`](./MIGRATIONS.md).

## What the remediation changed, finding by finding

| # | What was done |
|---|---|
| S1 | Bill previews and the review queue are served by admin endpoints (`POST /api/ceb-bills/signed-url`, `GET /api/ceb-bills/ingestions?view=queue`). `2026-09-24_revoke_anon_bill_access.sql` drops the anon policies by behaviour rather than by name. [`SECURITY.md`](./SECURITY.md) holds the policy matrix. **Still unverified against the live database** |
| S2 | `approve_ceb_extraction()` does the three approval writes in one transaction and rejects an extraction that does not belong to the ingestion. The handler falls back, with a warning, until it is installed |
| S3 | `api/_lib/serviceKeyGuard.js`, called by both collectors, the backfill scripts and the freshness check. Verified: each exits 1 on an anon-role key |
| S4 | One `/api/ceb-bills/delete` endpoint; database rows first, file last, every result checked. `delete-record` removed. No longer relies on the live-only trigger |
| S5 | `extract.js` validates and parses before changing anything, saves the new extraction before removing the old, keeps the status of a previously extracted ingestion on failure, and has no default tariff |
| S6 | Fixed at the source: the parser returns `null` (not `0`) for what it cannot read; the validator accepts a measured zero and flags a missing value. The review queue also blanked a parsed `0` — fixed |
| S7 | `2026-09-24_ceb_schema_drift.sql` adds the two undeclared columns. The trigger and the missing foreign key are documented in its header, not migrated |
| S8 | Role and access allowlists, no self-demotion, the list pages past 100, no pre-auth logging, no upstream error text |
| S9 | Header corrected, audit line always written, schema tightened (formats, ranges, length, falsy non-strings), own-property lookup |
| S10 | `.npmrc` removed |
| S11 | PDF-only, verified by magic bytes, stored path always `.pdf`, quoted boundaries handled, parser tested. The platform's request-body limit is **still unverified** |
| S12 | CORS scoped to this team's Vercel scope; `/ready` no longer echoes error text; auth PII removed from the console; account number replaced by a placeholder in tracked files (it remains in git history); the `yaml` advisory cleared by removing Chakra/emotion |

Tests went from 91 to 191. Non-PDF JavaScript went from 1,557 KB to 1,194 KB.

## Found while remediating

- **The review queue showed a parsed `0` as blank** (`item.units_exported || ''`), which made a
  measured zero look missing and blocked approving it. Fixed alongside S6.
- **S13 — `ceb_data` is publicly readable and carries `account_number` and `file_path`.** The
  dashboard needs neither. **Not fixed**: the remedy is a view of the display columns and
  pointing the dashboard at it, which is a decision about the public data surface.
- **`updateUserMetadata` in the Clerk adapter writes `unsafeMetadata`**, which the user controls.
  Nothing calls it and nothing authorizes on it, so it is harmless today, but it is a trap. Left
  in place because it belongs to the adapter's interface.
- **`@clerk/clerk-react` is deprecated** by the vendor in favour of `@clerk/react`.
- `failed_api_limit` and the extraction table's `rejected` status are never set by any code.

## Not remediated

Deliberately left, each needing a decision rather than an edit:

- `.agents/skills/` and `skills/`, which hold the same two vendor skill packs (73 files), and
  `skills-lock.json`.
- The finished Clerk-migration scripts, `scripts/migrate-users-to-clerk.js` and
  `scripts/export-users.js`.
- The duplicate `ErrorBoundary` and `SkeletonLoader` components. Each pair is used from
  different places, so merging them is a behaviour change, not a deletion.
- S13 above; the live-only trigger; the `ceb_data.ingestion_id` foreign key; a `ceb_data` unique
  index that treats NULL account numbers as distinct.
- Unused CSS and image assets were never checked.
- Lighthouse has not been re-run since the bundle shrank.
- Seven links inside archived documents still point at files that no longer exist; they are
  historical.

---

## 1. Security and API validation

Severity is the author's judgement of impact × likelihood for a single-site, admin-gated app.

| # | Sev | Finding | Evidence |
|---|---|---|---|
| S1 | **High — verify** | **Bill PDFs and the review queue are probably readable with the public anon key.** The browser signs bill URLs itself and reads `ceb_bill_ingestions` / `ceb_bill_extractions` directly. That only works if `anon` has SELECT on the private `ceb_bills` bucket and on both tables. The April SQL grants exactly that. The 2026-09-12 revoke script drops the ingestion insert/update policies but **not** `ceb_bills_*_anon` on `storage.objects` nor `ceb_bill_ingestions_select_anon`. Bills contain the account holder's name, address, phone and account number. | `src/components/admin/CebDataManagement/index.jsx` (`createSignedUrl`), `VerificationQueue.jsx` (`fetchQueue`), `scripts/sql/2026-04-23_ceb_bill_ingestions_anon_mode_policies.sql`, `scripts/sql/2026-09-12_revoke_anon_writes.sql` |
| S2 | Med | **Bill approval is not atomic.** `records.js` PUT is documented as "one operation" but is three separate writes (`ceb_data` upsert, extraction update, ingestion update). Manual entry never touches the ingestion. A failure part-way leaves `ceb_data` promoted with a stale status label — a plausible root cause of the 20 rows found stuck at `auto_approved`, which were fixed by relabelling the data, not the cause. | `api/ceb-bills/records.js` PUT |
| S3 | Med | **The service-key role assertion exists only in `api/`.** The two Actions functions and ~10 scripts build their own client from the raw key. That is the component that failed in the five-month outage. Detection (freshness check, snapshot) was added; prevention was not shared. | `functions/*/index.js`, `scripts/*.js` |
| S4 | Med | **Delete order is inconsistent and unchecked.** `delete.js` removes the storage file first, ignores its error, and ignores errors from the extraction and `ceb_data` deletes, so a partial failure leaves an ingestion pointing at a missing file or an orphaned `ceb_data` row. `delete-record.js` uses the safe order but depends on a DB trigger (see S7). The two endpoints overlap. | `api/ceb-bills/delete.js`, `delete-record.js` |
| S5 | Med | **`extract.js` performs the destructive step first.** It deletes the previous extraction before downloading or parsing, and only checks "is this a PDF" afterwards. A missing request body yields 500 rather than 400. It falls back to a hardcoded Rs 37.00 tariff when the setting is missing, and `parseFloat` can yield `NaN`. | `api/ceb-bills/extract.js` |
| S6 | Med | **A measured zero is treated as a failed extraction.** `!result.units_exported` and `!result.earnings` flag `0` as invalid, violating the project's null-versus-zero rule. | `api/_lib/cebBillParser.js` `validateExtraction` |
| S7 | Med | **Schema drift.** `extract.js` writes `confidence_score` and `meter_reading_previous` to `ceb_bill_extractions`; neither column is in any migration. The trigger `trg_cascade_delete_ceb_data`, relied on by `delete-record.js`, is in no SQL file either. A database rebuilt from the repo cannot run the pipeline. | `scripts/sql/`, `api/ceb-bills/extract.js` |
| S8 | Med | **`/api/admin/users` PATCH accepts any `role` / `dashboardAccess` value**, has no guard against an admin demoting themselves or the last admin, lists at most 100 users with no paging, logs request details before authentication, and returns `error.message` to the caller. | `api/admin/users/[userId].js` |
| S9 | Low-Med | **`/api/solis/explore` claims things it does not do.** Its header says it audits and rate-limits. In production the audit line prints nothing (gated on non-production, plus a `TODO`). The in-memory limiter is per instance, so it does little on Vercel. Parameters are only checked for "is a string"; the documented page-size maximum of 100 is not enforced; endpoint lookup is by `this[key]`, so prototype keys resolve (rejected only because they lack `.enabled`). | `api/solis/explore.js`, `api/_config/solisEndpointsConfig.js` |
| S10 | Low-Med | **`.npmrc` sets `frozen-lockfile=false`.** Vercel installs can drift from the lockfile CI verifies. | `.npmrc` |
| S11 | Low | **Upload trusts the client-supplied MIME type**, with no `%PDF` magic-byte check. It accepts PNG/JPEG although extraction handles only PDF. The multipart parser is hand-rolled and untested. The advertised 10 MB limit may be moot if the platform caps request bodies lower (**verify** against the Vercel plan). | `api/ceb-bills/upload.js`, `api/_lib/cebBillUploadUtils.js` |
| S12 | Low | **Minor items.** CORS accepts any `solar-analytics-dashboard*.vercel.app` project name, not just this team's. `/ready` is unauthenticated, runs a DB query per hit and echoes Supabase error strings. The client calls `/api/update-user-metadata`, which does not exist. `getDashboardAccess` logs the user's email and metadata to the browser console. The account number appears in tracked comments and docs. One moderate `yaml` advisory (GHSA-48c2-rrv3-qjmp) arrives only through Chakra/emotion. | `api/_lib/httpSecurity.js`, `api/health.js`, `src/lib/auth/ClerkAuthAdapter.js` |

**Verify S1 with:**

```sql
select schemaname, tablename, policyname, cmd, roles
from pg_policies
where 'anon' = any(roles)
  and (schemaname = 'storage' or tablename in
       ('ceb_bill_ingestions', 'ceb_bill_extractions', 'ceb_data', 'system_settings'))
order by 1, 2, 3;
```

Expected after remediation: `ceb_data` and `system_settings` show SELECT only; the two `ceb_bill_*`
tables and `storage.objects` show no `anon` rows.

## 2. Fixes that patched a symptom

- **The deferred bundle-size item has an identifiable cause.** `main.jsx` wraps the app in
  `ChakraProvider`, but only the dead `Reports.jsx` uses Chakra. `vite.config.js` sends any
  module path containing "react" to `react-vendor`, so `@chakra-ui/react` and `@emotion/react`
  land in that 776 KB chunk. Removing them is very likely a large share of the LCP and
  unused-JavaScript problem. *Not measured at the time of the audit; see the dead-code PR.*
- `vite.config.js` also names `chart.js`, `react-liquid-gauge` and `lodash`, none of which are
  dependencies.
- `main.jsx` swallows errors originating from "share-modal" and "vercel" scripts.
- `records.js` and `settings.js` carry indentation left over from removed code.
- The 20 stuck `auto_approved` ingestions were relabelled (data patch); see S2 for the cause.
- The five-month outage got detection, and an assertion in `api/` only; see S3.

## 3. Dead code

- **Unreachable from any entry point, ~1,700 lines:** `pages/Reports.jsx`, `pages/login.jsx`,
  `components/DevToolsPanel.jsx`, `LocalAuthDevTools.jsx`, `ComingSoonNote.jsx`,
  `components/shared/DataTable.jsx`, `components/ui/Ripple.js`, `lib/localAuth.js`,
  `lib/adminPagination.js`, `lib/solisResponseFormatters.js`,
  `lib/solisExplorerFallbackEndpoints.js`.
- **`src/lib/dataService.js`:** eight of ten exported fetchers (`getMonthlyData` …
  `getTotalEarningsData`, ~270 lines) are never imported. Only the alignment functions are used.
- **Unused dependencies:** `@chakra-ui/react`, `@emotion/react`, `@emotion/styled`,
  `framer-motion` (zero imports), `@types/react`, `@types/react-dom` (no TypeScript).
  `crypto-js` can be replaced by `node:crypto`.
- **Broken client call:** `ClerkAuthAdapter.updatePublicMetadata` / `grantRealAccess` /
  `revokeRealAccess` post to `/api/update-user-metadata`, which does not exist.
- **Scripts nothing references:** `backfill-daily-summaries.js`, `test-console.js`,
  `testSolisAPI.mjs` (which reads the `VITE_SOLIS_*` variables `.env.example` says must not
  exist).
- **Duplicates:** two `ErrorBoundary` and two `SkeletonLoader` components, split between
  `components/` and `components/shared/`, each used from different places.
- **Not addressed here (needs an owner decision):** `.agents/skills/` and `skills/` hold the
  same two vendor skill packs (73 files) plus `skills-lock.json`; the finished Clerk migration
  scripts (`migrate-users-to-clerk.js`, `export-users.js`); unused CSS and image assets were
  not checked.

## 4. Documentation

63 docs; roughly 10 are current, and 22 had no inbound link.

- **Current:** `README`, `CLAUDE.md`, `ARCHITECTURE`, `API`, `RUNBOOK`, `logic-registry/`, and
  the three dated audit / recovery / safeguards records. `API.md`'s endpoint list matched the
  handlers at audit time.
- **Actively wrong at audit time:** `START_HERE.md` (said the parser was broken against the new
  bill format and blamed `pdf-parse`); `docs/README.md` (broken `../CHANGELOG.md` link, OCR plan
  presented as active development); `guides/CEB_BILL_ENTRY_GUIDE.md` (Document AI / OCR, image
  uploads); `guides/DEPLOYMENT_CHECKLIST.md` (Netlify and npm; the project uses Vercel and
  pnpm); `CHANGELOG.md` (stopped at 2026-07-12).
- **Historical, ~35 files / ~14k lines:** the Dec 2025 `ADMIN_DASHBOARD_*` and `REFACTORING_*`
  reports, the eight `LOCAL_CLERK_*` files plus `SOLUTION_COMPLETE` and `QUICK_REFERENCE_CARD`
  (which describe the dead `localAuth` code), `migration/`, `tasks/`, completed
  `superpowers/` plans, most of `development/`, and the redundant `LOGIC_REGISTRY.md` pointer.
- **Missing:** an RLS / storage policy matrix (role × table or bucket × operation) — its absence
  is why S1 went unnoticed; a migrations workflow so the schema has one source of truth; the
  ingestion / extraction status lifecycle (`received`, `auto_approved`, `needs_review`,
  `pending_review`, `approved`, `failed_extraction`, `failed_api_limit`); a `SECURITY.md`.
- **Test gaps.** 91 tests cover the parser, alignment, CORS and the Supabase key check. Nothing
  covers `verifyAdminToken`, `sanitizeRecord`, the settings validation, the multipart parser,
  the Solis validator or the delete flows.

## 5. Remediation order used

1. Verify S1 against the live database (query above).
2. Security — S1 (code + migration), S4, S8, S9, S10, S11, S12.
3. Root cause — S2, S3, S5, S6, S7, with tests.
4. Dead code — Section 3, then re-measure the bundle.
5. Documentation — Section 4, and the tracker above.

Step 1 has **not** happened: it needs access to the live project.
