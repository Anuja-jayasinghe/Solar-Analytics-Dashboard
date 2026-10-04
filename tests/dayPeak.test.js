// tests/dayPeak.test.js
import { describe, it, expect } from 'vitest';
import { peakOfDay } from '../shared/domain/dayPeak.js';

// 2036-09-10 05:30Z is 11:00 in Colombo (UTC+5:30)
const pt = (hhmmZ, kw, extra = {}) => ({ dataTimestamp: Date.parse(`2036-09-10T${hhmmZ}:00Z`), pac: kw, pacStr: 'kW', ...extra });

describe('peakOfDay', () => {
  it('finds the highest power and its local time', () => {
    expect(peakOfDay([pt('05:30', 20), pt('06:25', 26.34), pt('07:00', 18)])).toEqual({ kw: 26.3, at: '11:55', points: 3 });
  });
  it('converts watts to kW through the same normaliser the collector uses', () => {
    expect(peakOfDay([{ dataTimestamp: Date.parse('2036-09-10T05:30:00Z'), pac: 21400, pacStr: 'W' }])?.kw).toBe(21.4);
  });
  it('pads the clock and handles early morning and midnight rollover', () => {
    expect(peakOfDay([pt('00:35', 0.7)])).toMatchObject({ at: '06:05' });
    expect(peakOfDay([{ dataTimestamp: Date.parse('2036-09-10T18:30:00Z'), pac: 1, pacStr: 'kW' }])).toMatchObject({ at: '00:00' });
  });
  it('keeps a real zero peak as 0 (a producing day that never moved) but returns null for no data', () => {
    expect(peakOfDay([pt('05:30', 0)])).toMatchObject({ kw: 0 });
    expect(peakOfDay([])).toBeNull();
    expect(peakOfDay(undefined)).toBeNull();
    expect(peakOfDay([{ pac: 5 }])).toBeNull(); // no timestamp: cannot be placed in time
    expect(peakOfDay([pt('05:30', undefined)])).toBeNull(); // no readable power
  });
  it('ignores negative readings and duplicate timestamps', () => {
    expect(peakOfDay([pt('05:30', -3), pt('05:35', 9)])).toMatchObject({ kw: 9 });
    expect(peakOfDay([pt('05:30', 5), pt('05:30', 7)])).toMatchObject({ kw: 7, points: 1 });
  });
});
