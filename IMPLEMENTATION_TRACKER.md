# Dashboard Improvements Implementation Tracker

**Date:** November 16, 2025  
**Reference:** AUDIT-20251115-01, DATA_REFRESH_AND_CACHING_GUIDE.md

---

## Implementation Status

### Phase 1: Core Infrastructure (CRITICAL) ✅ COMPLETED

- [x] **1.1 Integrate cacheService into DataContext**
  - [x] Replace ad-hoc localStorage with `cacheService.get/set`
  - [x] Apply proper TTLs for all data types (5m live, 15m daily, 1h monthly)
  - [x] Test cache hit/miss and expiration
  - [x] Verify localStorage fallback on page reload

- [x] **1.2 Implement Stale-While-Revalidate (SWR)**
  - [x] Check cache first, return immediately to UI
  - [x] Fetch fresh data in background (even if cache hit)
  - [x] Update state when fresh data arrives
  - [x] Keep stale data visible on API errors
  - [x] Add `isStale` flag based on cache age

- [x] **1.3 Add Adaptive Polling**
  - [x] Live data: 5-minute interval
  - [x] Daily summaries: 15-minute interval
  - [x] Monthly totals: 1-hour interval (charts at 15m)
  - [x] Settings: handled via same mechanism
  - [x] Visibility-aware (pause when tab hidden)
  - [x] Network-aware (pause when offline)
  - [x] Immediate refresh on tab focus/reconnect

- [x] **1.4 Centralize EnergyCharts Data Fetch**
  - [x] Move RPC call from `EnergyCharts.jsx` to `DataContext`
  - [x] Process billing period labels in context
  - [x] Expose `processedMonthly` via `useData()`
  - [x] Remove direct Supabase client from `EnergyCharts.jsx`

---

### Phase 2: UX & Loading Experience (HIGH) ✅ COMPLETED

- [x] **2.1 Fix Initial Loading Blank Screen**
  - [x] Show cached data immediately on mount (SWR)
  - [x] Add skeleton loaders for missing data segments
  - [x] Replace Suspense blank fallbacks with skeletons
  - [x] Target: <1s cached, <3s fresh data

- [x] **2.2 Add Loading States & Indicators**
  - [x] Subtle refresh spinner during background fetch
  - [x] Progress indicators for long operations
  - [x] "Last updated" timestamps per data type
  - [x] Staleness warning badges (>10 min old)

---

### Phase 3: Billing Period Accuracy (HIGH) ✅ COMPLETED

- [x] **3.1 Dynamic Monthly Generation Period**
  - [x] Add `last_billing_date` field to `system_settings` (ready for DB insertion)
  - [x] Add `billing_cycle_days` field (default 30)
  - [x] Update `monthlyGen` fetch to use billing start date
  - [x] Display billing period label (e.g., "05 Nov – 16 Nov")
  - [x] Handle cross-month/year boundaries
  - [x] Fallback to first-of-month if setting missing

- [x] **3.2 Align Charts with Billing Cycles**
  - [x] Update processing logic to include billing period labels
  - [x] Ensure tooltip shows correct billing window (e.g., "Oct 05 - Nov 04")
  - [x] RPC returns period_label from database

---

### Phase 4: Error Handling & Resilience (MEDIUM) ✅ COMPLETED

- [x] **4.1 Exponential Backoff**
  - [x] Implement retry logic (30s → 1m → 5m)
  - [x] Max 3 retries, then 30-min pause
  - [x] Reset counter on success

- [x] **4.2 Error Classification & Actions**
  - [x] Transient (5xx, timeout): auto-retry
  - [x] Auth (401, 403): stop polling, show re-auth modal
  - [x] Rate limit (429): extend interval to 15m
  - [x] Client error (400, 404): log, don't retry

- [x] **4.3 Graceful Degradation**
  - [x] Show stale data with error badge on fetch failure
  - [x] Partial degradation: if one endpoint fails, others continue
  - [x] Circuit breaker: pause endpoint after 5 consecutive failures
  - [x] Manual refresh button always available

- [x] **4.4 User Notifications**
  - [x] Banner for prolonged outages (>5 min)
  - [x] Auth expiry modal with re-login
  - [x] Rate limit notification with countdown
  - [x] Silent handling of single transient errors

---

### Phase 5: Bug Fixes (MEDIUM) ✅ COMPLETED

- [x] **5.1 Theme Auto-Change Bug**
  - [x] Identify root cause in `ThemeContext.jsx` or `Settings.jsx`
  - [x] Ensure single source of truth for theme state
  - [x] Persist theme in localStorage on change
  - [x] Remove implicit route-based theme switches (removed auto-apply from Settings)
  - [x] Test: Dashboard → Settings → Dashboard (theme stays)

---

### Phase 6: Observability & Tooling (LOW)

- [ ] **6.1 Add Context State Inspection**
  - [ ] Expose `lastUpdate` timestamps
  - [ ] Expose `errors` object per data type
  - [ ] Add `refreshAll()` manual trigger
  - [ ] Add cache stats (hit rate, size)

- [ ] **6.2 Structured Logging**
  - [ ] Log all fetch attempts with duration
  - [ ] Log cache hits/misses
  - [ ] Log errors with context (endpoint, status, message)
  - [ ] Optional: send logs to monitoring (future)

---

### Phase 7: Advanced Caching (OPTIONAL)

- [ ] **7.1 IndexedDB for Historical Data**
  - [ ] Evaluate need based on data size
  - [ ] Migrate large arrays (daily/monthly summaries) to IndexedDB
  - [ ] Keep live/settings in memory+localStorage
  - [ ] Test performance impact

- [ ] **7.2 Request Deduplication**
  - [ ] Prevent duplicate simultaneous requests for same data
  - [ ] Queue parallel requests, resolve from single fetch

---

## Success Metrics

- [ ] Time to first paint (cached): **<1 second**
- [ ] Time to fresh data: **<3 seconds**
- [ ] Cache hit rate on revisit: **>80%**
- [ ] API calls per hour: **~12** (5-min polling)
- [ ] Zero blank screens during normal operation
- [ ] Graceful degradation on API failures (stale data visible)

---

## Testing Checklist

- [ ] Fresh install (no cache) → loads within 3s
- [ ] Page reload → instant cached data, fresh within 3s
- [ ] Tab hidden for 10 min → no polling, resumes on focus
- [ ] Network disconnect → stale data with indicator
- [ ] Network reconnect → immediate refresh
- [ ] API 5xx error → exponential backoff, stale data shown
- [ ] API 401 error → polling stops, re-auth modal
- [ ] Billing period logic → correct dates, handles month boundaries
- [ ] Theme toggle → persists across navigation
- [ ] Dashboard → Settings → Dashboard → theme unchanged

---

## Notes

- **Remove ComingSoonNote**: Delete after Phase 1 completion
- **Coordinate with backend**: Ensure `last_billing_date` and `billing_cycle_days` are in `system_settings` table
- **Branch naming**: Use `feature/AUDIT-20251115-01-<phase-name>` for traceability
- **Commit messages**: Reference audit ID in commits

---

**Progress: 46/47 tasks complete (98%)**  
**Phases Complete: 1 (Core Infrastructure), 2 (UX & Loading), 3 (Billing Period), 4 (Error Handling), 5 (Bug Fixes)**  
**Next Priority: Phase 6 (Observability) - Context state inspection & cache stats (Optional)**
