// tests/dailySummaryMerge.test.js — merging a recomputed daily summary into the stored row.

import { describe, it, expect } from 'vitest';
import { mergeDailySummary, higherPeak, GENERATION_DROP_TOLERANCE_KWH } from '../shared/domain/dailySummaryMerge.js';

const row = (kwh, peak) => ({ inverter_sn: 'SN', summary_date: '2026-10-21', total_generation_kwh: kwh, peak_power_kw: peak });

describe('higherPeak()', () => {
  it('keeps the highest real reading and treats null as unknown, never as 0', () => {
    expect(higherPeak(33.52, 5.12)).toBe(33.52);
    expect(higherPeak(5.12, 33.52)).toBe(33.52);
    expect(higherPeak(null, 5.12)).toBe(5.12);
    expect(higherPeak(5.12, null)).toBe(5.12);
    expect(higherPeak(null, undefined)).toBeNull();
  });
});

describe('mergeDailySummary()', () => {
  it('inserts a day that has no row yet, as computed', () => {
    expect(mergeDailySummary(null, row(104, 5.12))).toEqual({ action: 'insert', row: row(104, 5.12) });
  });

  it('never lowers a peak raised from telemetry (21 Oct: 33.52 stored, 5.12 sampled)', () => {
    const r = mergeDailySummary(row(104, 33.52), row(104, 5.12));
    expect(r.action).toBe('unchanged');
  });

  it('still writes a generation correction on a day whose peak was raised (the old rule blocked it)', () => {
    const r = mergeDailySummary(row(103.5, 33.52), row(104, 5.12));
    expect(r).toEqual({ action: 'update', row: row(104, 33.52) });
  });

  it('raises the peak when the sample is higher than what is stored', () => {
    expect(mergeDailySummary(row(104, 10), row(104, 12.4))).toEqual({ action: 'update', row: row(104, 12.4) });
    expect(mergeDailySummary(row(104, null), row(104, 12.4))).toEqual({ action: 'update', row: row(104, 12.4) });
  });

  it('blocks a total that fell beyond the tolerance: the day counter only rises', () => {
    const r = mergeDailySummary(row(104, 33.52), row(104 - GENERATION_DROP_TOLERANCE_KWH - 0.1, 5));
    expect(r.action).toBe('blocked_generation_drop');
    expect(r.reason).toMatch(/only rises/);
  });

  it('accepts a small downward correction within the tolerance', () => {
    expect(mergeDailySummary(row(104, 33.52), row(103, 5)).action).toBe('update');
  });

  it('reports unchanged when nothing moved, including an unknown peak on both sides', () => {
    expect(mergeDailySummary(row(104, 33.52), row(104, 33.52)).action).toBe('unchanged');
    expect(mergeDailySummary(row(104, null), row(104, null)).action).toBe('unchanged');
  });

  it('treats a missing total on one side as a change rather than inventing a number', () => {
    expect(mergeDailySummary(row(null, 5), row(104, 5)).action).toBe('update');
  });
});
