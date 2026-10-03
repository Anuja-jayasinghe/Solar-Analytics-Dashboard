// tests/time.test.js
//
// shared/domain/time.js: the site's date/time primitives. The headline risk is the one the
// project has hit before: a date key shifted by a day because of UTC vs Asia/Colombo (UTC+5:30).

import { describe, it, expect } from 'vitest';
import {
  isDateKey, localDateKey, localMinuteOfDay, startOfLocalDayMs, addDays, diffDays,
  eachDateKey, sameDayLastYear, sunTimes, operatingWindow
} from '../shared/domain/time.js';

const hhmm = (ms) => {
  const m = localMinuteOfDay(ms);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
};

describe('date keys', () => {
  it('validates strictly, including impossible dates', () => {
    expect(isDateKey('2026-10-03')).toBe(true);
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('2026-1-3')).toBe(false);
    expect(isDateKey(20261003)).toBe(false);
    expect(isDateKey(null)).toBe(false);
  });

  it('maps an instant to the Colombo calendar day, not the UTC day', () => {
    // 2026-10-02T20:00:00Z is already 01:30 on 3 Oct in Colombo.
    expect(localDateKey(Date.parse('2026-10-02T20:00:00Z'))).toBe('2026-10-03');
    // 2026-10-03T18:29:59Z is 23:59:59 on 3 Oct; one second later it is 4 Oct.
    expect(localDateKey(Date.parse('2026-10-03T18:29:59Z'))).toBe('2026-10-03');
    expect(localDateKey(Date.parse('2026-10-03T18:30:00Z'))).toBe('2026-10-04');
  });

  it('reports minutes since local midnight', () => {
    expect(localMinuteOfDay(Date.parse('2026-10-03T00:30:00Z'))).toBeCloseTo(6 * 60, 6);
    expect(localMinuteOfDay(Date.parse('2026-10-03T18:30:00Z'))).toBeCloseTo(0, 6);
  });

  it('round-trips local midnight', () => {
    const ms = startOfLocalDayMs('2026-10-03');
    expect(localDateKey(ms)).toBe('2026-10-03');
    expect(localDateKey(ms - 1)).toBe('2026-10-02');
    expect(localMinuteOfDay(ms)).toBe(0);
  });

  it('does arithmetic without timezone drift', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(diffDays('2026-09-05', '2026-10-03')).toBe(28);
    expect(eachDateKey('2026-10-01', '2026-10-03')).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(eachDateKey('2026-10-03', '2026-10-01')).toEqual([]);
  });

  it('maps the same day last year, folding 29 Feb to 28 Feb', () => {
    expect(sameDayLastYear('2026-10-03')).toBe('2025-10-03');
    expect(sameDayLastYear('2028-02-29')).toBe('2027-02-28');
  });

  it('throws on a malformed key instead of returning NaN dates', () => {
    expect(() => addDays('nope', 1)).toThrow(RangeError);
    expect(() => startOfLocalDayMs('2026-13-01')).toThrow(RangeError);
  });
});

describe('sunTimes', () => {
  it('puts sunrise/sunset on 2026-10-03 where Sri Lanka observes them', () => {
    const { sunriseMs, sunsetMs } = sunTimes('2026-10-03');
    const rise = localMinuteOfDay(sunriseMs);
    const set = localMinuteOfDay(sunsetMs);
    // Observed: inverter first points ~05:54-06:06, last ~18:09-18:48 (probe data).
    expect(rise).toBeGreaterThan(5 * 60 + 45);
    expect(rise).toBeLessThan(6 * 60 + 10);
    expect(set).toBeGreaterThan(17 * 60 + 50);
    expect(set).toBeLessThan(18 * 60 + 15);
    expect(hhmm(sunriseMs)).toMatch(/^0[56]:/);
  });

  it('keeps day length within the physically possible range at 7°N all year', () => {
    for (let m = 1; m <= 12; m++) {
      const key = `2026-${String(m).padStart(2, '0')}-15`;
      const { sunriseMs, sunsetMs } = sunTimes(key);
      const hours = (sunsetMs - sunriseMs) / 3_600_000;
      expect(hours).toBeGreaterThan(11.6);
      expect(hours).toBeLessThan(12.6);
    }
  });

  it('keeps sunrise and sunset on the requested Colombo date', () => {
    for (const key of ['2026-01-01', '2026-06-21', '2026-12-31']) {
      const { sunriseMs, sunsetMs } = sunTimes(key);
      expect(localDateKey(sunriseMs)).toBe(key);
      expect(localDateKey(sunsetMs)).toBe(key);
    }
  });
});

describe('operatingWindow', () => {
  it('is sunrise+30m to sunset−30m', () => {
    const { sunriseMs, sunsetMs } = sunTimes('2026-10-02');
    const w = operatingWindow('2026-10-02');
    expect(w.startMs - sunriseMs).toBe(30 * 60_000);
    expect(sunsetMs - w.endMs).toBe(30 * 60_000);
    expect(w.minutes).toBeGreaterThan(600);
    expect(w.minutes).toBeLessThan(720);
  });

  it('honours a custom margin', () => {
    const a = operatingWindow('2026-10-02', { marginMin: 0 });
    const b = operatingWindow('2026-10-02', { marginMin: 60 });
    expect(a.minutes - b.minutes).toBeCloseTo(120, 6);
  });
});
