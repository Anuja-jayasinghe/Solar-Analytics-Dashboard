# Changelog

All notable changes to the Solar Analytics Dashboard project.

## [Unreleased]

### Added
- **"Generation through the day" is a live power curve, as SolisCloud draws it.** Every power reading in kW (about one a
  minute from SolisCloud; the caption states the real interval) instead of kWh on the hour, with the day's peak marked on the line ("Peak so far 26.3 kW · 11:35" for today). It
  opens on **today**, which comes from SolisCloud, refreshes every two minutes, and adds the live reading as a "now" dot.
  A hover line shows the exact time and kW anywhere on the curve. Holes in the readings break the line rather than
  being drawn through. Today's total uses the inverter's own counter. The "Per hour" bars were removed: the curve shows the whole day.
  A **Today** button jumps back from any past day.
  The generation section now opens on this "Through the day" view (on phones, the Day tab).
  Today's readings are read once by the page and shared, so the Today tile's peak is the chart's peak (it no longer
  shows a dash while SolisCloud's day read is slow).
- **Inverter generation → Year is a calendar year you pick** with ‹ 2026 › arrows (one year shown, so the control never
  grows) instead of a rolling 365 days. It never goes past the data: the arrows stop at the first and last year with
  readings, and any other year is pulled back inside them. It
  always shows January to December. A month only partly recorded (the first one, or this one so far) is drawn as
  partial with its day count. A month with no readings stays empty and says why (not yet, before records began, or
  not recorded), never a zero. The year's total and "N of M days recorded" sit above the chart.
- **Date pickers jump by month and year.** Clicking the month title opens a month picker with year arrows, so a date a
  year back takes three clicks instead of twelve presses of the month arrow. Months outside the data are greyed out.
- **Explanations sit behind ⓘ icons instead of a Hints switch.** The sidebar's Hints switch (off by default, and
  missing on phones) is gone. An ⓘ appears only where the screen does not already say it: bill date to bill date, the
  lifetime counter, bills left out of earnings, how uptime and time stopped are counted, unresolved alarms, logger and
  alarm-log coverage, the money-gap formula, the average per day, SolisCloud or fault states, Solis's alarm advice, and
  admin health rows that need attention. Hover (short delay), tap or keyboard focus opens it; a click keeps it open;
  a click elsewhere, Escape or a scroll closes it. Obvious ones (Today, peak, freshness, Online, best/lowest day, all-time
  coverage) have none, and the texts are shorter.
- **Chart details always show on hover** (a bar's period and figures), with an arrow to what they describe. On phones a
  tap shows one until the next tap. They close when the page scrolls, so one no longer stays stuck on a bar that has
  moved away. Tooltips use 12.5–13 px text.
- **Chart tooltips say only what the bar does not.** CEB vs Inverter columns show just the period ("Jun 4 → Jul 4"),
  since both totals are on the bars. Money-gap bars show the period and one plain line ("CEB paid LKR 5.8 K less than the
  generation was worth"). Generation points show the date, and the value only when there are too many bars to label.
  The uptime strip lists only what stopped the inverter; PV inputs add only the voltage; rate and year-on-year details
  are trimmed. The CEB table uses the same "Jun 4 → Jul 4" spans.
- **Chart tooltips sit on the bar they describe**, just above its value label, instead of all at the top of the chart.
- Tooltips follow the theme: white with dark text and a soft shadow in light mode, a dark surface in dark mode.
- **The live tile says why there is no live reading.** When SolisCloud does not answer, the status reads "SolisCloud not
  responding" (amber) instead of "Unknown", because the inverter may be fine. The tile shows the newest real reading with
  its time ("Last saved reading at 11:50", "Today · as of 11:50", "kW then"): the last value in memory, or, after a fresh
  deployment, the newest reading the scheduled job saved today in `inverter_data_live`. With nothing saved today the
  figures stay a dash. Nothing is estimated.
- An inverter alarm shows its SolisCloud state code ("Fault · code 1011"). The "could not be loaded" note names
  SolisCloud instead of `upstream_unavailable`.
- The live status sits in the gauge tile's top-right corner as designed (its tooltip wrapper had pulled it beside the
  gauge, where longer labels wrapped), and the gauge's caption wraps on phones instead of widening the tile. The Today
  circle shows a dash, not "No target", when a target is set but today's figure is unknown.

### Changed
- **Inverter generation: Week and Month are calendar periods.** Week is Monday to Sunday, labelled "Week 44 · 2026"
  (ISO week numbers; hover for the dates), with weekday labels on the chart. Month is the calendar month, labelled
  "November 2026", always drawing all its days. Days not reached yet stay empty, never zero. The arrows step a whole
  week or month and stop at the data. Before, both were rolling 7 or 30 days ending on the newest day.
- **Custom is just the range calendar**, opening on the latest complete bill period (bill date to bill date, from the
  new `totals.lastBillPeriod`). The arrows and the date text beside it are gone, and the calendar's quick picks start
  with "Last bill period".
- **Statistics: "Lowest day" is now "Lowest full day".** The lowest recorded day was almost always a power cut or a
  part-recorded day (e.g. 11.5 kWh), not a poor-weather day. It now counts only days the uptime log shows the inverter
  running all day: at most 30 min stopped, since short grid trips are routine here. The card says how many days were
  left out, its ⓘ says why and gives the lowest recorded day too, and the chart marks the same day.
- **The Area chart type is gone.** It was the line with the space under it shaded, nothing more. Inverter generation
  now offers Line (the default) and Bars; CEB vs Inverter offers Bars and Lines.

### Fixed
- **Date pickers and the bill viewer follow the theme.** In light mode they were a dark panel with dark text (they used
  the tooltip colours that are dark in both themes); they are now white with dark text, and unchanged in dark mode.
- **A reading that is not current now looks it.** When SolisCloud is not answering, the Today and live power tiles turn
  grey (the fill, the gauge arc and the numbers), the wave stops, and the Today tile shows an amber "Not live · as of
  16:58" chip instead of the faint freshness ring.
- **Reading times no longer print with decimals.** A reading taken at 16:58:08 showed as "16:58.135233…"; it now shows
  16:58.
- **"This billing period" runs bill date to bill date** (LR-001). Between the 1st of a month and the next bill, the open
  period was clipped to the 1st ("since 1 Nov" instead of "since 4 Oct"), filed under the wrong month, and the month
  before it showed "missing bill". It now starts the day after the latest bill, however late the next bill is, and stays
  right across New Year (`totals.openPeriod`). Past months without a bill no longer count days a later bill already
  covers, so no day is counted twice. The CEB table shows each period's real dates.
- **Bill PDF extraction closes the document through its loading task**, so it works with pdfjs-dist 6 as well as 5
  (pdfjs 6 removed `destroy()` from the document; the old call threw after reading the text and failed every upload).
  `tests/pdfText.test.js` now reads a real PDF built in the test, so a pdfjs upgrade that breaks extraction fails CI.

## [3.0.0] - 2026-10-04

The new dashboard becomes the default. Full notes and the production-readiness analysis:
[`RELEASE_v3.0.0.md`](RELEASE_v3.0.0.md). `v2.1.0` is the last build of the previous dashboard.

### Changed
- **`/` is now the new dashboard** (Overview, Pro metrics, Settings, Admin, sign-in). The previous dashboard is deprecated:
  it is served under `/v1` with a "V1 · DEPRECATED" banner on every page. Old paths (`/dashboard`, `/demodashbaard`,
  `/login`, `/admin/dashboard/…`, the `/v3` preview prefix) redirect to their new home; anything else is a real 404 page.
- Production bundles no longer contain `console.log/debug/info` (warn and error are kept). The new app's first page no longer
  preloads the Supabase, vendor, v1-admin or charts chunks.
- Real data is private to invited users through the authenticated read API; visitors get demo data dated 2035+.

### Added
- LR-004 earnings difference (CEB paid minus what the generation was worth, at each bill's own rate).
- Live peak kW today and its time on real data; `totals` resource; `live.todayKey`; `PUT /api/settings` by setting name.
- Admin: edit/delete saved bills, remove people. Error boundary, 404 page, skip link, per-page titles.
- Branch rulesets on `main` and `integration/*`, PR template, branching model in `docs/WORKING_RULES.md` 7a.

### Staged, not applied (need the owner)
- `scripts/sql/2026-10-04_v3_revoke_anon_read_at_v1_removal.sql` (+ rollback): makes the real data private. Apply when `/v1` is removed.
- `2026-09-24_revoke_anon_bill_access.sql` is safe to apply now.

## [Unreleased - earlier] - 2026-09-24

Remediation of the repository audit in [`REPO_AUDIT_2026-09-24.md`](REPO_AUDIT_2026-09-24.md).
The three SQL migrations it adds are **not applied automatically** — see
[`MIGRATIONS.md`](MIGRATIONS.md).

### Security
- **Bill PDFs and the review queue no longer depend on public anon access.** New
  `POST /api/ceb-bills/signed-url` and `GET /api/ceb-bills/ingestions?view=queue` replace the
  browser's direct storage and table reads. `2026-09-24_revoke_anon_bill_access.sql` drops the
  anon policies on the two `ceb_bill_*` tables and the `ceb_bills` bucket. Deploy the code first.
- `/api/admin/users`: `role` and `dashboardAccess` are allowlisted; an admin cannot remove their own
  admin role; the user list pages past 100; no pre-authentication logging; no upstream error text
  in responses.
- `/api/solis/explore`: stricter parameter schema (date formats, integer ranges, length cap),
  own-property endpoint lookup, and an audit line that is always written.
- Uploads are PDF-only, verified by their bytes; stored paths always end in `.pdf`.
- CORS accepts only this project's Vercel preview hosts under this team's scope, not any project
  whose name starts the same way.
- `/ready` no longer echoes database error text; auth details are no longer logged to the browser
  console; the real account number was replaced by a placeholder in tracked files.
- Removed `.npmrc`'s `frozen-lockfile=false` so Vercel installs match the lockfile CI verifies.
- `docs/SECURITY.md` added: trust boundaries, the policy matrix, a new-endpoint checklist.

### Fixed
- **`null` is no longer confused with `0` in the bill parser.** It returned `0` for any figure it
  could not find; a measured zero was rejected as a failure and a missing value accepted. The
  review queue also showed a parsed `0` as blank.
- **Bill approval is atomic** (`approve_ceb_extraction()`): `ceb_data`, the extraction and the
  ingestion are approved in one transaction. Record input is validated more strictly.
- `POST /api/ceb-bills/extract` no longer deletes the previous extraction before it has downloaded
  and parsed the file, and no longer validates against an invented Rs 37 tariff.
- Scheduled collectors, backfill scripts and the freshness check now refuse to start with an anon
  key in `SUPABASE_SERVICE_KEY` (`api/_lib/serviceKeyGuard.js`).
- One `delete` endpoint replaces `delete` and `delete-record`; rows are removed before the file and
  every result is checked.

### Removed
- ~1,700 lines of unreachable source, eight unused fetchers in `dataService.js`, five broken Clerk
  adapter methods, three dead scripts.
- Dependencies: `@chakra-ui/react`, `@emotion/react`, `@emotion/styled`, `framer-motion`,
  `crypto-js`, `@types/react`, `@types/react-dom`. Non-PDF JavaScript 1,557 KB → 1,194 KB;
  `react-vendor` 776 KB → 263 KB. `pnpm audit --prod` is now clean.
- The dashboard v2 preview and its design-direction document (PR #143). They remain in git history.
- The finished Clerk-migration scripts (`migrate-users-to-clerk.js`, `export-users.js`).
- The vendor agent-skill packs are no longer tracked (`.agents/`, `skills/` are gitignored);
  `skills-lock.json` remains.

### Security (continued)
- **`ceb_data` no longer exposes the account number or file path to the public anon key.**
  `2026-09-24_ceb_data_public_columns.sql` limits `anon` to the four columns the dashboard reads.
  The admin CEB table now loads through `GET /api/ceb-bills/records`. Deploy the code first.

### Added
- `2026-09-24_ceb_data_public_columns.sql` — the column grants above.
- Handler-level tests for `/api/ceb-bills/records`: authentication first, bad input never reaches
  the database, approval is one RPC, and the fallback works while the function is missing.
- `2026-09-24_drop_cascade_trigger.sql` — drops the redundant, undocumented live-only trigger.

### Documentation
- `SECURITY.md`, `MIGRATIONS.md`, `guides/LOCAL_DEVELOPMENT.md` added; `START_HERE`, `docs/README`,
  the CEB bill guide, the deployment checklist, `API.md` and `ARCHITECTURE.md` brought up to date.
- Fifty-odd superseded documents moved to `docs/archive/` with banners.

## [2.1.0] - 2026-09-13

Last known-good state before the UI redesign work began. The CEB bill parser handles both the
pre-2026 and the 2026 (`ebill-edl-v.1.0.2`) formats; 25 bills reconciled end to end. Details:
[`RECOVERY_STATUS_2026-09.md`](RECOVERY_STATUS_2026-09.md),
[`PROJECT_AUDIT_2026-09.md`](PROJECT_AUDIT_2026-09.md).

### Security
- Every write moved behind an admin-authenticated API endpoint; anon write policies dropped.
- Clerk verification moved to `@clerk/backend` with a replay guard; CORS is an allowlist.

### Fixed
- The five-month inverter data outage and its three stacked causes; a freshness check, a keepalive
  and a DB snapshot workflow added so a silent recurrence is not possible.
- The parser and its text extraction, and the Edge Function's retry handling.

### Added
- Liveness and readiness probes (`/healthz`, `/ready`); `ARCHITECTURE`, `API` and `RUNBOOK`.

## [Earlier 2026-07-12] — lint sweep

### Fixed
- **ErrorBanner.jsx**: fixed an invalid/conditional React hook call.
- **eslint.config.js**: added Node globals for `api/`, `functions/`, `scripts/`, eliminating ~130 false positives.
- **AdminDashboard.jsx**: fixed a broken escape sequence in the ASCII-art banner.
- Removed dead code left over from a pre-database implementation of `ingestions.js`.

## [2.0.0] - 2025-11-16

### 🎉 Major Release - Performance & Reliability Overhaul

This release represents a complete refactor of the data management system with focus on performance, reliability, and user experience.

---

## 🚀 Added Features

### Phase 1: Core Infrastructure
- **SWR (Stale-While-Revalidate) Caching**
  - Instant page loads with cached data
  - Background refresh for fresh data
  - Dual-layer cache (memory + localStorage)
  - TTL-based expiration (5m live, 15m charts, 1h yearly)
  
- **Adaptive Polling System**
  - Smart intervals: 5min (live), 15min (charts/earnings)
  - Visibility-aware: pauses when tab hidden
  - Network-aware: pauses when offline
  - Automatic resume on tab focus/reconnect

- **Centralized Data Management**
  - Single DataContext for all data types
  - Removed component-level Supabase clients
  - Consolidated API calls
  - Eliminated redundant fetches

### Phase 2: UX & Loading Experience
- **Skeleton Loaders**
  - Shimmer animation components
  - CardSkeleton, ChartSkeleton, DialSkeleton
  - Replaced blank Suspense fallbacks
  - Smooth loading transitions

- **Loading Indicators**
  - RefreshIndicator component (top-right)
  - Real-time spinner during background fetch
  - "Last updated" timestamps (Just now / 5m ago / 2h ago)
  - Stale warning when data >10 minutes old

- **Staleness Badges**
  - ⏱️ badges on cards with old data (>10 min)
  - Hover tooltips with exact timestamps
  - Visual feedback for data freshness
  - Per-card staleness tracking

### Phase 3: Billing Period Accuracy
- **Dynamic Billing Calculations**
  - Uses actual billing dates from system_settings
  - Configurable billing cycle (default 30 days)
  - Cross-month/year boundary support
  - Fallback to calendar month if settings missing

- **Chart Alignment**
  - RPC function returns period_label
  - Tooltips show exact billing windows (e.g., "Oct 05 - Nov 04")
  - Monthly generation card displays current period
  - Accurate period labels throughout dashboard

### Phase 4: Error Handling & Resilience
- **Exponential Backoff Retry Logic**
  - Automatic retry with increasing delays (30s → 1m → 5m)
  - Max 3 retries per endpoint
  - 30-minute pause after max retries
  - Reset on successful fetch

- **Error Classification System**
  - Auth errors (401/403): no retry, show modal
  - Rate limits (429): extend intervals
  - Server errors (5xx): exponential backoff
  - Transient errors (timeout/network): auto-retry
  - Client errors (400/404): log only

- **Circuit Breaker Pattern**
  - Opens after 5 consecutive failures
  - 30-minute cooldown period
  - Automatic reset when cooldown expires
  - Independent per data type

- **User Notifications**
  - ErrorBanner for prolonged outages (>5 min)
  - AuthErrorModal for authentication issues
  - Error badges on affected cards
  - Silent handling of transient errors

- **Graceful Degradation**
  - Shows stale data during outages
  - Partial degradation (one failure doesn't affect others)
  - Manual refresh always available
  - Error details on hover

### Phase 5: Bug Fixes
- **Theme Auto-change Fix**
  - Removed auto-apply on Settings page mount
  - Theme now persists correctly across navigation
  - localStorage as single source of truth
  - No implicit route-based theme switches

---

## 🔧 Improvements

### Performance
- **Bundle Size Optimization**
  - Total: 319 KB gzipped (from ~500 KB)
  - React vendor: 175 KB gzipped
  - Main vendor: 100 KB gzipped
  - Lazy loading for chart components
  - Code splitting by route

- **Load Time Improvements**
  - First load: < 3 seconds
  - Cached load: < 1 second (instant)
  - Time to Interactive: < 3 seconds
  - 60-80% faster perceived load time

### Developer Experience
- Comprehensive documentation
  - README.md with full feature list
  - TESTING_GUIDE.md with test procedures
  - IMPLEMENTATION_TRACKER.md (46/47 tasks complete)
  - DEPLOYMENT_CHECKLIST.md
  - CACHING_IMPLEMENTATION.md

- Better debugging
  - Console logs for data flow
  - Cache statistics
  - Error tracking with timestamps
  - Retry attempt logging

---

## 🐛 Bug Fixes

- Fixed circular dependency in DataContext (scheduleRetry ↔ fetchData)
- Fixed white screen on load (null safety checks in ErrorBanner/AuthErrorModal)
- Fixed theme persistence across page navigation
- Fixed Settings page auto-changing theme on mount
- Fixed stale data not showing during errors
- Fixed polling continuing when tab hidden
- Fixed cache not being checked first (SWR)

---

## 🔄 Changed

### Breaking Changes
- **Error state structure changed**
  - Old: `errors.key = "error message"`
  - New: `errors.key = { message, type, time }`
  - Enables time-based error tracking
  - Supports error classification

- **DataContext polling behavior**
  - Now respects visibility and network state
  - Circuit breakers can pause polling
  - Retry logic may delay next poll

### Non-breaking Changes
- Improved cache service API (backwards compatible)
- Enhanced useData hook with more exports (lastUpdate, isStale, refreshAll)
- Updated component props (optional new props only)

---

## 📦 Dependencies

### Updated
- React: 19.2.0
- Vite: 7.1.10
- Recharts: Latest
- Supabase JS: Latest

### Added
- None (used existing dependencies)

---

## 🔐 Security

- Environment variables properly configured
- No sensitive data in localStorage
- Rate limiting via circuit breakers
- Auth token refresh handling
- XSS protection via React

---

## 📊 Performance Metrics

### Before (v1.x)
- First load: 5-8 seconds
- Reload: 3-5 seconds (no cache)
- Blank screens: 35+ seconds on slow connection
- No error handling
- No retry logic

### After (v2.0)
- First load: < 3 seconds ✅
- Reload: < 1 second (instant cache) ✅
- No blank screens (skeleton loaders) ✅
- Automatic error recovery ✅
- Smart retry with circuit breakers ✅

---

## 🎯 Completion Status

**Implementation Progress: 98% (46/47 tasks)**

### Completed Phases
- ✅ Phase 1: Core Infrastructure (4/4 tasks)
- ✅ Phase 2: UX & Loading (9/9 tasks)
- ✅ Phase 3: Billing Period (6/6 tasks)
- ✅ Phase 4: Error Handling (16/16 tasks)
- ✅ Phase 5: Bug Fixes (5/5 tasks)

### Optional Phases (Future)
- ⏳ Phase 6: Observability (6 tasks) - 50% complete
- ⏳ Phase 7: Advanced Caching (6 tasks) - Not started

---

## 🚀 Migration Guide

### From v1.x to v2.0

1. **Update environment variables** (no changes required)

2. **Database migration** (add billing period settings):
```sql
INSERT INTO system_settings (setting_name, setting_value) 
VALUES 
  ('last_billing_date', '2025-11-05'),
  ('billing_cycle_days', '30')
ON CONFLICT (setting_name) DO UPDATE 
SET setting_value = EXCLUDED.setting_value;
```

3. **Clear browser cache** for users
   - First load will rebuild cache with new TTLs
   - All data will refresh automatically

4. **Test error handling**
   - Verify ErrorBanner and AuthErrorModal appear correctly
   - Check console for retry logs
   - Confirm circuit breaker activates after 5 failures

5. **Verify theme persistence**
   - Toggle theme
   - Navigate between pages
   - Theme should persist

---

## 📝 Notes

- All changes are backwards compatible except error state structure
- Existing components work without modification
- Cache automatically migrates to new structure
- No breaking changes to database schema

---

## 🙏 Acknowledgments

- React community for SWR pattern inspiration
- Supabase team for excellent documentation
- Users who reported the theme persistence bug
- QA team for comprehensive testing

---

**Full Changelog:** [GitHub Releases](https://github.com/your-repo/releases)  
**Upgrade Guide:** See README.md for detailed instructions  
**Support:** Contact development team or open an issue

---

## 📋 Document History

**Maintainer:** Anuja Jayasinghe  

### Change Log
- **Created:** November 16, 2025 - Initial v2.0.0 changelog documentation
- **Updated:** November 19, 2025 - Added maintainer log, verified all entries accurate

**Last Updated:** November 19, 2025
