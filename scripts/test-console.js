// Quick Test Script for Browser Console
// Copy and paste this into the browser console to run automated tests

console.log('🧪 Solar Dashboard Test Suite\n');

// Test 1: Check all context data
function testContextData() {
  console.log('Test 1: Context Data Structure');
  const context = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  console.log('✓ React DevTools available:', !!context);
}

// Test 2: Check cache service
function testCacheService() {
  console.log('\nTest 2: Cache Service');
  const stats = localStorage.getItem('cache_stats');
  console.log('✓ Cache stats:', stats || 'Not available');
  
  const keys = Object.keys(localStorage).filter(k => k.startsWith('cache_'));
  console.log('✓ Cached items:', keys.length);
  keys.forEach(k => console.log('  -', k));
}

// Test 3: Simulate network error
function testNetworkError() {
  console.log('\nTest 3: Network Error Simulation');
  console.log('Run this command to simulate 503 error:');
  console.log(`
const originalFetch = window.fetch;
window.fetch = function(...args) {
  if (args[0].includes('solis-live-data')) {
    console.log('🔴 Intercepted API call - returning 503');
    return Promise.reject(new Error('503 Service Unavailable'));
  }
  return originalFetch.apply(this, args);
};
console.log('✓ Error simulation active');
  `);
}

// Test 4: Check polling
function testPolling() {
  console.log('\nTest 4: Polling Check');
  console.log('Watch console for "[DataContext] Polling" messages');
  console.log('Expected intervals:');
  console.log('  - Live: 5 minutes (300000ms)');
  console.log('  - Charts: 15 minutes (900000ms)');
  console.log('  - Earnings: 15 minutes (900000ms)');
  console.log('  - MonthlyGen: 15 minutes (900000ms)');
}

// Test 5: Check theme
function testTheme() {
  console.log('\nTest 5: Theme System');
  const theme = localStorage.getItem('theme') || 'dark';
  const bodyClass = document.body.className;
  console.log('✓ Theme in localStorage:', theme);
  console.log('✓ Body class:', bodyClass);
  console.log('✓ Match:', bodyClass.includes(theme) ? 'YES' : 'NO');
}

// Test 6: Check for errors
function checkErrors() {
  console.log('\nTest 6: Error Check');
  const errors = window.performance.getEntriesByType('navigation');
  console.log('✓ Page load time:', errors[0]?.duration?.toFixed(2) + 'ms');
  
  const resources = window.performance.getEntriesByType('resource');
  const failed = resources.filter(r => r.transferSize === 0);
  console.log('✓ Failed resources:', failed.length);
  if (failed.length > 0) {
    failed.forEach(f => console.log('  - Failed:', f.name));
  }
}

// Run all tests
function runAllTests() {
  testContextData();
  testCacheService();
  testTheme();
  checkErrors();
  testPolling();
  testNetworkError();
  
  console.log('\n✅ Basic tests complete!');
  console.log('\n📋 Manual Tests Required:');
  console.log('1. Check all cards are visible and populated');
  console.log('2. Verify skeleton loaders appeared on first load');
  console.log('3. Test refresh button on each card');
  console.log('4. Switch themes and verify persistence');
  console.log('5. Navigate to Settings and back');
  console.log('6. Simulate network errors (use code above)');
  console.log('7. Wait 10+ min to see stale badges');
}

// Auto-run
runAllTests();
