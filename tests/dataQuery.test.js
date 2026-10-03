// tests/dataQuery.test.js
//
// api/_lib/data/{query,rateLimit,csv}.js: every caller-supplied value is untrusted.

import { describe, it, expect } from 'vitest';
import { HttpError, parseRange, parseDate, parseEnum, parseIntBounded, parseCompare, parseYear } from '../shared/data/query.js';
import { createRateLimiter } from '../api/_lib/data/rateLimit.js';
import { csvCell, toCsv } from '../shared/data/csv.js';

const bad = (fn) => { try { fn(); } catch (e) { return e; } return null; };

describe('parseRange', () => {
  it('accepts a valid range', () => {
    expect(parseRange({ from: '2026-10-01', to: '2026-10-07' })).toEqual({ from: '2026-10-01', to: '2026-10-07', days: 7 });
  });
  it('rejects missing, malformed, impossible and reversed ranges with a 400', () => {
    for (const q of [{}, { from: '2026-10-01' }, { from: 'x', to: 'y' }, { from: '2026-02-30', to: '2026-03-01' }, { from: '2026-10-07', to: '2026-10-01' }]) {
      const e = bad(() => parseRange(q));
      expect(e).toBeInstanceOf(HttpError);
      expect(e.status).toBe(400);
    }
  });
  it('caps the size', () => {
    expect(bad(() => parseRange({ from: '2000-01-01', to: '2026-10-01' })).code).toBe('range_too_large');
    expect(parseRange({ from: '2026-01-01', to: '2026-03-01' }, { maxDays: 62 }).days).toBe(60);
    expect(bad(() => parseRange({ from: '2026-01-01', to: '2026-04-01' }, { maxDays: 62 })).status).toBe(400);
  });
  it('takes the first value when a parameter is repeated (?from=a&from=b)', () => {
    expect(parseRange({ from: ['2026-10-01', '2020-01-01'], to: '2026-10-02' }).from).toBe('2026-10-01');
  });
  it('does not pass SQL-ish or path-ish junk through', () => {
    expect(bad(() => parseRange({ from: "2026-10-01'; drop table x;--", to: '2026-10-02' })).status).toBe(400);
    expect(bad(() => parseRange({ from: '../../etc/passwd', to: '2026-10-02' })).status).toBe(400);
  });
});

describe('other parsers', () => {
  it('parseDate', () => {
    expect(parseDate({ date: '2026-10-01' }, 'date')).toBe('2026-10-01');
    expect(bad(() => parseDate({ date: '2026-13-01' }, 'date')).status).toBe(400);
  });
  it('parseEnum uses the fallback only when absent, and rejects values outside the allowlist', () => {
    expect(parseEnum({}, 'rate', ['fixed', 'effective'], 'effective')).toBe('effective');
    expect(parseEnum({ rate: 'fixed' }, 'rate', ['fixed', 'effective'], 'effective')).toBe('fixed');
    expect(bad(() => parseEnum({ rate: 'free' }, 'rate', ['fixed', 'effective'], 'effective')).status).toBe(400);
    expect(bad(() => parseEnum({}, 'kind', ['daily'])).code).toBe('missing_param');
  });
  it('parseIntBounded', () => {
    expect(parseIntBounded({}, 'limit', { min: 1, max: 500, fallback: 100 })).toBe(100);
    expect(parseIntBounded({ limit: '50' }, 'limit', { min: 1, max: 500, fallback: 100 })).toBe(50);
    for (const v of ['0', '501', '1.5', 'abc', '1e3']) expect(bad(() => parseIntBounded({ limit: v }, 'limit', { min: 1, max: 500, fallback: 100 })).status).toBe(400);
  });
  it('parseCompare', () => {
    expect(parseCompare({})).toEqual([]);
    expect(parseCompare({ compare: 'prev,yoy,prev' })).toEqual(['prev', 'yoy']);
    expect(bad(() => parseCompare({ compare: 'prev,decade' })).status).toBe(400);
  });
  it('parseYear', () => {
    expect(parseYear({ year: '2026' })).toBe(2026);
    expect(bad(() => parseYear({})).status).toBe(400);
    expect(bad(() => parseYear({ year: '1999' })).status).toBe(400);
  });
});

describe('rate limiter', () => {
  it('allows up to the limit then blocks with a retry-after, per key', () => {
    const t = 0;
    const rl = createRateLimiter({ limit: 3, windowMs: 60_000, now: () => t });
    expect([1, 2, 3].map(() => rl.check('u1').allowed)).toEqual([true, true, true]);
    const blocked = rl.check('u1');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(rl.check('u2').allowed).toBe(true); // another caller is unaffected
  });
  it('resets after the window', () => {
    let t = 0;
    const rl = createRateLimiter({ limit: 1, windowMs: 1000, now: () => t });
    rl.check('u');
    expect(rl.check('u').allowed).toBe(false);
    t = 1001;
    expect(rl.check('u').allowed).toBe(true);
  });
  it('does not grow without bound', () => {
    const rl = createRateLimiter({ limit: 5, windowMs: 60_000, maxKeys: 10, now: () => 0 });
    for (let i = 0; i < 1000; i++) rl.check(`k${i}`);
    expect(rl.check('k999').remaining).toBeLessThanOrEqual(3); // recent keys survive pruning
  });
});

describe('csv', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('l1\nl2')).toBe('"l1\nl2"');
  });
  it('neutralises spreadsheet formula injection in strings', () => {
    for (const s of ['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\t=x']) expect(csvCell(s).replace(/^"/, '')).toMatch(/^'/);
    expect(csvCell('=HYPERLINK("http://x","y")')).toBe('"\'=HYPERLINK(""http://x"",""y"")"');
  });
  it('leaves real negative numbers alone', () => {
    expect(csvCell(-5.5)).toBe('-5.5');
  });
  it('exports null / undefined / NaN as an empty cell, never 0', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(NaN)).toBe('');
    expect(csvCell(0)).toBe('0');
  });
  it('builds a CRLF document with a header row', () => {
    expect(toCsv([{ header: 'date', key: 'd' }, { header: 'kwh', value: (r) => r.k }], [{ d: '2026-10-01', k: 150.2 }, { d: '2026-10-02', k: null }]))
      .toBe('date,kwh\r\n2026-10-01,150.2\r\n2026-10-02,\r\n');
  });
});
