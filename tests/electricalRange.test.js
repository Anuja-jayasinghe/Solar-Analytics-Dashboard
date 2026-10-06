import { describe, expect, it } from 'vitest';
import { summarizeElectricalRange } from '../shared/domain/electricalRange.js';
import { resources } from '../shared/data/resources.js';

const point = (ts, overrides = {}) => ({
  ts, pac_kw: 20, pv_a: [5, 0, 6], pv_v: [560, 560, 570],
  ac_v: [220, 231, 247], fac_hz: 50.1, power_factor: 0.99, temp_c: 48,
  ...overrides
});

describe('electrical range summaries', () => {
  it('uses Colombo dates, producing points, and keeps missing days unknown', () => {
    const result = summarizeElectricalRange([
      point('2026-10-01T18:35:00Z'), // 2 Oct 00:05 Colombo
      point('2026-10-02T04:30:00Z', { pac_kw: 0, ac_v: [0, 0, 0] }),
      point('2026-10-02T06:00:00Z', { pv_a: [7, 0, 8], ac_v: [222, 233, 249], temp_c: 50 })
    ], '2026-10-01', '2026-10-03');
    expect(result.days.map((d) => d.date)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(result.days[0]).toMatchObject({ samples: 0, producingSamples: 0, acPhaseSpreadVolts: null });
    expect(result.days[1]).toMatchObject({ samples: 3, producingSamples: 2, temperatureMaxC: 50 });
    expect(result.days[1].pvInputs.map((p) => p.amps)).toEqual([6, 0, 7]);
    expect(result.days[1].acPhaseVolts).toEqual([221, 232, 248]);
    expect(result.days[1].acPhaseSpreadVolts).toBe(27);
    expect(result.summary).toMatchObject({ daysRequested: 3, daysWithTelemetry: 1, daysProducing: 1, producingSamples: 2 });
  });

  it('validates a completed range of at most 31 days before querying storage', async () => {
    const calls = [];
    const repo = { async telemetryRange(from, to) { calls.push([from, to]); return [point('2026-10-02T06:00:00Z')]; } };
    await expect(resources.electrical(repo, { from: '2026-10-02', to: '2026-10-02' }, { todayKey: '2026-10-06' }))
      .resolves.toMatchObject({ body: { summary: { producingSamples: 1 } } });
    expect(calls).toEqual([['2026-10-02', '2026-10-02']]);
    await expect(resources.electrical(repo, { from: '2026-09-01', to: '2026-10-02' }, { todayKey: '2026-10-06' }))
      .rejects.toMatchObject({ status: 400, code: 'range_too_large' });
    await expect(resources.electrical(repo, { from: '2026-10-06', to: '2026-10-06' }, { todayKey: '2026-10-06' }))
      .rejects.toMatchObject({ status: 400, code: 'invalid_range' });
    expect(calls).toHaveLength(1);
  });
});
