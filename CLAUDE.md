# Solar Analytics Dashboard

A React 19 + Vite SPA on Vercel, backed by Supabase, that compares **what the solar inverter
generated** against **what the electricity company paid for**.

Single site, single inverter (SN `1811040244070066`, 40 kW array), Sri Lanka.

---

## The one rule that matters

**A bill received in month N reports generation from month N−1.**

Period windows come from bill dates, not calendar months:

```
periodEnd   = bill_date
periodStart = previous bill_date + 1 day      (fallback: bill_date − 30 days)
inverter    = sum of daily generation within that window
```

The open period (no bill yet) is `latest bill_date + 1 day → today`, filed under the month of the latest bill.
It is **never** clipped to the 1st of the month, and it crosses New Year (`totals.openPeriod`).

`null` means unavailable/pending. `0` means an actual measured zero. **Never conflate them** —
fabricated zeros have caused real data corruption here twice.

Spec: `docs/logic-registry/LR-001-ceb-vs-inverter-monthly-alignment.md`
Implementation: `buildAlignedRows` in `shared/domain/alignment.js` (date keys, timezone-independent)
Tests: `tests/alignment.test.js` — including a differential check against the removed v1 implementation,
frozen in `tests/fixtures/v1Alignment.js` (also exercised by `tests/energyAlignment.test.js`)

---

## Architecture

| Side | Source | Table | Collected by |
|---|---|---|---|
| Inverter | SolisCloud API | `inverter_data_live` (5-min), `inverter_data_daily_summary` | GitHub Actions cron |
| CEB | Bill PDFs, admin upload | `ceb_data` | Admin dashboard pipeline |

**CEB bill pipeline:**

```
upload → POST /api/ceb-bills/upload    (SHA-256 dedupe → Storage → ceb_bill_ingestions)
       → POST /api/ceb-bills/extract   (pdfjs-dist + regex → ceb_bill_extractions)
       → VerificationQueue.jsx         (admin reviews / edits)
       → PUT  /api/ceb-bills/records   (upsert ceb_data + mark approved)
```

**The extractor is not OCR and not AI.** `@google/generative-ai` was removed; the
`CEB_BILL_AUTOMATION_IMPLEMENTATION_PLAN.md` describing Google Document AI was **never
built**. What runs is `pdfjs-dist` text extraction (`api/_lib/pdfText.js`) plus nine regex
anchors pinned to the bill's text layout — see `api/_lib/cebBillParser.js`. Both the pre-2026
format and the 2026 `ebill-edl-v.1.0.2` redesign are covered by fixtures.

`pdf-parse` is deliberately NOT used: it pulls in `@napi-rs/canvas`, a native binary, purely to
render pages we never render. When a native module fails to load it fails at *module* level, so
the handler's `try/catch` never runs and Vercel returns its own HTML error page instead of our
JSON — which is what made a 500 here take several deploy cycles to diagnose.

---

## Security model — read before touching data access

- `VITE_SUPABASE_ANON_KEY` is **public**. It ships in the browser bundle.
- Therefore the browser client **reads only**, and only what is public by design. RLS grants `anon`
  `SELECT` on the dashboard's tables and nothing else. **Bills, the ingestion tables and the
  `ceb_bills` bucket are closed to `anon`** — the admin screens reach them through
  `/api/ceb-bills/*`. Policy matrix: `docs/SECURITY.md`.
- **Every write goes through an admin-authenticated API endpoint** using the service-role key,
  which bypasses RLS. Never reintroduce a client-side `.insert()` / `.update()` / `.upsert()`.
- Authorization is Clerk `publicMetadata.role === 'admin'`, verified server-side in
  `api/_lib/verifyAdminToken.js`. The `admin_users` table is legacy and unused.
- `SUPABASE_SERVICE_KEY` must be the **service_role** key (`SUPABASE_SERVICE_ROLE_KEY` is
  accepted as an alias). An anon key there fails every insert with "violates row-level
  security policy" — this caused a five-month outage, then a second one on Vercel.
  `api/_lib/supabaseServer.js` asserts the key's role claim and names the problem; the scheduled
  jobs and write scripts run the same check at start-up (`api/_lib/serviceKeyGuard.js`).
- **Never prefix a secret with `VITE_`.** Vite compiles those into the browser bundle.
  `api/_lib/solisAuth.js` is server-only and lives outside `src/` for exactly this reason: it
  reads env with a *computed* key, so Vite inlines the **entire** env object wherever it is
  bundled — one client import would publish every `VITE_` value.
- Vercel and GitHub Actions hold **separate** copies of the secrets. Fixing one does not fix
  the other.

---

## Commands

```bash
pnpm dev        # dev server
pnpm test       # vitest
pnpm test:e2e   # Playwright: smoke, behaviour, accessibility (once: pnpm exec playwright install chromium)
node scripts/check-bundle-size.mjs   # after build: the gzipped size budget
pnpm release minor --dry-run         # preview a release; without --dry-run it opens the release PR (docs/RELEASING.md)
pnpm lint       # eslint — 0 errors expected
pnpm build      # production build
pnpm audit --prod --audit-level high   # the CI security gate
```

CI runs lint, test, build, the bundle-size budget (`bundle-budget.json`, gzipped KB; raise it only with a reason)
and the prod audit. All must pass — none is `--if-present` any more, because two of them silently passed for months.
A separate `e2e` job (required to merge) runs Playwright against the production build as a signed-out visitor, on
desktop and phone: `smoke.spec.js` (pages, gates, redirects, no real data), `behaviour.spec.js` (motion ends on the
real figures, charts draw on scroll, date pickers, Mark above cap, no sideways scroll at 320 px, light mode) and
`a11y.spec.js` (axe, both themes; serious/critical WCAG A/AA fail).

## Operational workflows (Actions tab)

| Workflow | Purpose |
|---|---|
| Fetch Live Inverter Data | scheduled every 5 min, Solis → `inverter_data_live`. **GitHub actually runs it ~5×/day** (Oct 2026); daily totals stay correct, peaks come from telemetry |
| Generate Daily Inverter Summary | 2×/day, aggregates into `inverter_data_daily_summary` |
| Data Freshness Check | daily; opens a `data-outage` issue if rows stop arriving |
| Collect Inverter Telemetry | nightly 00:15 Colombo; last 7 days of Solis `inverterDay` + `collector/day` + `alarmList` → telemetry, alarms, uptime tables (v3, ADR-001) |
| Backfill Inverter Telemetry | manual; same collector over any range. **Dry run by default** |
| Backfill Daily Summaries | manual; rebuilds gaps from the Solis month API. **Dry run by default** |
| DB Snapshot | manual; read-only export of tables + schema as an artifact |
| Keepalive | stops GitHub disabling the scheduled workflows for inactivity |
| auto-release | after every push to main: releases what was merged (version from PR titles), then `release` tags it (`docs/RELEASING.md`) |
| pr-check | on every PR: which release merging makes; fails on a non-Conventional-Commits title |

**Take a DB Snapshot before running anything that writes.**

---

## Conventions

- Plain JavaScript, ESM. No TypeScript, no tsconfig — don't add a `typecheck` script unless
  you actually introduce TS.
- Serverless functions live in `api/`. Vercel Hobby caps this at **12 functions**; anything
  under `api/_lib/` or `api/_config/` doesn't count. Currently 6/12: `api/data/[resource].js` serves every v3 dashboard read and `api/ceb-bills/[action].js` serves the six bill
  endpoints and the Resend email webhook `inbound` (handlers in `api/_lib/cebBills/`). `tests/functionBudget.test.js` fails CI above 12.
- Health probes `/healthz` and `/ready` share ONE function via rewrites in `vercel.json` —
  two handlers would have put the count at the cap exactly.
- Dates: serialise with local components, never `.toISOString()` on a local-midnight `Date` —
  Asia/Colombo is UTC+5:30, so that silently shifts the date back a day.
- A batch job that processed nothing has **not** succeeded. Fail loudly; don't exit 0 over an
  empty result.

## Documentation

Reference — how it works now:

- `docs/ARCHITECTURE.md` — system design, both pipelines, data model, security. **Start here.**
- `docs/WORKING_RULES.md` — the rulebook (data honesty, dates, security, DB changes, gates, tracking)
- `docs/API.md` — every endpoint, auth model, error shapes
- `docs/SECURITY.md` — who can do what, the RLS / storage policy matrix, new-endpoint checklist
- `docs/MIGRATIONS.md` — how schema changes are made, and the ledger of what has been applied
- `docs/RUNBOOK.md` — operating procedures and incident response
- `docs/RELEASING.md` — versioning (SemVer), `pnpm release`, and the Release workflow that tags and publishes
- `docs/logic-registry/` — specs for the non-obvious domain rules (LR-001 alignment, LR-002 uptime, LR-003 ranges, LR-004 earnings difference)
- `docs/design/v3/` — the signed-off v3 UI design (boards, tokens, decisions); the frontend build follows it

History — why it is the way it is:

- `docs/PROJECT_AUDIT_2026-09.md` — full audit: security, API, data, UI, CI, docs
- `docs/RECOVERY_STATUS_2026-09.md` — the five-month data outage and its three stacked causes
- `docs/DATA_PIPELINE_SAFEGUARDS.md` — what now prevents a silent recurrence
- `docs/REPO_AUDIT_2026-09-24.md` — dead code, stale docs, security and validation: findings and remediation
- `docs/V3_REFACTOR_PLAN.md` — the v3 refactor (2026-10-03 to 2026-10-29): decisions, checklists, progress log, deferred register
- `docs/archive/` — superseded material, kept for history. **Nothing in it is current**

The history documents are a **record**, not a description of the present. Where they disagree
with the reference documents, the reference documents are right.

## v3 is the default dashboard (2026-10-04, release v3.0.0)

The new frontend (`src/v3/`, design in `docs/design/v3/`) is served at **`/`** and is the only app. The previous dashboard,
deprecated under `/v1` at the cutover, was **removed on 2026-10-29**; `/v1` addresses redirect into v3 (`src/v3/routes.js`) and
`tests/v3Cutover.test.js` fails if a legacy app or a browser Supabase client comes back. Visitors see demo data; viewers and admins
see real data through `/api/data/*`. Release notes: `docs/RELEASE_v3.0.0.md`. Rollback: `docs/RUNBOOK.md`.
**All real data is private (2026-10-29).** Bill tables and the bill PDF bucket closed to the anon key on 2026-10-04; the dashboard
tables followed on 2026-10-29 (`2026-10-04_v3_revoke_anon_read_at_v1_removal.sql`, applied after the v1 removal reached production):
`anon` holds SELECT on no table in `public` and no policy grants it anything. Reads go through `/api/data/*` with the service role.

## v3 foundations are live (2026-10-04)

The non-UI foundations of v3, still current. History of how they were built: `docs/V3_REFACTOR_PLAN.md`;
rulebook: `docs/WORKING_RULES.md`; decisions: `docs/adr/`.

- **Uptime log**: private tables `inverter_telemetry`, `collector_heartbeats`, `inverter_alarms`,
  `inverter_day_uptime`, `inverter_status_segments`, `collector_runs`, filled by the nightly collector
  from SolisCloud (backfilled 2024-08-02 → now). Spec: LR-002. **Alarm `1D4C2` "Loss of internet
  connection" is logger evidence, not downtime.**
- **Shared pure logic** in `shared/` (time, uptime, range stats, LR-001 on date keys, resources, demo) —
  no I/O, runs in browser, API and collectors. LR-003 specifies custom ranges (inverter only).
- **Read API** `GET /api/data/*`: viewer-level (Clerk `role: viewer`, or admin). The demo runs the same
  resource code on generated data dated 2035+.
- **Private since 2026-10-29**: `anon` can no longer SELECT any table (V3-D1, #155 done). Write-class
  privileges were revoked from `anon` on 2026-10-03.
- Array size is **41.76 kWp** (`capacity_kwp`, DC; use for kWh/kWp); the 40 kW is the AC rating.
- Daily summaries are reconciled against the inverter's own counter (0 disagreeing days at 2026-10-03; 21 of 21 again
  on 2026-10-29). **Daily peak power comes from telemetry**, raise-only: GitHub runs the 5-minute live job only a
  few times a day, so its sampled peak was far too low (`shared/domain/dailySummaryMerge.js`, nightly `--fill-peaks`).

## Current state (v3.1.1, 2026-11-10)

- v3 is the only app and is live at https://solaredge.anujajay.com. `/healthz` reports the version and revision.
- **Planned work lives on the [Solar Analytics Roadmap](https://github.com/users/Anuja-jayasinghe/projects/7)**
  (Horizon Now/Next/Later, Status, Priority, Size, Area; see `docs/WORKING_RULES.md` §7). Every piece of planned work is
  an issue on that project. `docs/V3_REFACTOR_PLAN.md` is now history.
- Every migration written on 2026-09-24 is applied (`docs/MIGRATIONS.md` ledger); `anon` reads nothing.
- Lighthouse has not been re-measured since v2.1.0 (Performance 70, LCP 5.7 s). Field vitals now come from Vercel
  Speed Insights.

## Corrected notes (2026-09-13)

Two long-standing entries in this file were wrong. Recorded here so they are not
reintroduced from memory:

- *"~20 unapproved `ceb_bill_ingestions` rows, including an orphaned June row pointing at a
  deleted file."* There was no orphan — every ingestion had its file, its extraction and its
  `ceb_data` row. The 20 rows were **fully promoted bills whose status label never advanced
  past `auto_approved`**; deleting them would have destroyed real data. They are now
  `approved`, which also protects them, since `/extract` refuses to re-parse an approved
  ingestion. All 25 ingestions now reconcile 25/25/25.
- *"Edge Function `solis-live-data` returns 500 (unused by the current data path)."* Wrong on
  both counts. It was called by v1's `DataContext.jsx` and `dataService.js` for the live-power
  widget, and 48 of 55 calls succeeded — every failure was an upstream SolisCloud 502/504
  surfacing as a 500 because one failed fetch threw straight to the catch block. It now
  retries three times with exponential backoff and full jitter, times out at 8s per attempt,
  and returns 502 (not 500) when SolisCloud is genuinely down.
  **Deleted 2026-10-29.** Once v1 was removed nothing called it (v3's live tile uses `/api/data/live`), and it was
  still deployed as v30 with `verify_jwt: false` — callable by anyone, spending SolisCloud quota. The project now has
  no Edge Functions; its source (`supabase/functions/solis-live-data/`) is in git history before that date.
