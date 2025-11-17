# Testing Guide - Solar Analytics Dashboard

**Date:** November 16, 2025  
**Version:** Post Phase 4 Implementation  
**Test Environment:** Development (localhost:5174)

---

## 🎯 Testing Objectives

Verify all Phase 1-4 implementations work correctly:
- ✅ SWR caching with instant loads
- ✅ Adaptive polling (5m/15m intervals)
- ✅ Error handling with retry logic
- ✅ Circuit breakers and graceful degradation
- ✅ Billing period accuracy
- ✅ Theme persistence
- ✅ User notifications (banners, modals)

---

## 📋 Test Checklist

### 1. Component Rendering ✓

**Steps:**
1. Navigate to `/` (Dashboard)
2. Check all cards render: Monthly Gen, Total Gen, Total Earnings, Live Power
3. Verify charts load: Energy Charts, Earnings Breakdown, Environmental Impact
4. Check skeleton loaders appear briefly on first load
5. Verify RefreshIndicator shows in top-right corner

**Expected Results:**
- No white screens or blank sections
- Skeleton loaders → Real data transition smooth
- All components styled correctly (dark/light theme)
- No console errors

**Status:** ⏳ Testing...

---

### 2. SWR Caching Behavior

**Test 2.1: Cache Hit on Reload**
1. Load dashboard fully (wait for all data)
2. Hard refresh page (Ctrl + F5)
3. Observe loading behavior

**Expected:**
- Data appears **instantly** from cache
- No blank screens or skeletons
- Background refresh happens silently
- "Last updated" shows previous timestamp → updates after fetch

**Test 2.2: Cache Miss (First Load)**
1. Clear browser cache (DevTools → Application → Clear storage)
2. Load dashboard
3. Observe loading sequence

**Expected:**
- Skeleton loaders appear immediately
- Cards populate as data arrives (live → charts → earnings)
- RefreshIndicator shows spinner during fetch
- Total load time < 3 seconds

**Test 2.3: Stale Data Warning**
1. Wait 10+ minutes without interaction
2. Check card headers for ⏱️ badges
3. Verify RefreshIndicator shows "⚠️ Data may be stale"

**Expected:**
- Stale badges appear on cards with >10 min old data
- RefreshIndicator shows age (e.g., "12m ago")
- Background refresh should happen automatically

---

### 3. Polling Intervals

**Test 3.1: Active Polling**
1. Open browser console
2. Watch for `[DataContext] Polling <key>` logs
3. Verify intervals:
   - Live: every 5 minutes
   - Charts: every 15 minutes
   - TotalEarnings: every 15 minutes
   - MonthlyGen: every 15 minutes

**Test 3.2: Tab Hidden Behavior**
1. Switch to another browser tab
2. Wait 5+ minutes
3. Check console - polling should pause
4. Switch back to dashboard tab
5. Verify immediate refresh triggers

**Expected:**
- No polling logs when tab hidden
- Log: `[DataContext] Tab visible, refreshing data` on focus
- Data refreshes immediately when tab regains focus

**Test 3.3: Network Offline**
1. Open DevTools → Network tab
2. Set to "Offline" mode
3. Wait for polling interval
4. Set back to "Online"

**Expected:**
- No API calls while offline
- Stale data remains visible
- Log: `[DataContext] Network online, refreshing data`
- Immediate refresh on reconnect

---

### 4. Error Handling Scenarios

**Test 4.1: Simulate Network Error**

**Setup:**
1. DevTools → Network → Throttling → "Offline"
2. Click refresh button on a card
3. Observe behavior

**Expected:**
- Error classified as 'transient'
- Retry scheduled (30s → 1m → 5m)
- Console logs retry attempts
- Cached data remains visible
- ⚠️ error badge appears on card

**Test 4.2: Simulate Server Error (5xx)**

**Setup:**
```javascript
// In DevTools Console, override fetch temporarily:
const originalFetch = window.fetch;
window.fetch = function(...args) {
  if (args[0].includes('solis-live-data')) {
    return Promise.resolve({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ message: 'Service Unavailable' })
    });
  }
  return originalFetch.apply(this, args);
};
```

**Expected:**
- Error classified as 'server'
- Exponential backoff triggered (30s, 1m, 5m)
- Circuit breaker opens after 5 consecutive failures
- ErrorBanner appears after 5 minutes
- Polling pauses for 30 minutes after circuit opens

**Test 4.3: Simulate Auth Error (401)**

**Setup:**
```javascript
// DevTools Console:
window.fetch = function(...args) {
  return Promise.resolve({
    ok: false,
    status: 401,
    json: () => Promise.resolve({ message: 'Unauthorized' })
  });
};
```

**Expected:**
- Error classified as 'auth'
- No retry scheduled (shouldRetry: false)
- AuthErrorModal appears with "Authentication Required"
- Modal shows "Reload Page" button
- Polling stops for that endpoint

**Test 4.4: Circuit Breaker**

**Steps:**
1. Force 5 consecutive failures (use server error simulation)
2. Check console for circuit breaker logs
3. Verify polling pauses
4. Wait 30 minutes (or modify code to 1 min for testing)
5. Verify circuit resets and polling resumes

**Expected:**
- Log: `Circuit breaker opened for <key> after 5 consecutive failures`
- Log: `Circuit breaker open for <key>, skipping poll`
- After cooldown: `Circuit breaker reset for <key>`

---

### 5. Billing Period Calculations

**Pre-requisite: Database Setup**

Run these SQL commands in Supabase:

```sql
-- Insert billing period settings
INSERT INTO system_settings (setting_name, setting_value) 
VALUES ('last_billing_date', '2025-11-05') 
ON CONFLICT (setting_name) DO UPDATE SET setting_value = '2025-11-05';

INSERT INTO system_settings (setting_name, setting_value) 
VALUES ('billing_cycle_days', '30') 
ON CONFLICT (setting_name) DO UPDATE SET setting_value = '30';
```

**Test 5.1: Monthly Generation Card**
1. Check MonthlyGenerationCard title
2. Verify shows "05 Nov – 16 Nov" (or current period)
3. Confirm matches billing cycle

**Test 5.2: Chart Tooltips**
1. Hover over bars in Energy Charts
2. Check tooltip shows "Period: Oct 05 - Nov 04" format
3. Verify periods align with billing dates

**Test 5.3: Month Boundary**

Change `last_billing_date` to cross months:
```sql
UPDATE system_settings SET setting_value = '2025-10-25' 
WHERE setting_name = 'last_billing_date';
```

**Expected:**
- MonthlyGen shows "25 Oct – 16 Nov"
- Chart handles cross-month correctly
- No calculation errors in console

**Test 5.4: Fallback (No Settings)**
```sql
DELETE FROM system_settings WHERE setting_name IN ('last_billing_date', 'billing_cycle_days');
```

**Expected:**
- Falls back to calendar month
- MonthlyGen shows "November 2025"
- No errors, graceful degradation

---

### 6. Theme Persistence

**Test 6.1: Toggle Theme**
1. Click theme toggle in Settings
2. Switch Light → Dark
3. Navigate to Dashboard
4. Verify theme persists
5. Refresh page
6. Verify theme still applied

**Test 6.2: Settings Page Bug Fix**
1. Set theme to Light
2. Navigate to Settings page
3. Verify theme doesn't auto-switch to DB value
4. Navigate back to Dashboard
5. Confirm Light theme maintained

**Test 6.3: LocalStorage Persistence**
1. Open DevTools → Application → Local Storage
2. Check for theme key
3. Toggle theme, verify localStorage updates
4. Manually change localStorage value
5. Refresh page, verify UI matches

---

### 7. Performance Audit

**Test 7.1: Lighthouse Audit**

**Steps:**
1. Open DevTools → Lighthouse
2. Select "Performance" category
3. Run audit
4. Check scores

**Targets:**
- Performance: > 85
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3s
- Cumulative Layout Shift: < 0.1

**Test 7.2: Bundle Size**

Check build output:
```bash
npm run build
```

**Targets:**
- Main JS bundle: < 500KB gzipped
- Lazy-loaded chunks: < 100KB each
- Total size: < 1MB

**Test 7.3: Memory Leaks**

**Steps:**
1. Open DevTools → Performance
2. Click "Record"
3. Navigate between pages 10+ times
4. Stop recording
5. Check memory graph for leaks

**Expected:**
- Memory usage stabilizes
- No continuous upward trend
- Garbage collection working

**Test 7.4: Slow Network (3G)**

**Steps:**
1. DevTools → Network → "Slow 3G"
2. Hard refresh
3. Measure load time

**Expected:**
- Cached data appears instantly
- Fresh data loads within 10s
- No timeout errors
- Skeleton loaders show progress

---

### 8. Error Messages & User Feedback

**Test 8.1: ErrorBanner Visibility**
1. Simulate prolonged outage (>5 min)
2. Check for banner below navbar
3. Verify shows error icon, duration, message

**Test 8.2: AuthErrorModal**
1. Trigger 401 error
2. Verify modal overlay appears
3. Click "Reload Page" → page refreshes
4. Click "Dismiss" → modal closes

**Test 8.3: Card Error Badges**
1. Cause individual endpoint failure
2. Check ⚠️ badge on affected card only
3. Hover over badge → tooltip shows error details
4. Click badge → triggers manual refresh

**Test 8.4: RefreshIndicator**
1. Trigger background refresh
2. Verify spinner appears in top-right
3. Check "Last updated" shows correct time
4. Verify "Just now" → "1m ago" → "5m ago" format

---

## 🐛 Known Issues & Workarounds

### Issue 1: Circular Dependency (FIXED)
- **Problem:** `scheduleRetry` and `fetchData` circular dependency
- **Fix:** Used `fetchDataRef.current` in setTimeout
- **Status:** ✅ Resolved

### Issue 2: White Screen on Load (FIXED)
- **Problem:** ErrorBanner/AuthErrorModal caused crashes
- **Fix:** Added null safety checks for `errors` object
- **Status:** ✅ Resolved

---

## 📊 Test Results Summary

| Test Category | Status | Pass/Fail | Notes |
|---------------|--------|-----------|-------|
| Component Rendering | ⏳ | - | In progress |
| SWR Caching | ⏳ | - | In progress |
| Polling Intervals | ⏳ | - | In progress |
| Error Handling | ⏳ | - | In progress |
| Billing Periods | ⏳ | - | Requires DB setup |
| Theme Persistence | ⏳ | - | In progress |
| Performance | ⏳ | - | In progress |
| User Notifications | ⏳ | - | In progress |

---

## 🚀 Next Steps After Testing

1. **Fix Critical Issues** - Address any test failures
2. **Update README** - Document new features
3. **Deploy to Staging** - Test in production-like environment
4. **Database Migration** - Add billing period settings
5. **Monitor Errors** - Set up error tracking (Sentry/LogRocket)
6. **User Acceptance Testing** - Get feedback from stakeholders

---

## 📝 Testing Notes

*Add notes here as you test:*

- [ ] All components render correctly
- [ ] Cache works as expected
- [ ] Polling intervals accurate
- [ ] Error handling tested and working
- [ ] Billing periods correct
- [ ] Theme persists properly
- [ ] Performance targets met
- [ ] No console errors or warnings

