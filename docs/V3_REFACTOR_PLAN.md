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
- ☐ Catalogue every endpoint in the API PDF
- ☐ Read-only probes against our station; sample responses stored without secrets
- ☐ Probe `inverterDay` retention (1w / 1m / 6m / 12m / 24m back)
- ☐ `docs/SOLIS_API_FIELD_CATALOG.md` with adopt/skip verdicts

### LR-002 / LR-003 specs + tests · #154
- ☐ LR-002 uptime/downtime definition
- ☐ LR-003 range aggregation + tariff selection
- ☐ Pure-function implementations in `lib/` with tests written first

### P1 — Database · #155 (blocked by P2a)
- ☐ DB snapshot taken first
- ☐ Migrations on a Supabase branch, advisors clean, then applied
- ☐ New tables: telemetry, alarms, status segments
- ☐ Daily summary uptime columns
- ☐ Retire unused tables; remove `anon` SELECT on real tables (**coordinate with P3/P4 — the current app reads with anon**)

### P2 — Collection pipeline · #156
- ☐ Nightly collector (idempotent, fails loudly on empty, timeZone 5.5)
- ☐ Gated backfill workflow (dry run default)
- ☐ Freshness check extended
- ☐ Replace the wrong health score

### P3 — API · #157
- ☐ Access levels, read router (≤12 functions), CSV export, rate limits, CSP, logging, tests

### P4 — Auth and demo · #158
- ☐ Clerk-only; single route guard; roles admin|viewer|demo
- ☐ Demo fixtures dated 2035+

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
