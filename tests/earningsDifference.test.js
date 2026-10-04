// tests/earningsDifference.test.js
//
// LR-004 (docs/logic-registry/LR-004-earnings-difference.md) acceptance criteria, executable.

import { describe, it, expect } from 'vitest';
import { computeEarningsDifference, exclusionReason } from '../shared/domain/earningsDifference.js';

const bill = (o) => ({
  billDate: '2026-02-03', periodStart: '2026-01-04', periodEnd: '2026-02-03',
  cebKwh: 1400, earningsLkr: 56000, inverterKwh: 1500, complete: true, ...o
});

describe('LR-004 earnings difference', () => {
  it('worked example: two complete bills at their own rate', () => {
    const r = computeEarningsDifference([
      bill({ billDate: '2026-02-03', cebKwh: 1400, earningsLkr: 56000, inverterKwh: 1500 }),
      bill({ billDate: '2026-03-03', periodStart: '2026-02-04', periodEnd: '2026-03-03', cebKwh: 1590, earningsLkr: 63600, inverterKwh: 1600 })
    ]);
    expect(r.includedPeriods).toBe(2);
    expect(r.differenceLkr).toBeCloseTo(-4400, 6);
    expect(r.earningsLkr).toBe(119600);
    expect(r.differencePct).toBeCloseTo(-4400 / 124000 * 100, 6);
    expect(r.from).toBe('2026-01-04');
    expect(r.to).toBe('2026-03-03');
  });

  it('uses each bill\'s own rate, never an average', () => {
    const r = computeEarningsDifference([
      bill({ cebKwh: 1000, earningsLkr: 40000, inverterKwh: 1100 }),
      bill({ billDate: '2026-03-03', cebKwh: 1000, earningsLkr: 44000, inverterKwh: 1100 })
    ]);
    expect(r.differenceLkr).toBeCloseTo(-(100 * 40 + 100 * 44), 6);
  });

  it('excludes and counts ineligible periods instead of scoring them 0', () => {
    const r = computeEarningsDifference([
      bill({}),
      bill({ billDate: 'b', complete: false }),
      bill({ billDate: 'c', cebKwh: 0 }),
      bill({ billDate: 'd', earningsLkr: null }),
      bill({ billDate: 'e', inverterKwh: null })
    ]);
    expect(r.includedPeriods).toBe(1);
    expect(r.excluded).toEqual([
      { billDate: 'b', reason: 'incomplete_days' },
      { billDate: 'c', reason: 'no_rate' },
      { billDate: 'd', reason: 'no_rate' },
      { billDate: 'e', reason: 'no_inverter_data' }
    ]);
    expect(r.differenceLkr).toBeCloseTo(-4000, 6);
  });

  it('returns null, not 0, when nothing is eligible', () => {
    const r = computeEarningsDifference([bill({ complete: false })]);
    expect(r.differenceLkr).toBeNull();
    expect(r.differencePct).toBeNull();
    expect(r.earningsLkr).toBeNull();
    expect(computeEarningsDifference([]).differenceLkr).toBeNull();
    expect(computeEarningsDifference(undefined).includedPeriods).toBe(0);
  });

  it('CEB paying less than generated is negative; paying more is positive, with no warning flag', () => {
    const r = computeEarningsDifference([bill({ cebKwh: 1500, earningsLkr: 60000, inverterKwh: 1400 })]);
    expect(r.differenceLkr).toBeCloseTo(4000, 6);
    expect(r).not.toHaveProperty('warning');
  });

  it('exclusionReason is null for an eligible bill', () => {
    expect(exclusionReason(bill({}))).toBeNull();
  });
});
