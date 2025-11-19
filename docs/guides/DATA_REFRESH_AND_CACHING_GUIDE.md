# Solar Analytics Dashboard - Data Refresh and Caching Guide

**Version:** 1.1  
**Date:** November 19, 2025  
**Audit Reference:** AUDIT-20251115-01  
**Status:** Implementation Specification  
**Maintainer:** Anuja Jayasinghe

---

## Table of Contents

1. [Overview](#1-overview)
2. [Polling Strategy](#2-polling-strategy)
3. [Cache Configuration](#3-cache-configuration)
4. [Stale-While-Revalidate (SWR)](#4-stale-while-revalidate-swr)
5. [Error Handling & Backoff](#5-error-handling--backoff)
6. [Implementation Roadmap](#6-implementation-roadmap)
7. [API Reference](#7-api-reference)
8. [Migration Notes](#8-migration-notes)

---

## 1. Overview

### 1.1 Purpose

This guide defines the **authoritative data refresh and caching strategy** for the Solar Analytics Dashboard, ensuring:

- **Fresh data:** Live power updates every 5 minutes; summaries refresh on schedule
- **Efficient API usage:** Polling aligns with Solis Cloud's 5-minute update cadence
- **Resilient UX:** Stale-while-revalidate (SWR) shows cached data instantly while fetching fresh
- **Rate limit compliance:** ~288 requests/day (5-min polling) fits well within 100-200/day typical limits

### 1.2 Data Sources

| Source | Type | Refresh Cadence | Notes |
|--------|------|----------------|-------|
| **Solis Cloud API** | Live inverter telemetry | ~5 minutes | Via serverless function `solis-live-data` |
| **Supabase RPC** | Monthly comparison charts | On-demand | `get_monthly_comparison()` |
| **Supabase Tables** | Daily/monthly summaries, CEB tariffs | Static/slow-changing | Backfilled by scheduled jobs |
| **System Settings** | Daily target, preferences | Rarely changes | 30-minute cache |

### 1.3 Key Principles

1. **Poll only when data actually changes** — Solis Cloud updates every ~5 min; faster polling wastes quota
2. **Show stale data immediately** — never blank screen; fetch fresh in background
3. **Fail gracefully** — if API fails, keep showing last known good data with staleness indicator
4. **Respect rate limits** — exponential backoff on errors; visibility-aware refresh (pause when tab hidden)

---

## 2. Polling Strategy

### 2.1 Authoritative Polling Intervals

Based on Solis Cloud API behavior (see `AUDIT-20251115-01`, Section 0.2):

| Data Type | Polling Interval | Rationale |
|-----------|-----------------|-----------|
| **Live Power** | 5 minutes | Aligns with Solis Cloud refresh cadence; faster = duplicate data |
| **Daily Summary** | 15 minutes | Changes infrequently; overnight backfill reconciles |
| **Monthly Totals** | 1 hour | Static after month-end; mid-month updates are rare |
| **Yearly Totals** | 24 hours | Near-static; annual summary changes once daily at most |
| **System Settings** | 30 minutes | User-configurable; low change frequency |
| **CEB Tariffs** | 24 hours | External data; updated quarterly by utility provider |

### 2.2 Adaptive Polling

**Visibility-Aware Refresh:**
- **Active tab:** Poll on schedule (e.g., every 5 min for live data)
- **Hidden tab:** Pause polling; resume on tab focus with immediate refresh
- **Implementation:** Use `document.visibilityState` and `visibilitychange` event

**Network-Aware Refresh:**
- **Online:** Normal polling
- **Offline:** Pause polling; show staleness indicator; resume on reconnect with immediate refresh
- **Implementation:** Use `navigator.onLine` and `online`/`offline` events

**Code Snippet (Visibility-Aware):**
```javascript
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      // Tab became visible → refresh immediately
      fetchLiveData();
    }
    // If hidden, interval will naturally skip (handled by interval guard)
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, []);
```

### 2.3 Implementation in DataContext

**Current State:**
- `DataContext.jsx` fetches data **once on mount** (no polling)
- localStorage cache (5 min TTL) for live data only

**Target State:**
- `DataContext.jsx` uses `setInterval` for each data type with its own cadence
- All data types cached via `cacheService.js` (unified layer)
- Visibility-aware and network-aware polling
- SWR: show cached data immediately, fetch fresh in background

**Pseudo-code:**
```javascript
// In DataContext.jsx
useEffect(() => {
  // Immediately show cached data (SWR)
  const cached = cacheService.get('live');
  if (cached) setLiveData(cached);

  // Fetch fresh data in background
  fetchLiveData();

  // Set up polling interval (5 minutes)
  const interval = setInterval(() => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      fetchLiveData();
    }
  }, 5 * 60 * 1000);

  return () => clearInterval(interval);
}, []);
```

---

## 3. Cache Configuration

### 3.1 Cache TTLs (Time-To-Live)

**Source:** Migrated from `CACHING_IMPLEMENTATION.md` and aligned with Solis API cadence

| Cache Bucket | TTL | Justification |
|--------------|-----|---------------|
| `live` | 5 minutes | Matches Solis Cloud refresh rate |
| `daily` | 15 minutes | Daily summaries stable; overnight backfill reconciles |
| `monthly` | 60 minutes | Monthly totals rarely change mid-month |
| `yearly` | 24 hours | Yearly totals near-static |
| `settings` | 30 minutes | User settings low-frequency updates |
| `cebTariffs` | 24 hours | External utility data; quarterly updates |

### 3.2 Cache Storage Strategy

**Dual-layer cache** (already implemented in `src/lib/cacheService.js`):

1. **In-memory cache (primary):**
   - Fast access (no serialization)
   - Cleared on page reload
   - Handles most reads during session

2. **localStorage (fallback):**
   - Survives page reloads
   - Used for "stale-while-revalidate" on first mount
   - Auto-cleanup of expired entries every 5 minutes

**Code Reference:**
```javascript
// src/lib/cacheService.js (existing)
const TTL = {
  live: 5 * 60 * 1000,        // 5 minutes
  daily: 15 * 60 * 1000,      // 15 minutes
  monthly: 60 * 60 * 1000,    // 1 hour
  yearly: 24 * 60 * 60 * 1000, // 24 hours
  settings: 30 * 60 * 1000,   // 30 minutes
};
```

### 3.3 Cache Invalidation

**Automatic:**
- TTL expiration (checked on read)
- Periodic cleanup (every 5 min via `setInterval` in `cacheService.js`)

**Manual (user-triggered):**
- "Refresh" button → invalidate all caches and fetch fresh
- Settings change → invalidate `settings` bucket only
- Admin data upload → invalidate `daily`/`monthly`/`cebTariffs` as applicable

**Implementation:**
```javascript
// Manual invalidation
cacheService.clear('live'); // Single bucket
cacheService.clearAll();    // All buckets
```

---

## 4. Stale-While-Revalidate (SWR)

### 4.1 Concept

**SWR Flow:**
1. **Request data:** Check cache first
2. **If cached (even if stale):** Return immediately to UI
3. **In parallel:** Fetch fresh data from API
4. **On success:** Update cache and UI
5. **On failure:** Keep showing stale data; set error flag

**Benefits:**
- **Zero blank screens:** UI always shows *something*
- **Perceived performance:** Instant load from cache
- **Resilience:** Graceful degradation on API failures

### 4.2 Implementation Pattern

**Before (no SWR):**
```javascript
const fetchData = async () => {
  setLoading(true);
  try {
    const data = await apiCall();
    setState(data);
  } finally {
    setLoading(false);
  }
};
```

**After (with SWR):**
```javascript
const fetchData = async () => {
  // 1. Try cache first (instant)
  const cached = cacheService.get('live');
  if (cached) {
    setState(cached);
    setLoading(false); // UI shows cached data immediately
  } else {
    setLoading(true);  // Only show loading if no cache
  }

  // 2. Fetch fresh in background
  try {
    const fresh = await apiCall();
    cacheService.set('live', fresh, TTL.live);
    setState(fresh);
    setError(null);
  } catch (err) {
    console.error('Fetch failed, using stale cache:', err);
    setError(err);
    // Keep showing cached data; don't clear state
  } finally {
    setLoading(false);
  }
};
```

### 4.3 Staleness Indicators

**Visual Feedback:**
- Show a small badge/icon if data is >10 minutes old
- Color-code status indicator: green (fresh), yellow (stale <10m), red (stale >10m or error)

**Example:**
```jsx
{isStale && (
  <span className="staleness-badge" title={`Last updated ${lastUpdate}`}>
    ⚠️ Stale data
  </span>
)}
```

---

## 5. Error Handling & Backoff

### 5.1 Error Categories

| Error Type | HTTP Code | Action |
|------------|-----------|--------|
| **Transient** | 5xx, timeout, network | Retry with exponential backoff |
| **Authentication** | 401, 403 | Stop polling; log error; notify user to re-auth |
| **Rate Limit** | 429 | Back off for 5+ minutes; reduce polling frequency |
| **Client Error** | 400, 404 | Log error; don't retry (likely config issue) |

### 5.2 Exponential Backoff

**Strategy:**
- Initial retry: 30 seconds
- Second retry: 1 minute
- Third retry: 5 minutes
- Max retries: 3 (then pause polling for 30 min)

**Implementation:**
```javascript
const backoffDelays = [30000, 60000, 300000]; // 30s, 1m, 5m
let retryCount = 0;

const fetchWithBackoff = async () => {
  try {
    const data = await apiCall();
    retryCount = 0; // Reset on success
    return data;
  } catch (err) {
    if (isTransientError(err) && retryCount < backoffDelays.length) {
      const delay = backoffDelays[retryCount];
      console.warn(`Retrying in ${delay/1000}s (attempt ${retryCount+1})`);
      retryCount++;
      setTimeout(fetchWithBackoff, delay);
    } else {
      console.error('Max retries reached or non-retriable error:', err);
      // Pause polling for 30 min
      setTimeout(() => { retryCount = 0; fetchWithBackoff(); }, 30 * 60 * 1000);
    }
  }
};
```

### 5.3 User Notifications

**When to notify:**
- **API down for >5 minutes:** Show banner "Unable to fetch live data. Showing last known values."
- **Authentication failed:** Modal "Session expired. Please log in again."
- **Rate limit hit:** Notification "API rate limit reached. Data will refresh in 10 minutes."

**Do NOT notify:**
- Single transient errors (handled silently by retry logic)
- Stale cache usage (just show staleness indicator)

---

## 6. Implementation Roadmap

### 6.1 Phase 1: Integrate cacheService into DataContext (Priority: HIGH)

**Tasks:**
1. Replace `localStorage` ad-hoc cache in `DataContext.jsx` with `cacheService.get/set` for all data types
2. Remove hardcoded `300000` TTL; use `TTL.live`, `TTL.daily`, etc. from `cacheService.js`
3. Test cache hit/miss scenarios and expiration

**Acceptance Criteria:**
- All data types (`live`, `charts`, `totalEarnings`, `monthlyGen`) use `cacheService`
- TTLs match this guide (5m, 15m, 1h)
- Cache survives page reload (localStorage fallback)

### 6.2 Phase 2: Implement SWR Pattern (Priority: HIGH)

**Tasks:**
1. Modify `fetchData()` in `DataContext` to check cache first and return immediately
2. Always fetch fresh data in background (even if cache hit)
3. Update state with fresh data when available; keep stale on error
4. Add `isStale` flag to context (based on cache age)

**Acceptance Criteria:**
- Dashboard shows cached data instantly on mount (no blank screen)
- Fresh data replaces cached after ~2-3s (API roundtrip)
- On API failure, stale data remains visible with error indicator

### 6.3 Phase 3: Add Adaptive Polling (Priority: MEDIUM)

**Tasks:**
1. Implement `setInterval` for each data type in `DataContext`
2. Add visibility-aware polling (pause on tab hidden)
3. Add network-aware polling (pause when offline)
4. Immediate refresh on tab focus or reconnect

**Acceptance Criteria:**
- Live data polls every 5 minutes (when tab visible and online)
- Daily data polls every 15 minutes
- No polling when tab hidden or offline
- Immediate refresh on returning to tab

### 6.4 Phase 4: Error Handling & Backoff (Priority: MEDIUM)

**Tasks:**
1. Implement exponential backoff for transient errors
2. Stop polling on auth errors (show modal)
3. Add user-facing error notifications for prolonged failures
4. Log all errors to console with context (endpoint, payload, response)

**Acceptance Criteria:**
- Transient errors auto-retry (3 attempts with 30s/1m/5m delays)
- Auth errors stop polling and show login modal
- Rate limit errors pause polling for 5+ minutes
- All errors logged with timestamp and context

### 6.5 Phase 5: Consolidate Component Fetches (Priority: LOW)

**Tasks:**
1. Remove direct Supabase client usage from `EnergyCharts.jsx`
2. Move all data fetching to `DataContext`
3. Components consume data via `useData()` hook only

**Acceptance Criteria:**
- Zero direct Supabase imports in component files
- All data flows through `DataContext`
- Single source of truth for caching and polling

---

## 7. API Reference

### 7.1 cacheService.js

**Current API:**
```javascript
import cacheService from './lib/cacheService';

// Get cached data (returns null if expired or missing)
const data = cacheService.get('live');

// Set data with TTL
cacheService.set('live', { power: 25.3 }, TTL.live);

// Clear specific bucket
cacheService.clear('live');

// Clear all caches
cacheService.clearAll();
```

### 7.2 DataContext Exports

**Current:**
```javascript
const {
  livePowerData,        // { currentPower, status }
  chartsData,           // Monthly comparison
  totalEarnings,        // CEB earnings total
  monthlyGeneration,    // This month's kWh
  inverterPotentialValue, // { total } potential earnings
  loading,              // { live, charts, totalEarnings, monthlyGen }
} = useData();
```

**Proposed additions:**
```javascript
const {
  // ... existing
  isStale,              // Boolean: true if any data >10 min old
  lastUpdate,           // Timestamp of most recent fetch
  errors,               // { live, charts, ... } error objects
  refreshAll,           // Manual refresh function
} = useData();
```

### 7.3 Manual Refresh

**User-triggered refresh (button):**
```javascript
const { refreshAll } = useData();

<button onClick={refreshAll}>
  🔄 Refresh
</button>
```

**Implementation in DataContext:**
```javascript
const refreshAll = useCallback(() => {
  cacheService.clearAll();
  fetchData('live', 'charts', 'totalEarnings', 'monthlyGen');
}, []);
```

---

## 8. Migration Notes

### 8.1 From CACHING_IMPLEMENTATION.md

**Migrated items:**
- ✅ TTL values (5m, 15m, 1h, 24h, 30m)
- ✅ SWR concept and implementation pattern
- ✅ Background refresh idea (adapted to polling)
- ✅ Dual-layer cache (memory + localStorage)

**Superseded items:**
- ❌ "Background refresh at 80% TTL" → Replaced by **polling intervals** (simpler, more predictable)
- ❌ Manual cache preloading → Not needed with SWR (cache populated on first fetch)

**Action:** Archive `CACHING_IMPLEMENTATION.md` after this guide is implemented to avoid conflicting documentation.

### 8.2 Breaking Changes

**None.** This guide describes **additive changes** only:
- Existing `cacheService.js` API unchanged
- `DataContext` exports remain backward-compatible
- New fields (`isStale`, `errors`) are optional for consumers

### 8.3 Testing Strategy

**Unit tests:**
- Cache TTL expiration logic
- SWR flow (cache hit → return immediate → fetch background)
- Exponential backoff retry logic

**Integration tests:**
- Full DataContext mount → cache hit → interval poll → cache refresh
- Tab visibility change → pause/resume polling
- Offline → online → immediate refresh

**Manual testing:**
- Open dashboard → observe instant load from cache
- Wait 5 min → observe automatic refresh
- Switch tabs → verify polling pauses
- Disconnect network → verify stale data shown with indicator

---

## 9. Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Time to first paint (cached)** | <500ms | Dashboard shows cached data |
| **Time to fresh data** | <3s | API roundtrip + render |
| **API calls per hour** | ~12 (5-min poll) | Logs/monitoring |
| **Cache hit rate** | >80% | On page revisit within TTL |
| **Stale data visibility** | <5s | After network recovery |

---

## 10. Glossary

- **TTL (Time-To-Live):** Duration a cache entry is valid before expiring
- **SWR (Stale-While-Revalidate):** Pattern of showing cached data immediately while fetching fresh in background
- **Polling:** Repeatedly fetching data at fixed intervals
- **Backoff:** Increasing delay between retry attempts after errors
- **Visibility-aware:** Pausing/resuming based on browser tab visibility
- **Transient error:** Temporary failure (timeout, 5xx) that may resolve on retry

---

## 11. References

- **Audit Report:** `DATA_FETCHING_AUDIT_REPORT.md` (AUDIT-20251115-01)
- **Solis Datasheet:** `Solis_datasheet_S5-GC(25-40)K_GBR_V1,5_202507.pdf`
- **Extracted Text:** `docs/solis_pdf_text.txt`
- **Legacy Cache Doc:** `CACHING_IMPLEMENTATION.md` (to be archived)
- **Code:**
  - `src/contexts/DataContext.jsx`
  - `src/lib/cacheService.js`
  - `src/lib/dataService.js`

---

## 📋 Document History

**Maintainer:** Anuja Jayasinghe  

### Change Log
- **Created:** November 15, 2025 - Initial data refresh and caching implementation specification (AUDIT-20251115-01)
- **Updated:** November 19, 2025 - Updated version to 1.1, added maintainer info to header, added maintainer log

**Last Updated:** November 19, 2025

---

**End of Guide**
