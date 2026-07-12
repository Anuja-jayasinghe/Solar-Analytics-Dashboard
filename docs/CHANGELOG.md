# Changelog

All notable changes to the Solar Analytics Dashboard project.

## [Unreleased] - 2026-07-12

### Fixed
- **ErrorBanner.jsx**: fixed an invalid/conditional React hook call — `useToast()`/`useEffect()` were being called inside a plain helper function (`getErrorTitle`) invoked during render inside a `.map()`, which would throw when a rate-limit error was shown. Moved the toast side-effect into the component's top-level `useEffect`.
- **eslint.config.js**: added Node globals for `api/`, `functions/`, `scripts/`, `vite.config.js`, and `src/lib/solisAuth.js`, eliminating ~130 false-positive `no-undef` errors for `process`/`Buffer`. Added `argsIgnorePattern`/`caughtErrorsIgnorePattern` (`^_`) so intentionally-unused params can be marked explicitly.
- **AdminDashboard.jsx**: fixed a broken escape sequence (`\_` → `\\_`) in the CONTROL.CENTER ASCII-art banner that was silently dropping a backslash from the rendered art.
- Removed dead code: unused storage-listing helpers in `api/ceb-bills/ingestions.js` (leftover from a pre-DB-query implementation), unused imports/vars/dead style objects across `RefreshIndicator.jsx`, `Sidebar.jsx`, `MonthlyGenerationCard.jsx`, and several admin components, an empty silent `catch {}` in `cacheService.js` (now documented as intentional).

Full write-up: [docs/development/LOCAL_LOGIN_DEBUG_LOG.md](development/LOCAL_LOGIN_DEBUG_LOG.md)

### In progress
- Diagnosing local dev login failure: `.env.local` has a Clerk **production** (`pk_live_`) publishable key, which Clerk refuses to initialize outside its configured production domain — breaks the login page under both `npm run dev` and `npx vercel dev` on localhost. Fix path chosen: ngrok tunnel (per `docs/LOCAL_CLERK_DEVELOPMENT.md` Option 1). ngrok installed via winget; **blocked on user providing an ngrok auth token** to continue setup.

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
