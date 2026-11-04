// tests/v3StableToken.test.js
// Regression guard: Clerk hands out a new `user` and getToken about once a minute (session token refresh). When the
// data source depended on that function, every refresh rebuilt it and re-read every resource on the page (seen on
// production 2026-11-04: all of /api/data/* again ~66 s after load). The source must depend on the data mode only, and
// the access context must hand out one getToken for the whole session.
// (No DOM test environment here, so this checks the code, not a render.)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

describe('a session token refresh does not re-read the page', () => {
  it('the data source is built from the mode alone and reads the token at request time', () => {
    const src = read('src/v3/data/DataProvider.jsx');
    expect(src).toMatch(/createLiveSource\(\{ getToken: \(\) => tokenRef\.current\(\) \}\)/);
    expect(src).toMatch(/createDemoSource\(demoRequest\)\), \[mode\]\)/);
  });
  it('the access context hands out one stable getToken', () => {
    const src = read('src/v3/access/AccessProvider.jsx');
    expect(src).toMatch(/const stableGetToken = useCallback\(\(\) => getTokenRef\.current\(\), \[\]\)/);
    expect(src).toMatch(/getToken: stableGetToken,/);
    expect(src).not.toMatch(/getToken: \(\) => getToken\(\)/);
  });
});
