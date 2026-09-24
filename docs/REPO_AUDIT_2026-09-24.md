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

Updated as each remediation lands. `open` = not yet started.

| Step | PR | Findings | Status |
|---|---|---|---|
| 0 — audit log | this file | — | done |
| 1 — security | | S1, S4, S8, S9, S10, S11, S12 | open |
| 2 — root cause | | S2, S3, S5, S6, S7 | open |
| 3 — dead code | | Section 3 | open |
| 4 — documentation | | Section 4 | open |

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

## 5. Remediation plan

1. **Verify S1** against the live database (query above). Nothing else should be merged ahead
   of the S1 migration being applied if the policies turn out to be live.
2. **Security** — S1 (code + migration), S4, S8, S9, S10, S11, S12.
3. **Root cause** — S2, S3, S5, S6, S7, with tests.
4. **Dead code** — Section 3, then re-measure the bundle.
5. **Documentation** — Section 4, and update the tracker above.

Database migrations are added under `scripts/sql/` and are **not applied automatically**.
