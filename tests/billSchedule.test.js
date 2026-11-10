// tests/billSchedule.test.js — LR-005 rule 9 (shared/domain/billSchedule.js).

import { describe, it, expect } from 'vitest';
import { evaluateBillArrival } from '../shared/domain/billSchedule.js';

// Monthly bills around the 3rd–4th, like the real ones.
const BILLS = ['2036-04-03', '2036-05-04', '2036-06-03', '2036-07-03', '2036-08-04', '2036-09-03', '2036-10-03', '2036-11-04'];

describe('evaluateBillArrival', () => {
  it('expects the next bill one median interval after the latest, and stays quiet through the grace period', () => {
    const r = evaluateBillArrival({ billDates: BILLS, pendingIngestions: 0, todayKey: '2036-12-11' });
    // gaps of the last 7 bills: 31, 30, 30, 32, 30, 30 → median 30
    expect(r).toMatchObject({ ok: true, latest: '2036-11-04', intervalDays: 30, expected: '2036-12-04', alertAfter: '2036-12-11' });
  });

  it('alerts the day after the grace period, saying how late the bill is', () => {
    const r = evaluateBillArrival({ billDates: BILLS, pendingIngestions: 0, todayKey: '2036-12-12' });
    expect(r).toMatchObject({ ok: false, daysLate: 8 });
    expect(r.reason).toBe('no bill since 2036-11-04; the next was expected around 2036-12-04 (every ~30 days) and is 8 days late');
  });

  it('does not alert while an uploaded bill waits for review', () => {
    const r = evaluateBillArrival({ billDates: BILLS, pendingIngestions: 1, todayKey: '2036-12-20' });
    expect(r.ok).toBe(true);
    expect(r.reason).toBe('1 uploaded bill(s) waiting in the review queue');
  });

  it('uses a median, so one unusually long gap does not move the expected date', () => {
    // gaps 30, 30, 30, 30, 30 and then 60 (one bill skipped): the mean would be 35, the median stays 30
    const withLongGap = ['2036-04-04', '2036-05-04', '2036-06-03', '2036-07-03', '2036-08-02', '2036-09-01', '2036-10-31'];
    expect(evaluateBillArrival({ billDates: withLongGap, pendingIngestions: 0, todayKey: '2036-11-10' }).intervalDays).toBe(30);
  });

  it('only looks at the most recent gaps, and ignores order, duplicates and bad dates', () => {
    const messy = [...BILLS].reverse().concat(['2036-11-04', 'not-a-date', null]);
    const r = evaluateBillArrival({ billDates: messy, pendingIngestions: 0, todayKey: '2036-11-10' });
    expect(r).toMatchObject({ ok: true, latest: '2036-11-04', intervalDays: 30 });
  });

  it('is skipped with fewer than two bills, since there is no interval to expect', () => {
    expect(evaluateBillArrival({ billDates: ['2036-11-04'], pendingIngestions: 0, todayKey: '2037-06-01' })).toMatchObject({ ok: true, skipped: true });
    expect(evaluateBillArrival({ billDates: [], pendingIngestions: 0, todayKey: '2037-06-01' })).toMatchObject({ ok: true, skipped: true });
  });

  it('takes the average of the two middle gaps when the count is even', () => {
    const r = evaluateBillArrival({ billDates: ['2036-01-01', '2036-01-31', '2036-03-03'], pendingIngestions: 0, todayKey: '2036-03-10' });
    expect(r.intervalDays).toBe(31); // gaps 30 and 32
  });
});
