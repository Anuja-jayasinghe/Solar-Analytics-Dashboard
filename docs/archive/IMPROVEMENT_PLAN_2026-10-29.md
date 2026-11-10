> **Archived — historical record, not current.** The 2026-10-29 plan. Its work was redone on top of v3 and merged on 2026-10-29; what was left (Rollbar, an uptime monitor) is tracked in issue #241. Current documentation: [`docs/README.md`](../README.md).

# Improvement plan — 2026-10-29

Execution plan for the findings of the 2026-10-29 repository scan (security, observability,
load time, memory, compatibility, UI/UX). Each work item is sized to be **one PR**, ordered so
that earlier PRs do not have to be rebased over later ones.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` merged · `[-]` dropped

Baseline at the time of writing: lint 0 errors / 12 warnings, 202 tests passing, build green,
`pnpm audit --prod` clean, **10/12 serverless functions** used. Nothing in this plan adds a
function.

---

## Ground rules for every PR

- CI's four gates (lint, test, build, prod audit) pass. No new lint errors; warnings may only go down.
- `null` = unavailable, `0` = measured zero. Any PR touching numbers adds a test that would
  fail if the two were conflated.
- Dates are serialised from local components, never `.toISOString()` on a local `Date`.
- Anything that writes to the database: **DB Snapshot workflow first**.
- No secrets behind `VITE_`. No client-side `.insert()` / `.update()` / `.upsert()`.
- Docs that describe the present (`ARCHITECTURE.md`, `API.md`, `SECURITY.md`, `RUNBOOK.md`,
  `MIGRATIONS.md`) are updated in the same PR as the behaviour they describe.

---

## Decisions (answered 2026-10-29)

| # | Question | Decision | Affects |
|---|---|---|---|
| D1 | Is the "real" dashboard data meant to be public? Today `anon` can read it regardless of the demo/real UI gate. | **Private.** Only signed-in users with `dashboardAccess = 'real'`, and admins, may read it. Mechanism: **Clerk JWT + RLS** (Supabase third-party auth trusts Clerk session tokens; no function slot used). | New **PR 2b**; PR 3, PR 4 |
| D2 | TanStack Query for `DataContext` now or later? | **Targeted fixes now** (PR 2); TanStack Query with the UI redesign. | PR 2 |
| D3 | Live-power widget source | **Table first, then edge**: paint from the newest `inverter_data_live` row with "as of HH:MM", refresh through the edge function, which gets a 60 s server-side cache. Both require a Clerk token (D1). | PR 4 |
| D4 | Frontend error tracking | **Rollbar**, provisioned through the Vercel Marketplace (`rollbar/error-tracking`). | PR 8 |
| D5 | Admin audit trail | **Structured logs now**, `admin_audit_log` table in the next migration batch. | PR 5, PR 9 |
| D6 | Browser support floor | **Keep Vite's default** (`baseline-widely-available`, ≈ iOS 16+). Revisit only if Analytics/Rollbar show older browsers. | PR 10 |

---

## Phase 0 — Operations (needs a person with database / dashboard access)

Runs in parallel with everything else. **Highest priority in the whole plan** — this is the
only item where private data may currently be exposed.

- [ ] **0.1 Confirm the 2026-09-24 code is deployed.** `GET /ready` → `revision` matches `main`.
- [ ] **0.2 Run the policy query in `docs/SECURITY.md`** and record whether `anon` can currently
      read `ceb_bill_ingestions`, `ceb_bill_extractions` and the `ceb_bills` bucket.
- [ ] **0.3 DB Snapshot**, then apply the pending migrations in the order given in
      `docs/MIGRATIONS.md` ("Suggested order"):
      `ceb_schema_drift` → `approve_ceb_extraction` → `revoke_anon_bill_access` →
      `ceb_data_public_columns` → `drop_cascade_trigger` (read its header first).
- [ ] **0.4 Verify after each:** admin queue loads, PDF preview opens (signed URL), approve works
      without the "not installed — approving with sequential writes" warning in the logs,
      public dashboard still renders, anon can no longer read the bill tables / bucket.
- [ ] **0.5 Update the ledger** in `docs/MIGRATIONS.md` and the "Open as of" section of
      `CLAUDE.md`.
- [ ] **0.6 Lighthouse baseline** on production (mobile + desktop), saved in the PR 2
      description so later PRs can be measured against it. Not re-measured since the
      2026-09-24 bundle cut.

---

## Phase 1 — Data correctness

### PR 1 — Null is not zero; dates are local  `[x]`  size M

The most important code change: the dashboard currently shows fabricated zeros.

**Alignment rule (`src/lib/dataService.js`)**
- `sumDailyGeneration` returns `null` when no daily row falls inside the window (and when
  `rows` is not an array), instead of `0`.
- Return coverage alongside the sum: `{ inverter, inverterDays, periodDays }` on each row, so
  the UI can mark a partial period. Keep `inverter` itself a number-or-null for compatibility.
- `ceb: Number(bill.units_exported || 0)` → `null` when `units_exported` is null/undefined;
  `0` only when the bill states 0.
- Update `docs/logic-registry/LR-001-*.md` with the inverter-side null rule and coverage.

**Consumers (`src/contexts/DataContext.jsx` and the cards)**
- `totalEarnings`: sum only non-null `earnings`; `null` when there are no rows.
- `monthlyGen`: `null` when no summary rows in the window.
- Live: `liveData?.totalGeneration?.value || 0` → `null` when absent; derived
  `inverterPotentialValue` and `environmentalImpact` become `null` too.
- Tariff fallback `|| 37` removed: missing tariff → potential value `null`, card says
  "Tariff not configured". (Same stance as `api/ceb-bills/extract.js`.)
- `CurrentPower`, `DailyTargetTracker`, `TotalEarningsCard`, `MonthlyGenerationCard`,
  `EarningsDifference`: render `—` / "No data" for `null` instead of `|| 0`.
- `EnergyCharts`: distinguish "Pending" (future month) from "No inverter data" (past month,
  `inverter === null`) and show coverage when `inverterDays < periodDays`.

**Dates**
- Export `toLocalIsoDate` from `src/lib/dateFormatter.js` (move it from `dataService.js`).
- Replace the four `.toISOString().split('T')[0]` calls in `DataContext.jsx:339-354`.

**Tests**
- `tests/energyAlignment.test.js`: finalised month with zero daily rows → `inverter === null`;
  partial coverage counts; `units_exported: null` → `ceb === null`; existing true-zero test
  still passes.
- A date test run with `TZ=Asia/Colombo` covering 00:00–05:30 local and the 1st of a month
  (set `process.env.TZ` in the test file or a vitest `env` block).

**Verify:** tests; on a local build, a year containing the April–August 2026 outage shows
"No inverter data" for those months rather than 0 kWh.

---

## Phase 2 — Load time

Measure each PR against the Phase 0.6 baseline: LCP, total JS on `/`, number of requests on `/`.

### PR 2 — Scope and de-duplicate the data layer  `[x]`  size M  (after PR 1)

- **Mount `DataProvider` only around the real app layout** (the `/*` route's dashboard/settings
  pages), not around the whole tree in `App.jsx:422`. Landing, login, signup, admin and demo
  routes must make **zero** Supabase / edge-function calls on load.
  - `SolisExplorer` and `Settings` call `useData()` — they render inside the layout, so they
    stay inside the provider. Check `Sidebar` / `BottomNav` do not need it.
- **One settings query:** replace the four sequential `system_settings` reads with one
  `.in('setting_name', [...])`, and run it in **parallel** with `functions.invoke` (`Promise.all`).
- **Fix the double chart fetch:** drop the separate `[selectedYear]` effect (`DataContext.jsx:125-130`)
  and fetch charts on year change from one place; keep polling setup independent of
  `selectedYear` so a year change no longer refetches all four keys and resets intervals.
- **Track retry timers** in a ref and clear them on unmount; skip retries while the tab is hidden.
- **Memoise context values** (`useMemo`) in `DataContext` and `AuthContext`; make
  `hasRealAccess` a `useCallback`.
- `DashboardReal` / `SettingsReal`: require `dashboardAccess === 'real' || isAdmin`, not just a
  session — groundwork for PR 2b, where anything less gets an empty RLS result.
- Docs: `ARCHITECTURE.md` (where data is fetched).

**Verify:** DevTools network on `/` shows no Supabase/edge calls; on `/dashboard` each query
runs once; year switch issues exactly two queries.

### PR 2b — Make the dashboard data private (D1)  `[x]` code — rollout needs you  size L  (after PR 2)

Today `anon` has `SELECT` on `inverter_data_live`, `inverter_data_daily_summary`, `ceb_data`
and `system_settings`, and the anon key ships in the bundle — so the real figures are public
whatever the UI says. After this PR only Clerk-authenticated users whose token says
`dashboard_access = 'real'` (or `app_role = 'admin'`) can read them. The demo dashboard keeps
using its static `DemoDataContext` data. Server-side readers (API, collectors, `/ready`) use the
service-role key and are unaffected.

**Setup — dashboard steps by you**
1. Supabase → Authentication → Third-party auth → add **Clerk** (Clerk's Supabase integration
   adds the `role: "authenticated"` claim Supabase needs).
2. Clerk → Sessions → customise the session token with
   `"dashboard_access": "{{user.public_metadata.dashboardAccess}}"` and
   `"app_role": "{{user.public_metadata.role}}"`. Not `role`: Supabase reserves that claim for
   the Postgres role.

**Code**
- `src/lib/supabaseClient.js`: create the client with
  `accessToken: async () => (await clerk.session?.getToken()) ?? null` — supabase-js's
  third-party-auth mode. This also retires the client's own GoTrue session handling, which
  covers the auth bullet of PR 3. The client needs the Clerk instance, so it becomes a
  factory/hook provided below `ClerkProvider`.
- `supabase/functions/solis-live-data`: verify the Clerk JWT (Clerk JWKS) and the
  `dashboard_access` / `app_role` claim; 401 otherwise. Confirm during the PR whether Supabase's
  own `verify_jwt` gateway accepts third-party tokens — if it does, use it and keep only the
  claim check in the function.
- Legacy `SupabaseAuthAdapter` path: remove, or make it fail closed — it cannot satisfy these
  policies.

**Migrations — `scripts/sql/2026-10-29_dashboard_access_policies.sql` (additive) then `2026-10-29_revoke_anon_dashboard_read.sql`** (DB Snapshot first)
- Revoke `anon` `SELECT` on the four tables (supersedes the anon column grant from
  `2026-09-24_ceb_data_public_columns.sql`).
- `authenticated` `SELECT` policies using
  `(auth.jwt() ->> 'dashboard_access') = 'real' OR (auth.jwt() ->> 'app_role') = 'admin'`.
  `ceb_data` stays limited to the four dashboard columns for `authenticated` too; the admin
  table keeps reading everything through `GET /api/ceb-bills/records`.
- A rollback block in the file header.

**Rollout — order matters, or real users see an empty dashboard**
1. Deploy the client that sends the Clerk token. The anon policies still exist, so it works
   either way.
2. Confirm the claims reach Postgres: a signed-in real user's dashboard keeps working with a
   temporary `authenticated` policy in place, checked against `auth.jwt()`.
3. Apply the revoke migration. Check four accounts: signed-out (no data, sign-in prompt),
   demo user (demo data only), real user (full data), admin (full data + admin screens).
4. Record it in `docs/MIGRATIONS.md`; update the policy matrix in `docs/SECURITY.md` and the
   security model in `CLAUDE.md` ("RLS grants `anon` `SELECT` on the dashboard's tables" stops
   being true).

**Verify:** with the anon key alone, `curl` on each table's REST endpoint returns `[]` or 401.

### PR 3 — Bundle and startup cost  `[x]` — eager JS on `/` 238 → 144 KB gz  size S

- `vite.config.js`: remove the **feature** `manualChunks` rules (`dashboard`, `charts`,
  `analytics`, `admin`); keep the vendor rules. They currently drag shared modules into the
  `admin` and `analytics` chunks, which are then modulepreloaded on every page.
- `lazy()` `SolisExplorer` (1,989 lines) and `MaintenancePage`.
- `src/lib/supabaseClient.js`: the GoTrue session handling is retired by PR 2b's `accessToken`
  mode. Here, only give the fallback stub the `storage` and `auth.onAuthStateChange` members
  it is missing (if the stub survives PR 2b at all).
- Production console noise: `esbuild: { pure: ['console.log', 'console.debug'] }` for builds,
  keeping `warn`/`error`.

**Verify:** `dist/index.html` modulepreloads only `react-vendor`, `vendor`, `supabase-vendor`;
record before/after sizes in the PR; Lighthouse vs baseline.

### PR 4 — Live-power path  `[x]` code — edge deploy needs you  size M  (D3; after PR 2b)

- Client: read the newest `inverter_data_live` row (with the Clerk-authenticated client from
  PR 2b) for the first paint of the live cards; then call the edge function and replace the
  values when it answers. Show the reading's timestamp ("as of 10:35"), and flag it as stale
  when it is older than ~15 min, since the GitHub cron is best-effort.
- `supabase/functions/solis-live-data/index.ts`: module-level cache of the last good response
  for 60 s (best-effort — isolates are reused but not guaranteed). Remove the ineffective
  `Cache-Control: public, max-age=30` claim or document that it does not apply to POST.
- Deploy with `supabase functions deploy solis-live-data` (needs you).

**Verify:** live cards paint without waiting for SolisCloud; edge logs show far fewer upstream
calls with several tabs open.

---

## Phase 3 — Security hardening

### PR 5 — Application-level fixes  `[x]`  size S

- `AuthContext.jsx`: `dashboardAccess` defaults to `'demo'` (lines 12, 109, 151).
- `App.jsx:274`: ops panel (`SolisExplorer`) only for `isAdmin` — the API refuses everyone else.
- `Settings.jsx`: gate editing on `isAdmin`, matching the API, not `hasRealAccess`.
- `main.jsx:8`: stop suppressing errors whose filename contains `vercel` (matches the app's own
  bundle on `*.vercel.app`); narrow to the specific third-party script, or remove.
- `api/ceb-bills/upload.js`: `MAX_BYTES` → 4.5 MB (Vercel's request-body limit) and a matching
  client-side size check in `CebDataManagement` with a clear message.
- `api/admin/users/[userId].js`: structured audit line for PATCH and DELETE
  (`actor`, `target`, `changes`) — decision D5.
- Demo URL: add `/demo`, redirect `/demodashbaard` → `/demo`, update in-app links, `sitemap.xml`.
- Tests: unit test for the upload size rule; existing suites stay green.

### PR 6 — Content-Security-Policy  `[x]` code — verify on a preview  size S  (test on a preview deploy)

- Remove `'unsafe-eval'` from `script-src`; remove `vercel.live` hosts from production
  (preview-only toolbar).
- Add `object-src 'none'`, `form-action 'self'`, keep `base-uri 'self'` and `frame-ancestors`.
- Ship first as `Content-Security-Policy-Report-Only` alongside the current header on a preview,
  exercise: Clerk sign-in/out, dashboard, admin PDF preview (pdf.js worker, possible
  `'wasm-unsafe-eval'` need), Vercel Analytics. Then enforce.
- `'unsafe-inline'` for styles stays until the redesign removes inline styles.
- Leave room in `connect-src` for the error-tracking ingest host (PR 8).

### PR 7 — CI and supply chain  `[x]` — `@clerk/backend` bump left to Dependabot (local pnpm store mismatch)  size S

- `--frozen-lockfile` in the five scheduled/manual workflows (`backfill-daily-summaries`,
  `db-snapshot`, `generate-daily-inverter-summary`, `fetch-live-inverter-data`,
  `data-freshness-check`). They run with the service-role key in the environment.
- Pin third-party actions (`pnpm/action-setup`, `gitleaks/gitleaks-action`, and the `actions/*`
  ones) to commit SHAs with a version comment.
- Add `.github/dependabot.yml`: npm weekly, grouped minor/patch; github-actions monthly.
- `functions/fetch_live_data/index.js`: `AbortSignal.timeout` on the SolisCloud fetch so a hang
  fails fast instead of eating the 5-minute job timeout.
- Bump `@clerk/backend` 3.17 → latest 3.x (every endpoint authorizes through it); run tests.

---

## Phase 4 — Observability

### PR 8 — Frontend errors and field vitals  `[~]` Speed Insights + reporting seam done — Rollbar waits on provisioning (you)  size S  (D4: Rollbar)

- **Provision first:** `vercel link`, then `vercel integration add rollbar/error-tracking`
  (Vercel Marketplace; needs your Vercel login — the CLI is not installed on this machine yet:
  `npm i -g vercel`). If the provider publishes agent skills, they are installed with it and
  take precedence over memory for the SDK API. `vercel env pull --yes` afterwards.
- Expose only the **client** (`post_client_item`) token to the browser, under a `VITE_` name —
  it is designed to be public. Server tokens never get a `VITE_` prefix.
- Init in `main.jsx`; report from the root `ErrorBoundary` and the global `error` /
  `unhandledrejection` handlers (remove the duplicate pair between `main.jsx` and `App.jsx`).
  `code_version` = commit SHA, environment = production/preview. No PII: person = Clerk user id
  only, no e-mail.
- `@vercel/speed-insights` for real-user LCP / INP / CLS.
- CSP `connect-src` gains the Rollbar API host (coordinates with PR 6).

### PR 9 — Server-side signals  `[x]` code — uptime monitor needs you  size S

- `api/_lib/log.js`: one JSON line per request — `requestId` (`x-vercel-id`), route, method,
  status, latency, actor. Adopt in every `api/` handler; replaces ad-hoc `console.log` calls.
- Freshness check: add a check on `inverter_data_live` recency during daylight hours
  (e.g. hourly 06:00–18:00 local) so an outage is noticed within hours, not a day. Reuse the
  existing issue-opening step.
- External uptime monitor on `/ready` (needs you). Checkly is on the Vercel Marketplace
  (`checkly`); run `vercel integration discover --category monitoring` at execution time and
  take the top relevant result.
- `docs/RUNBOOK.md`: where each signal lives and what to do when it fires.

---

## Phase 5 — Runtime polish and compatibility

### PR 10 — Small runtime fixes  `[x]`  size S

- `DailyTargetTracker.jsx`: replace the 30 ms `setInterval` (≈33 re-renders/s, forever) with a
  CSS animation on the wave paths; honour `prefers-reduced-motion`.
- `GoToTopButton.jsx`: passive scroll listener, rAF-throttled, no per-event `console.log`.
- `cacheService.js`: `cleanExpired` also purges expired localStorage entries; `has()` no
  longer double-counts stats.
- `ThemeContext.jsx`: wrap localStorage access in try/catch (blocked storage currently
  white-screens the app); default from `prefers-color-scheme` when nothing is saved.
- `Settings.jsx`: clear the message timeouts on unmount.
- D6: no `build.target` change.

---

## Phase 6 — Before and during the UI redesign

### PR 11 — Playwright smoke suite  `[x]` — signed-in flows need a Clerk test user  size M  — **land this before the redesign starts**

A safety net so the redesign cannot silently break routes. Runs in CI against `vite preview`
with Supabase/Clerk calls stubbed:
- `/` renders and makes no data calls (locks in PR 2).
- `/demo` renders demo data.
- `/admin/dashboard` without a session shows "Authentication Required".
- `/dashboard` renders cards with stubbed data, including a `null` month (locks in PR 1).

### Folded into the redesign (not separate PRs now — the surface is being rewritten)

- Replace the 577 inline `style={{}}` objects and JS hover handlers with CSS classes/tokens;
  then drop `'unsafe-inline'` from `style-src`.
- Visible `:focus-visible` ring everywhere `outline: none` is set today (10 places).
- ARIA labels on icon-only buttons, dialogs, nav (only 12 `aria-*` attributes today).
- One `ErrorBoundary`, one `SkeletonLoader`; skeletons instead of "Loading..." text.
- `window.confirm` in `VerificationQueue.jsx:254` → the existing `ConfirmDialog`.
- One source of truth for theme (drop the `theme` row in `system_settings`, or stop reading
  localStorage — pick one).
- `@clerk/clerk-react` → `@clerk/react`.
- D2: TanStack Query migration of `DataContext`.

### Separate, unscheduled

- `pdfjs-dist` 6 / `react-pdf` 11 major upgrade — server parser depends on pdf.js; upgrade only
  against `tests/fixtures/` and one real bill end to end.
- `admin_audit_log` table (D5) in the next migration batch.

---

## Suggested execution order

```
Phase 0 (you, in parallel) ──────────────────────────────────────────────────────►
PR 1 → PR 2 → PR 2b → PR 3 → PR 4 → PR 5 → PR 7 → PR 6 → PR 8 → PR 9 → PR 10 → PR 11 → redesign
```

- PR 1 before PR 2: both edit `DataContext.jsx`.
- PR 2b right after PR 2: it is the security fix you asked for (D1), and it needs PR 2's
  scoped provider — once `anon` cannot read, the landing page must not try.
- PR 3 after PR 2b: 2b replaces the Supabase client's auth setup, which PR 3 would otherwise
  touch first.
- PR 4 after PR 2b: the table-first live read uses the authenticated client, and both change
  the edge function (deploy with `supabase functions deploy solis-live-data` — needs you).
- PR 6 and PR 8 back to back: both change the CSP header.

**Steps that need you:** Phase 0 (migrations), PR 2b setup (Supabase third-party auth + Clerk
session-token claims) and its migration, both edge-function deploys (PR 2b, PR 4), the Rollbar
install (PR 8, Vercel CLI + login), and the uptime monitor (PR 9).
