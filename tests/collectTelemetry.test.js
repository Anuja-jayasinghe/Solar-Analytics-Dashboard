// tests/collectTelemetry.test.js
//
// functions/collect_telemetry/run.js with fake adapters. What must hold:
//   * a dry run writes NOTHING
//   * a day that fails never produces a row (no fake zero), and the run is reported as failed
//   * an empty result is a failure, not success
//   * alarm-fetch failure is "unknown", not "none"
//   * peak back-fill only touches NULL peaks on existing rows
//   * re-running is idempotent (upserts keyed on natural keys)

import { describe, it, expect } from 'vitest';
import { runCollector } from '../functions/collect_telemetry/run.js';

const day = '2026-10-02';
const T0 = Date.parse('2026-10-02T02:00:00Z'); // 07:30 local
const pt = (ts, pac = 20000, eToday = 50) => ({ dataTimestamp: ts, state: 1, pac, pacStr: 'kW', pacPec: 0.001, eToday });
const goodPoints = Array.from({ length: 60 }, (_, i) => pt(T0 + i * 5 * 60_000, 20000 - i * 100, 50 + i));

function makeFakes({ points = goodPoints, failDay = null, alarmsFail = false, collectorFail = false, summary = [] } = {}) {
  const calls = { upserts: [], segments: [], runs: [], finished: [], peaks: [] };
  const solis = {
    async listInverters() { return { sn: 'INV1', collectorSn: 'COL1', stationId: 'S1' }; },
    async inverterDay(_sn, d) { if (d === failDay) throw new Error('solis 502'); return points; },
    async collectorDay() { if (collectorFail) throw new Error('collector down'); return [{ dataTimestamp: T0 + 60_000 }]; },
    async alarms() { if (alarmsFail) throw new Error('alarm api down'); return []; }
  };
  const db = {
    async startRun(info) { calls.runs.push(info); return 7; },
    async finishRun(id, patch) { calls.finished.push({ id, ...patch }); },
    async upsert(table, rows, onConflict) { calls.upserts.push({ table, n: rows.length, onConflict }); },
    async replaceSegments(sn, d, rows) { calls.segments.push({ sn, d, n: rows.length }); },
    async getSummary() { return summary; },
    async setPeakIfNull(d, kw) { calls.peaks.push({ d, kw }); return true; }
  };
  return { solis, db, calls };
}

describe('dry run', () => {
  it('writes nothing, opens no run record, but still reports what it would do', async () => {
    const { solis, db, calls } = makeFakes();
    const r = await runCollector({ solis, db, dates: [day], write: false });
    expect(calls.upserts).toEqual([]);
    expect(calls.segments).toEqual([]);
    expect(calls.runs).toEqual([]);
    expect(r.status).toBe('ok');
    expect(r.days[0].points).toBe(60);
    expect(r.pointsWritten).toBe(0);
  });
});

describe('write run', () => {
  it('upserts each table on its natural key and records the run', async () => {
    const { solis, db, calls } = makeFakes();
    const r = await runCollector({ solis, db, dates: [day], write: true });
    const byTable = Object.fromEntries(calls.upserts.map((u) => [u.table, u]));
    expect(byTable.inverter_telemetry).toMatchObject({ n: 60, onConflict: 'inverter_sn,ts' });
    expect(byTable.collector_heartbeats.onConflict).toBe('collector_sn,ts');
    expect(byTable.inverter_day_uptime.onConflict).toBe('inverter_sn,day');
    expect(calls.segments).toEqual([{ sn: 'INV1', d: day, n: expect.any(Number) }]);
    expect(calls.runs[0]).toMatchObject({ job: 'collect_telemetry', date_from: day, date_to: day });
    expect(calls.finished[0]).toMatchObject({ id: 7, status: 'ok', points_written: 60 });
    expect(r.status).toBe('ok');
  });

  it('chunks large inserts', async () => {
    const many = Array.from({ length: 1300 }, (_, i) => pt(T0 + i * 1000));
    const { solis, db, calls } = makeFakes({ points: many });
    await runCollector({ solis, db, dates: [day], write: true });
    expect(calls.upserts.filter((u) => u.table === 'inverter_telemetry').map((u) => u.n)).toEqual([500, 500, 300]);
  });

  it('is idempotent: two runs issue identical upserts', async () => {
    const a = makeFakes(); const b = makeFakes();
    await runCollector({ solis: a.solis, db: a.db, dates: [day], write: true });
    await runCollector({ solis: b.solis, db: b.db, dates: [day], write: true });
    expect(a.calls.upserts).toEqual(b.calls.upserts);
  });
});

describe('failure handling', () => {
  it('a failing day produces no rows and fails the run, other days still processed', async () => {
    const { solis, db, calls } = makeFakes({ failDay: '2026-10-01' });
    const r = await runCollector({ solis, db, dates: ['2026-10-01', day], write: true });
    expect(r.status).toBe('failed');
    expect(r.failedDays).toBe(1);
    expect(r.days[0]).toMatchObject({ dateKey: '2026-10-01', status: 'failed' });
    expect(calls.upserts.filter((u) => u.table === 'inverter_day_uptime')).toHaveLength(1); // only the good day
    expect(calls.finished[0].status).toBe('failed');
  });

  it('a run that found no points at all is "empty", not success; with no logger evidence the day is no_data, not 0%', async () => {
    const { solis, db } = makeFakes({ points: [], collectorFail: true });
    const r = await runCollector({ solis, db, dates: [day], write: true });
    expect(r.status).toBe('empty');
    expect(r.days[0].status).toBe('no_data');
    expect(r.days[0].uptimePct).toBeNull();
  });

  it('no inverter points but a reporting logger is a measured outage (down, 0%) and still fails the run loudly', async () => {
    const { solis, db } = makeFakes({ points: [] });
    const r = await runCollector({ solis, db, dates: [day], write: true });
    expect(r.days[0].status).toBe('down');
    expect(r.days[0].uptimePct).toBe(0);
    expect(r.status).toBe('empty');
  });

  it('an alarm-fetch failure marks the run failed and derives uptime with alarms unknown', async () => {
    const { solis, db, calls } = makeFakes({ alarmsFail: true });
    const r = await runCollector({ solis, db, dates: [day], write: true });
    expect(r.status).toBe('failed');
    expect(r.alarmsFetched).toBeNull();
    expect(calls.upserts.find((u) => u.table === 'inverter_alarms')).toBeUndefined();
  });

  it('a collector failure only degrades evidence; the run still succeeds and counts it', async () => {
    const { solis, db } = makeFakes({ collectorFail: true });
    const r = await runCollector({ solis, db, dates: [day], write: true });
    expect(r.status).toBe('ok');
    expect(r.collectorFailures).toBe(1);
  });

  it('refuses an empty date list', async () => {
    const { solis, db } = makeFakes();
    expect((await runCollector({ solis, db, dates: [], write: true })).status).toBe('failed');
  });
});

describe('peak back-fill', () => {
  const summary = [{ summary_date: day, total_generation_kwh: 100, peak_power_kw: null }];

  it('sets the measured max only where the summary peak is NULL', async () => {
    const { solis, db, calls } = makeFakes({ summary });
    const r = await runCollector({ solis, db, dates: [day], write: true, fillPeaks: true });
    expect(calls.peaks).toEqual([{ d: day, kw: 20 }]);
    expect(r.peaksFilled).toBe(1);
  });

  it('never touches a summary row that already has a peak', async () => {
    const { solis, db, calls } = makeFakes({ summary: [{ ...summary[0], peak_power_kw: 31.2 }] });
    await runCollector({ solis, db, dates: [day], write: true, fillPeaks: true });
    expect(calls.peaks).toEqual([]);
  });

  it('never creates a summary row that does not exist', async () => {
    const { solis, db, calls } = makeFakes({ summary: [] });
    await runCollector({ solis, db, dates: [day], write: true, fillPeaks: true });
    expect(calls.peaks).toEqual([]);
  });

  it('a dry run only counts what it would fill', async () => {
    const { solis, db, calls } = makeFakes({ summary });
    const r = await runCollector({ solis, db, dates: [day], write: false, fillPeaks: true });
    expect(calls.peaks).toEqual([]);
    expect(r.peaksWouldFill).toBe(1);
  });
});

describe('reconciliation (report only)', () => {
  it('flags a daily summary that disagrees with the inverter by more than the tolerance', async () => {
    const { solis, db } = makeFakes({ summary: [{ summary_date: day, total_generation_kwh: 0, peak_power_kw: 0 }] });
    const r = await runCollector({ solis, db, dates: [day], write: false });
    expect(r.reconcile).toEqual([{ dateKey: day, summaryKwh: 0, solisKwh: 109 }]);
  });

  it('flags a day with telemetry but no summary row at all', async () => {
    const { solis, db } = makeFakes({ summary: [] });
    const r = await runCollector({ solis, db, dates: [day], write: false });
    expect(r.missingSummary).toEqual([{ dateKey: day, solisKwh: 109 }]);
  });

  it('stays quiet when they agree', async () => {
    const { solis, db } = makeFakes({ summary: [{ summary_date: day, total_generation_kwh: 109.4, peak_power_kw: 20 }] });
    const r = await runCollector({ solis, db, dates: [day], write: false });
    expect(r.reconcile).toEqual([]);
  });
});

describe('resolveDates (CLI)', async () => {
  const { resolveDates } = await import('../functions/collect_telemetry/index.js');
  const now = Date.parse('2026-10-03T10:00:00Z'); // 15:30 on 3 Oct, Colombo

  it('defaults to the last N COMPLETED days (never today)', () => {
    const d = resolveDates({ days: 3 }, now);
    expect(d).toEqual(['2026-09-30', '2026-10-01', '2026-10-02']);
  });

  it('clamps an explicit --to that reaches today back to yesterday', () => {
    const d = resolveDates({ from: '2026-10-01', to: '2026-10-03', days: 7 }, now);
    expect(d.at(-1)).toBe('2026-10-02');
  });

  it('allows today only when asked', () => {
    expect(resolveDates({ days: 1, includeToday: true }, now)).toEqual(['2026-10-03']);
  });

  it('judges "today" in Colombo, not UTC (01:00 local on the 4th is still 3 Oct in UTC)', () => {
    const early = Date.parse('2026-10-03T19:30:00Z'); // 01:00 on 4 Oct local
    expect(resolveDates({ days: 1 }, early)).toEqual(['2026-10-03']);
  });

  it('rejects bad input and absurd ranges', () => {
    expect(() => resolveDates({ from: 'x', days: 1 }, now)).toThrow();
    expect(() => resolveDates({ from: '2026-10-05', to: '2026-10-02', days: 1 }, now)).toThrow(/nothing to do/);
    expect(() => resolveDates({ from: '2010-01-01', days: 1 }, now)).toThrow(/exceeds/);
    expect(() => resolveDates({ days: 0 }, now)).toThrow();
  });
});
