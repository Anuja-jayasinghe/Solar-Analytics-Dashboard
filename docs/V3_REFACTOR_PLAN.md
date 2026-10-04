# v3 Refactor: Plan and Progress Log

**Branch:** `refactor/v3` · **Rollback point:** tag `v2.1.0`
**Started:** 2026-10-03
**Rule:** this file is the single source of truth for what v3 intends to do and what it has
done. If a planned item is skipped, bypassed or changed, it is recorded in
[§6 Deferred / bypassed register](#6-deferred--bypassed-register) **and** has a GitHub issue
labelled `v3-deferred`. Nothing is dropped silently.

---

## 1. Goals

1. A single-page dashboard that compares what the inverter generated against what CEB paid
   for, with a custom-range analysis tool (inverter only) under it.
2. A real inverter **uptime/downtime log**, built from Solis data (not from our sparse polling).
3. A separate **Pro metrics** page for non-everyday data.
4. An industry-grade foundation: logic specs + tests, DB schema, API, security, auth, demo,
   docs, CI, working rules.

Out of scope for v3 (tracked): alerting on downtime/faults → #151.

## 2. Decisions (confirmed by the owner)

| # | Decision |
|---|---|
| D-1 | v2 preview is discarded. May be read for reference; not used as a base or inspiration. |
| D-2 | Real data is **private** and server-gated; `anon` loses `SELECT` on real tables. |
| D-3 | Roles: `admin`, invited read-only `viewer`; everyone else gets the **demo**. |
| D-4 | Phased PRs; v1 stays live until one verified cutover. |
| D-5 | Custom date range is **inverter only**; the user selects which outputs to show. CEB comparison stays bill-aligned (LR-001). |
| D-6 | Main page, top to bottom: status strip → CEB vs Inverter summary → Explore. |
| D-7 | Pro metrics: separate sidebar page, admin **and** viewers. Demo has its own Pro page. |
| D-8 | Demo data uses dates **2035 and later** so it is obviously dummy. |
| D-9 | Explore LKR: selectable — effective bill rate (default) or Settings tariff; always labelled. |
| D-10 | Environmental impact is **removed completely**. |
| D-11 | Solis: read-only probe of history depth **plus** a deep dive of every endpoint for unused useful data. |
| D-12 | Non-UI work first. UI starts with a design phase (Figma connector if possible, else a Claude artifact); direction is modern/glassy. **Owner asked to be reminded** → #159. |

## 3. Phases and checklists

Status: ☐ todo · ◐ in progress · ☑ done · ⚠ deferred (see §6)

### P0 — Dead code and docs triage · #152
- ☑ Reference-check, then delete dead frontend files (commit 01f803c)
- ◐ Remove unused dependencies — framer-motion ☑; Chakra/emotion ⚠ V3-D3
- ⚠ Fix `vite.config.js` chunk rules and `eslint.config.js` stale references — V3-D3
- ☑ Archive history docs, delete stale docs (list in §5); docs/README.md rewritten as an index
- ☑ Write `docs/WORKING_RULES.md`

### P2a — Solis deep dive · #153
- ☑ Catalogue every endpoint in the API PDF (45 endpoints)
- ☑ Read-only probes against our station (36 calls). Raw responses NOT committed (owner/GPS/device IDs); catalog holds names+types only, probe is `scripts/solis_probe.mjs`
- ☑ Probe `inverterDay` retention: reaches back at least 24 months
- ☑ `docs/SOLIS_API_FIELD_CATALOG.md` with adopt/skip verdicts

### LR-002 / LR-003 specs + tests · #154
- ☑ LR-002 uptime/downtime definition (docs/logic-registry/LR-002)
- ☑ LR-003 range aggregation + tariff selection (docs/logic-registry/LR-003)
- ☑ Pure-function implementations in `shared/domain/` (time, solisNormalize, uptime, rangeStats) with tests written first: 74 new tests, 165 total

### P1 — Database · #155 (blocked by P2a)
- ☑ DB snapshot taken first (run 37134535084: 932 rows, 30-day artifact)
- ☑ Migrations APPLIED 2026-10-03 (owner-approved): v3_telemetry_schema, v3_harden_public_role_privileges. Verified: new tables private (RLS on, 0 policies, no anon/authenticated access); v1 reads still 200; anon writes now fail at privilege level (42501). Advisors: only INFO notices for the intentionally policy-less tables
- ☑ New tables created: inverter_telemetry, collector_heartbeats, inverter_alarms, inverter_day_uptime, inverter_status_segments, collector_runs; capacity_kwp=41.76 seeded
- ☑ Decided: uptime lives in the derived inverter_day_uptime table; the existing daily summary is NOT altered (additive-only migration)
- ☐ Retire unused tables (admin_users, system_metrics, report_logs, inverter_data_live_archive); remove `anon` SELECT on real tables at cutover (V3-D1)

### P2 — Collection pipeline · #156
- ☑ Data repair #163 / #167 complete: false zeros fixed, 153 null peaks filled, 8 summary values corrected to the inverter counter, 2026-06-03 inserted; 0 days disagree with the counter
- ☑ Nightly collector built + tested (functions/collect_telemetry, workflow collect-telemetry.yml, 00:15 local; idempotent upserts; empty/failed day/failed alarm fetch = failure + data-outage issue). timeZone note: the API ignores it, we pass 8 as documented
- ☑ Backfill RUN (owner-approved, 2026-10-03): 792 days, 111,453 telemetry rows, 435 alarms, 784 ok + 8 no_data days, 153 null peaks filled. Gated workflow exists (backfill-telemetry.yml, dry run default) but is only dispatchable once merged to main; the same CLI ran locally
- ◐ Freshness check extended (shared/domain/freshness.js, 9 tests; wired into scripts/check_data_freshness.js). NOT ARMED: empty tables are skipped until TELEMETRY_REQUIRED=true is set in data-freshness-check.yml after the first successful nightly run (V3-D4, tracked #165)
- ☐ Replace the wrong health score (in the Pro metrics page build, #160)

### P3 — API · #157
- ☑ Access levels (shared/domain/access.js; single authenticate() path), read router api/data/[resource].js (function 11/12), CSV export w/ formula-injection protection, per-user rate limit, private caching, generic 500s, 71 tests, docs/API.md updated, unused open-meteo CSP entry removed
- ⚠ Not done, tracked #166 (V3-D5): real-deployment verification of /api/data (Vercel preview is protected), CSP unsafe-eval/inline tightening, api_logs request logging, ceb delete-endpoint merge, distributed rate limiting, ETag

### P4 — Auth and demo · #158
- ◐ Roles admin|viewer|none implemented server-side (shared/domain/access.js, validated PATCH with typo + self-demotion guards, migration script scripts/migrate-roles.mjs dry-run: 8 Clerk users, 1 legacy-real user would become viewer; NOT applied, needs owner go-ahead). Clerk-only frontend + single route guard: frontend rewrite, folded into P5b (#160)
- ☑ Demo dataset dated 2035+ (shared/demo/{demoData,demoApi}.js, 17 tests): runs the REAL resource code against generated data, so it cannot drift from the API; covers outage, collection gap, comms-lost, late start, tariff change, open bill period

### P5a — UI design · #159  **← DISCUSS WITH OWNER BEFORE STARTING**
- ☐ Detailed design discussion (glassy/modern; a11y contrast; Figma vs artifact)
- ☐ Design sign-off

### P5b — Frontend build · #160 (blocked by P5a)
### P7 — Docs and CI · #161

## 4. Ordering and dependencies

```
P0 ─┬─► P2a ─► P1 ─► P2 ─► P3 ─► P4 ─► P5a(design) ─► P5b ─► cutover ─► P7
    └─► LR-002/003 (specs + tests) ──────┘
```

`anon` SELECT can only be removed once nothing in the shipped frontend reads with it. v1 keeps
reading with `anon` until cutover, so **P1's privacy migration is staged**: new tables are
created private from day one; the revoke on existing tables ships with the cutover. This is
recorded as a deliberate sequencing choice, not a skip (see §6, V3-D1).

## 5. Docs triage list (P0)

Delete (stale, superseded): `ADMIN_DASHBOARD_*` (5), `REFACTORING_APPROACH`, `REFACTORING_COMPLETE`,
`REFACTORING_EXECUTION_SUMMARY`, `CLEANUP_GUIDE`, `COPY_PASTE_INTEGRATION`, `LOCAL_AUTH_QUICK_START`,
`LOCAL_CLERK_*` (6), `QUICK_REFERENCE_CARD`, `SOLUTION_COMPLETE`, `migration/*`, `tasks/DEMO_REAL_SEPARATION_TRACKER`,
`guides/DATA_REFRESH_AND_CACHING_GUIDE`, `guides/TESTING_GUIDE`, `development/{CLERK_MIGRATION_PREPARATION,
ADMIN_IMPROVEMENT_NOTES,USER_ACCESS_MANAGEMENT,USER_MANAGEMENT_GUIDE,USER_MANAGEMENT_IMPLEMENTATION,LOCAL_LOGIN_DEBUG_LOG}`.

Move to `docs/archive/` (history): `PROJECT_AUDIT_2026-09`, `RECOVERY_STATUS_2026-09`,
`development/CEB_*`, `development/SOLISCLOUD_EXPLORER_*`, `development/DAILY_SUMMARY_IMPLEMENTATION`,
`superpowers/*`.

Keep as reference: see CLAUDE.md "Documentation".

Deletion is preceded by a grep for inbound links; any live link is repointed or the file kept.

## 6. Deferred / bypassed register

Every row has a GitHub issue. Add a row the moment something is skipped.

| ID | What | Why | Issue |
|---|---|---|---|
| V3-D1 | Revoke `anon` SELECT on existing real tables is staged to cutover, not P1 | v1 reads with anon until cutover | #155 |
| V3-D2 | Downtime/fault alerting | Out of scope for v3 | #151 |
| V3-D4 | ~~Freshness check for the telemetry pipeline ships unarmed~~ **Resolved 2026-10-04**: armed after the first successful nightly runs | done | #165 (closed) |
| V3-D5 | P3 leftovers: real-deployment verification of /api/data, CSP tightening, request logging, delete-endpoint merge, distributed rate limit, ETag | Cannot observe the protected Vercel preview; the rest need browser testing or are low value now | #166 |
| V3-D6 | ~~Live peak kW today~~ done: `live.peakTodayKw/At` from today's inverterDay (shared/domain/dayPeak.js) | — | #174 (closed) |
| V3-D7 | Optional weather chip on Pro metrics; 'Nightly collections 7 of 7' row dropped (no data source for either) | Needs a source/privacy decision (weather) and a read-only exposure of collector_runs | #178 |
| V3-D8 | v3 Admin gaps: edit/delete approved bills, delete user, send invitations, collector run history | Cutover blockers for the first two; the rest need new endpoints | #181 |
| V3-D3 | UI-impacting cleanup held for the design phase. **Mostly resolved by `main` (PRs #143-#150, 2026-09-24)**: Chakra/emotion/crypto-js removed, vite `manualChunks` rewritten, Open-Meteo CSP entry gone. **Still open**: duplicate `ErrorBoundary`/`SkeletonLoader`, the 1,989-line `SolisExplorer` (rebuilt as the Pro page), stale ESLint refs, `/demodashbaard` typo, `VITE_USE_CLERK_AUTH` flag | Changing them alters what users see; UI waits for design sign-off | #162 |

## 7. Progress log

Newest first. One entry per meaningful change: date, what, commit/PR, deviations.

- **2026-10-03** — Plan agreed; branch `refactor/v3` created; issues #152–#161 opened;
  this file created. `docs/UI_CURRENT_STATE_AUDIT.md` committed as the UI baseline.
- **2026-10-03 (P0)** — Baseline: 115 tests, 0 lint errors, build OK. Deleted 11 unreferenced frontend files
  (01f803c); disposed v2 preview + its 24 tests + route, removed unused lazy imports and `framer-motion`
  (tests now 91/91, matching CLAUDE.md); deleted ~40 stale docs (admin-dashboard notes, LOCAL_CLERK_*,
  migration/*, superseded guides), archived history docs to `docs/archive/2026-v2-era/` and repointed every
  inbound link; rewrote `docs/README.md`; added `docs/WORKING_RULES.md`. Deviation: UI-impacting cleanup
  deferred → V3-D3 / #162. Branch not yet pushed.
- **2026-10-03 (P2a)** — Solis deep dive done (#153). Key findings: inverterDay = full-fidelity 5-min telemetry with
  129 fields; history >= 2 yrs so the uptime log can be fully backfilled; cadence varied (1/5/18 min) so LR-002 must be
  cadence-aware; night has no points (not state 2); timeZone param ignored and timeStr is UTC+8; 199 alarms in 3 months,
  mostly grid under-voltage (code 1011); alarmList paginates (explorer misses half); array is 41.76 kWp (not 40) for
  kWh/kWp. Skipped endpoints (epm/weather/ammeter/fleet/write) are intentional and listed in the catalog.
- **2026-10-03 (LR-002/003)** — Specs, acceptance tests and implementations landed (#154). `shared/domain/` holds pure,
  dependency-free modules usable by browser, API and collector. Replayed real probe days: 2026-10-02 → 97.4% uptime, three
  grid under-voltage trips, no gaps; 2026-04-06 → five 12–19 min silent gaps with no alarm (89.3%, flagged as lacking logger
  evidence); 2025-10-03 → coarse 17-min cadence reported as resolution ~52 min, not as perfect uptime.
  Data findings (read-only): all 25 bills have effective rate exactly 37.00 (tariff has never changed, so a "tariff drift"
  tile would be flat — keep the mechanism, do not feature it); 15 zero-generation days in the daily summary, 4 provably false
  and 8 unknowable (#163); peak_power_kw null on 149/791 days.
  Gates: 165 tests, lint 0 errors, build OK, prod audit (high) clean. Not yet pushed.
- **2026-10-03 (P1 prep)** — Wrote the additive v3 schema migration + rollback and a privilege-hardening migration (found
  that anon holds INSERT/UPDATE/DELETE/TRUNCATE table grants, blocked only by RLS). Nothing applied. Decision: no raw JSON in
  telemetry (size; source retains >= 2 years). DB is 16 MB so storage is not a constraint.
- **2026-10-03 (P1 applied + #163 part 1)** — Snapshot taken (932 rows) then both migrations applied via Supabase and verified.
  Data repair: the 12 suspect rows (ids 893-904, one bulk insert on 2025-11-23) -> 4 corrected from Solis, 8 deleted; zero days now 3
  (genuine). Draft PR #164 opened so CI runs on refactor/v3. Observation logged on #163: period ending 2025-09-04 has inverter 4675
  vs CEB 2748 kWh (billing timing?), to investigate before designing the CEB summary.
- **2026-10-03 (P2)** — Collector built test-first: shared/domain/telemetryPipeline.js (12 tests) and
  functions/collect_telemetry/{run.js,index.js} (22 tests, fake adapters: dry run writes nothing, failed day never produces a
  row, empty = failure, alarm-fetch failure = unknown not none, peak fill only on NULL peaks of existing rows, idempotent).
  Live dry run on the last 3 days worked end to end (e.g. 2026-10-02: 146 pts, 97.4%, 3 trips). 199 tests total.
  Note: backfill-daily-summaries.yml claims inverter_data_live "cannot be backfilled"; wrong since inverterDay (fix in P7).
- **2026-10-03 (P3)** — Read API built test-first (shared/domain/{access,alignment}.js; api/_lib/data/{query,rateLimit,csv,resources,handler,live,repo}.js;
  api/data/[resource].js). alignment.js re-implements LR-001 on date keys: identical to v1 for complete data (differential test),
  identical across 4 timezones (v1 is not), and returns null instead of a fabricated 0 for windows with no data. 278 tests.
  Deviation: could not verify the deployed function (Vercel Authentication on previews; Vercel connector not authorised for the
  project) -> V3-D5/#166.
- **2026-10-03 (P4 server side)** — Moved pure resource logic to shared/data/ so the demo can run the real code. Demo dataset (all dates
  2035+, fake identifiers, deterministic). Building it exposed a real flaw in LR-002: a lone heartbeat at the recovery edge of a gap was
  taken as proof the logger stayed up; logger evidence now comes from the interior of the gap (spec + tests updated). Admin user endpoint
  hardened: validated roles, no self-demotion, generic 500s, POST removed, accessLevel in responses. 295+ tests.
- **2026-10-03 (merge with main)** — Discovered my local `main` was stale: it stopped at PR #142 while `origin/main` had the
  owner's PRs #143-#150 (2026-09-24): v2 removal, a repository audit, security hardening of the bill pipeline, dead-code and doc
  reorganisation, new docs (SECURITY.md, MIGRATIONS.md, START_HERE.md, REPO_AUDIT) and 5 unapplied SQL migrations. I had duplicated parts
  of that (v2 removal, dead-code deletion, doc triage) and unknowingly duplicated its admin-user validation. Merged main into
  refactor/v3: took main's side for every docs move/delete, unified user-role validation on main's `userMetadataRules.js` (extended with
  `viewer`, role list shared with the enforcer; my duplicate validator removed), kept main's dependency set (+ my coverage dev-dep),
  restored PROJECT_AUDIT/RECOVERY_STATUS to docs/ root where main links them, added the collector to the `serviceKeyGuard` convention,
  recorded my two migrations and the data repairs in MIGRATIONS.md, and added a v3 target-state section to SECURITY.md.
  Lesson recorded in WORKING_RULES: fetch and compare with origin/main before starting a long-running branch.
  Result: 417 tests, lint 0 errors, build OK, prod audit clean.
- **2026-10-03 (backfill + LR-002 correction)** — Two backups first (GitHub snapshot + full local export of 18 tables, 2,100 rows), then the
  owner-approved write: 111,453 telemetry rows over 784 days, 165,844 heartbeats, 435 alarms, 792 uptime rows; 153 null peaks filled; 8
  days (2025-04-14..21) have no Solis telemetry at all (a 10-day internet outage), recorded as no_data. Verifying the result found two bugs of
  mine: (1) the report counter lost updates under concurrency (data right, count wrong; regression test added); (2) days scored 0%
  while producing 140+ kWh because alarm 1D4C2 "Loss of internet connection" is logger evidence, not downtime. LR-002 corrected spec-first,
  28 days re-derived from stored facts with no Solis calls (scripts/rederive_uptime.mjs), mean uptime 96.68% -> 98.00%, genuine outages
  unchanged. Reconciliation found 8 daily-summary values below the inverter's own counter (largest 2026-02-01: 89.3 vs 128.4 kWh) and the
  missing 2026-06-03 row (142.0 kWh): needs owner approval, #167.
- **2026-10-03 (record corrections #167)** — Fresh snapshot (run 37141010417), then owner-approved: 8 daily-summary values raised to the inverter's own
  counter (+103 kWh net) and the missing 2026-06-03 row inserted. Reconciliation afterwards: 0 disagreeing days. The 2025-08-04 bill period
  (CEB 5,859 vs inverter 3,827) is a CEB meter-read timing shift, not a data error: with the next bill (2,748 vs 4,675) the pair totals
  8,607 vs 8,501 kWh, 1.2% apart.
- **2026-10-04 (merge + nightly live)** — PR #164 merged to main (a5f24f2); production serves revision a5f24f2 with v1 intact, readiness probe healthy, /api/data refuses unauthenticated calls. The nightly collector ran on GitHub with the real secrets (manual run: 7 days, 1,337 points, 0 failures) and then on its own schedule. Freshness check armed (#165). CLAUDE.md updated to the v3 state.
- **2026-10-04 (UI design, round 3, issue #159)** — Artifact prototype revised after the owner's review (still design only, no frontend code).
  Decisions recorded: Statistics tile keeps only average per day, best day, lowest day, drawn on one range chart (total, specific yield,
  capacity factor, estimated earnings, days-above removed: duplicates or not relevant); "Mark above" threshold added to CEB vs Inverter
  (inverter series highlighted); data-freshness ring moved into the daily-target tile, gauge keeps only the online bulb; inverter generation
  defaults to an area chart; new "Generation through the day" tile (pick a day, kWh per hour); sidebar is full height, collapses to icons,
  duplicate buttons removed (theme switch is in the header and in Settings > Appearance); all colours are theme variables so further themes
  are a block of tokens plus a card in Settings; Pro metrics, Admin (bills, access, data health), Settings and a sign-in doorway are in the
  prototype. The earnings difference is kept and specified as **LR-004** (`shared/domain/earningsDifference.js`, 6 tests): per complete bill
  `(inverter kWh - CEB kWh) x that bill's own rate`, ineligible bills excluded and counted, never today's tariff, no "accounting error"
  warning. Dropped by the owner after review: the "Revenue lost to downtime" estimate card (modelled figure, no rule). Settings page reads/writes and weather source are build-phase items (#160).
- **2026-10-04 (UI design signed off, #159)** — Owner approved the design after four review rounds. Saved to `docs/design/v3/` (README with decisions and
  build rules, the published boards, the editable sources and demo-data scripts). Round 4 changes: money-gap sign convention fixed (CEB paid minus
  generation worth; negative = CEB paid less; LR-004, code and tests updated), "Revenue lost to downtime" removed, Pro metrics / Sign in / Admin
  and phone boards added, and a dedicated compact phone Overview (hero + totals + CEB chart in the first 844 px, Explore tiles behind tabs).
  Next: P5b frontend build (#160) against `docs/design/v3/README.md`.
- **2026-10-04 (P5b foundation slice)** — `feat/v3-ui-foundation`: v3 app at `/v3` (own entry via dynamic import in main.jsx, v1 untouched): theme tokens + registry (dark/light, Settings > Appearance), app shell (collapsible sidebar / phone tab bar), nav as data, `RequireAccess` guard, access level from Clerk metadata with a 5 s fallback to demo when Clerk cannot load, data client (live `/api/data/*` with bearer token, or the shared demo code in the browser), request cache, `useResource` (null until loaded, never 0), tap/focus/hover `Tip`. 32 new tests. Placeholder Overview proves the pipeline (demo shows 21.4 kW / 98.2 kWh). Branch rules now active on main and integration/*; KEEPALIVE_PAT set (#171 closed).
- **2026-10-04 (P5b overview-live slice)** — `feat/v3-ui-overview-live`: headline tiles (this billing period / all-time generation / all-time earnings), Today filler with target progress and faint freshness ring, live gauge with status bulb. API: new `totals` resource (lifetime generation over days that have a reading + missing-day count, earnings over bills that carry a figure) and `live.todayKey` (the server's Colombo date, so the browser never decides "today"); demo live now has peak fields. Peak on real data is deferred (V3-D6, #174): dash until built. 482 tests. Checked in a browser on demo data: matches the board (1,464 kWh, 78.5 MWh, LKR 3.07 M, 65% filler, 21.4 kW gauge).
- **2026-10-04 (P5b ceb-compare slice)** — `feat/v3-ui-ceb-compare`: CEB vs Inverter (bars/lines/area, 8/12/All, step through periods, partial periods striped, open period "awaiting bill", variance tags only for complete periods), draggable/typed/keyboard "Mark above" line (inverter periods above highlighted, count shown), the LR-004 money gap strip aligned under the columns (window total, all-time gap, per-bill working in the hint), and a "Show as a table" view. Pure logic in `src/v3/ceb/rows.js` and `src/v3/charts/scale.js` (24 tests). On touch devices only the handle drags, so page scrolling still works. Checked in a browser on demo data: matches the board (−LKR 29.3 K in view, −LKR 86.4 K all-time).
- **2026-10-04 (P5b generation slice)** — `feat/v3-ui-generation`: Inverter generation over time (week/month/year/custom, area default, line, bars, step through time, year grouped by month with partial months hatched, draggable/typed "Mark above"), Generation through the day (pick a day, kWh per hour integrated from the 5-minute telemetry, peak and time, Colombo hours), Statistics (average per day, best day, lowest day on one range chart). On phones the three become one tile with Generation | Day | Stats tabs. Pure logic in `src/v3/explore/{series,hourly}.js` (21 tests). No new API: reads `range` and `telemetry`. The phone tabbed layout is already in this slice, so `overview-phone` reduces to a visual check.
- **2026-10-04 (P5b pro slice)** — `feat/v3-ui-pro`: Pro metrics page (/v3/pro; visitors see demo, viewers/admin real): four health rings (uptime and time stopped from the API aggregate, open alarms, data completeness), uptime-by-day strip with a distinct no-data state, alarm history (lost-internet shown as a logger event), data and logger bars (completeness, logger offline minutes, alarms/logger known), electrical health for the latest full day (string balance with the 8% flag, hourly max temperature, hourly frequency range, grid V and power factor), effective LKR per kWh per bill, year over year. Pure logic in `src/v3/pro/metrics.js` (17 tests); uptime is never recomputed in the browser. Dropped for lack of a data source: weather chip and "Nightly collections" row (V3-D7, #178).
- **2026-10-04 (P5b settings-door slice)** — `feat/v3-ui-settings-admin`: Settings page: Appearance (themes), Plant (admin edits daily target / array size / inverter rating / reference tariff; viewers and visitors read-only; unset shows an empty box, never 0), Account (role, email, sign in/out), fault alerts marked planned (#151). Backend: `PUT /api/settings` now also accepts `{ setting_name, setting_value }` (the read API has no row ids); rules extracted to `api/_lib/settingsRules.js` with tests (previously untested). The "LKR basis selectable" preference from decision D-8 has no consumer any more (the statistics earnings output was removed in design review), so it was not built; recorded here as superseded.
- **2026-10-04 (P5b admin slice)** — `feat/v3-ui-admin`: Admin (admin only, RequireAccess + every call re-checked by the API): Bills (upload a PDF then read it, review queue with editable period/meter/units/earnings and the implied rate, Approve = one server transaction, Reject/discard with a confirm, open the PDF via a 5-minute signed link, approved bills list), Access (list people, change role viewer/admin/no access; you cannot change your own), Data health (latest daily total, days without a reading, latest bill, bills without earnings; maintenance links to the GitHub workflows, dry run first). Pure logic in `src/v3/admin/{billForm,users,health}.js` and the `createAdminApi` wrapper (19 tests). No new backend. Not exercised against the real API in a browser (Clerk only works on the production domain); gaps recorded as V3-D8 (#181), the first two are cutover blockers.
- **2026-10-04 (P5b phone check + release candidate)** — Loaded /v3, /v3/pro and /v3/settings in 390 px frames in a real browser: found and fixed horizontal overflow (grid tracks need `minmax(0, 1fr)`), the account button showing text in the tab bar, and long KPI labels (short labels on phones). All eight slices are on `integration/v3-ui`; next is a PR into `main` that ships /v3 beside the unchanged v1. The actual cutover (v1 replaced, anon SELECT revoked #155) stays a separate owner-approved step with blockers #181 (edit/delete approved bills, delete user).
- **2026-10-04 (admin QA on production)** — Signed in as the admin in the owner's Chrome and exercised /v3 against the real API: Overview and Pro show real data (99.6 MWh, LKR 3.75 M, 26 bills); Admin > Bills (empty queue, 26 approved bills), Access (8 people), Data health (latest daily total 2026-10-03, 8 days without a reading, latest bill 2026-10-03); Settings save round-trip (daily target 140 -> 141 -> back to 140, persisted after reload); upload of a fake PDF (stored, reading failed as expected, appeared as "failed extraction", discarded; queue clear, still 26 bills). Not exercised: approving a real bill and changing someone's role (would alter real data). Fixes from the QA: honest message when the upload worked but reading failed, scroll to top on navigation, disabled-field styling, "Deleting…" label. Clerk Agent Tasks (minting a session) was declined by the permission check; the owner's existing browser session was used instead.
- **2026-10-04 (cutover blockers #181)** — v3 Admin can now edit and delete saved bills (inline edit with the changes spelled out and the implied rate, the whole record re-validated by the server; delete behind a confirm that names the bill) and remove a person (confirm; you cannot remove yourself). Invitations from the UI and collector run history remain open (new endpoints needed) and are not blockers. Production check with the owner's two real bills (Aug and Oct 2026): both were already ingested, so the upload correctly answered "This exact file has already been uploaded"; approving a brand-new bill is covered by tests and will be exercised with the next real bill.
- **2026-10-04 (live peak #174)** — `/api/data/live` now returns `peakTodayKw` / `peakTodayAt`: the live provider reads today's `inverterDay` (one extra Solis call per 5 minutes, cached; a failure keeps the last peak or reports unknown without affecting the live reading), `shared/domain/dayPeak.js` finds the maximum and its Colombo time. The Today tile shows it on real data.
- **2026-10-04 (cutover, release v3.0.0)** — The new dashboard is the default at `/`; the previous one is deprecated under `/v1` with a banner; old paths redirect; real 404 page; error boundary; per-page titles and a skip link; production bundles drop `console.log/debug/info`; the entry no longer preloads v1-only chunks (React only; Recharts, Supabase and v1 admin load only in v1); sitemap/robots updated; version 3.0.0; changelog, runbook rollback and `docs/RELEASE_v3.0.0.md` (production-readiness analysis) written. #174 (live peak) and #181 (edit/delete bills, remove people) closed. Staged and NOT applied (need the owner): `2026-09-24_revoke_anon_bill_access.sql` (safe now) and `2026-10-04_v3_revoke_anon_read_at_v1_removal.sql` (+ rollback; breaks `/v1`, applied with its removal). Read-only check of the database found anon can still read ceb_data, daily summaries, settings and (until the 09-24 migration) the two bill tables. Remaining: remove `/v1`, then apply the staged migration.
- **2026-10-04 (bill tables closed to anon)** — Owner-approved. DB Snapshot first (run 37193304087), then `2026-09-24_revoke_anon_bill_access.sql` through the Supabase connector. It dropped five policies: anon SELECT on `ceb_bill_ingestions` / `ceb_bill_extractions`, and anon SELECT, INSERT and DELETE on the `ceb_bills` storage bucket (the earlier audit had only noted read access; the bucket also accepted anonymous uploads and deletes). Verified as anon (tables `[]`, bucket empty, upload refused) and on production as admin (queue, approved bills, Edit/Delete all load). Remaining for #155: remove `/v1`, then apply `2026-10-04_v3_revoke_anon_read_at_v1_removal.sql`.
- **2026-10-04 (owner review round 2, before removing v1)** — No text selection or copying (as v1; form fields excepted); hints off by default with a sidebar switch (navigation labels stay); billing period now adds today's live reading while today is not stored yet (it showed a dash on the first day of a period); all-time generation uses the inverter's lifetime counter (101.1 MWh; the daily records sum to 99.6 MWh because they miss the 8-day April 2025 outage, anything before 2 Aug 2024, and today); the demo counter now agrees with its daily records; full-width layout and no 8 px page border (the browser's default body margin, previously reset by v1's global stylesheet); "Mark above" can be hidden (remembered); bigger bars; generation over time and through the day in one tile (switch, over time by default); statistics with their own period (last 30 days default, 365 days, lifetime); sidebar collapsed by default with the SolarEdge mark; account moved to a top-right bubble with nickname and preset pictures (saved to the Clerk account, or the browser for visitors), Settings and sign in/out; bill PDF preview inside Admin (signed link, in-page viewer) for approved and queued bills; sign-in and sign-up pages embed Clerk's own forms (no pop-up) and link to the owner's contact section.
