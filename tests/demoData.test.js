// tests/demoData.test.js
//
// The demo (D-3, D-8): it must be obviously fake (every date 2035+), deterministic, free of any
// real identifier, shaped exactly like the real API (it runs the same resource code), and it must
// exercise every state the UI has to render honestly.

import { describe, it, expect } from 'vitest';
import { DEMO, createDemoDataset, createDemoRepo } from '../shared/demo/demoData.js';
import { demoRequest } from '../shared/demo/demoApi.js';
import { HttpError } from '../shared/data/query.js';

const ds = createDemoDataset();

/** Every YYYY-MM-DD found anywhere in a JSON-able value. */
function datesIn(value) {
  return JSON.stringify(value).match(/\d{4}-\d{2}-\d{2}/g) ?? [];
}
const years = (list) => [...new Set(list.map((d) => Number(d.slice(0, 4))))].sort();

describe('obviously fake', () => {
  it('every date in the dataset is 2035 or later', () => {
    for (const part of ['dailyRows', 'bills', 'uptimeRows', 'segments', 'alarmRows']) {
      const ys = years(datesIn(ds[part]));
      expect(Math.min(...ys), part).toBeGreaterThanOrEqual(2035);
    }
    expect(DEMO.start >= '2035-01-01').toBe(true);
    expect(DEMO.today >= '2035-01-01').toBe(true);
  });

  it('every date in every API response is 2035 or later (nothing real can leak through the resource layer)', async () => {
    const calls = [
      ['range', { from: '2036-07-01', to: '2036-09-14', compare: 'prev,yoy' }],
      ['comparison', { year: '2036' }],
      ['comparison', { year: '2035' }],
      ['bills', {}],
      ['uptime', { from: '2036-08-01', to: '2036-09-14' }],
      ['alarms', { from: '2036-06-01', to: '2036-09-14' }],
      ['telemetry', { date: '2036-09-14' }],
      ['live', {}],
      ['settings', {}]
    ];
    for (const [name, q] of calls) {
      const r = await demoRequest(name, q);
      const ys = datesIn(r.body);
      for (const y of ys.map((d) => Number(d.slice(0, 4)))) expect(y, `${name}: ${JSON.stringify(q)}`).toBeGreaterThanOrEqual(2035);
    }
  });

  it('contains no real identifiers', () => {
    const blob = JSON.stringify(ds) + JSON.stringify(DEMO);
    expect(blob).not.toMatch(/1811040244070066|CN00079|41\.76|7\.0713|80\.0088/);
    expect(DEMO.inverterSn).toMatch(/^DEMO-/);
    expect(DEMO.capacityKwp).not.toBe(41.76);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(createDemoDataset())).toBe(JSON.stringify(createDemoDataset()));
  });
});

describe('exercises every state the UI must render honestly', () => {
  it('has a measured-zero outage, a collection gap with NO rows, a comms-lost day and a late start', () => {
    const byDate = new Map(ds.dailyRows.map((r) => [r.date, r]));
    // measured zeros
    expect(byDate.get('2035-11-10').kwh).toBe(0);
    expect(ds.uptimeRows.find((r) => r.day === '2035-11-10')).toMatchObject({ status: 'down', uptime_pct: 0 });
    // collection gap: absent everywhere (unknown, never 0)
    for (const d of ['2036-03-02', '2036-03-06']) {
      expect(byDate.has(d)).toBe(false);
      expect(ds.uptimeRows.some((r) => r.day === d)).toBe(false);
    }
    // comms lost: excluded from the percentage
    const comms = ds.uptimeRows.find((r) => r.day === '2036-05-20');
    expect(comms.comms_lost_min).toBeGreaterThan(60);
    expect(ds.segments.some((s) => s.day === '2036-05-20' && s.kind === 'comms_lost')).toBe(true);
    // late start
    expect(ds.uptimeRows.find((r) => r.day === '2036-07-08').edge_gap_min).toBeGreaterThan(60);
  });

  it('has grid trips and a tariff change visible in per-bill effective rates', async () => {
    expect(ds.alarmRows.length).toBeGreaterThan(100);
    expect(ds.alarmRows.every((a) => a.alarm_code === '1011')).toBe(true);
    const { body } = await demoRequest('bills');
    const rates = new Set(body.bills.map((b) => Math.round(b.effectiveRatePerKwh * 100) / 100));
    expect(rates).toEqual(new Set([40, 44]));
  });

  it('leaves the current bill period open: CEB side null, never 0', async () => {
    const { body } = await demoRequest('comparison', { year: 2036 });
    const sep = body.rows.find((r) => r.month === 'Sep');
    expect(sep.status).toBe('provisional');
    expect(sep.ceb).toBeNull();
    expect(body.rows.filter((r) => r.status === 'pending')).toHaveLength(3); // Oct-Dec
  });
});

describe('runs through the real resource code', () => {
  it('range: a window containing the collection gap is flagged incomplete, with the gap listed', async () => {
    const { body } = await demoRequest('range', { from: '2036-02-25', to: '2036-03-10', rate: 'fixed' });
    expect(body.stats.missingDates).toEqual(['2036-03-02', '2036-03-03', '2036-03-04', '2036-03-05', '2036-03-06']);
    expect(body.stats.daysInRange).toBe(15);
    expect(body.stats.completeness).toBeCloseTo(10 / 15, 10);
    expect(body.stats.revenue.basis).toBe('fixed');
    expect(body.settings.capacityKwp).toBe(50);
  });

  it('range: the outage week reports measured zero days, flagged', async () => {
    const { body } = await demoRequest('range', { from: '2035-11-08', to: '2035-11-14' });
    expect(body.stats.zeroDays).toEqual(['2035-11-10', '2035-11-11', '2035-11-12']);
    expect(body.uptime.uptimePct).toBeLessThan(80);
  });

  it('range: comparisons work across the dataset, and the first year has no year-earlier baseline', async () => {
    const full = await demoRequest('range', { from: '2036-06-01', to: '2036-06-30', compare: 'prev,yoy' });
    expect(full.body.comparisons.yoy.stats.presentDays).toBe(30);
    expect(full.body.comparisons.yoy.delta.deltaAvgKwh).not.toBeNull();
    const first = await demoRequest('range', { from: '2035-02-01', to: '2035-02-10', compare: 'yoy' });
    expect(first.body.comparisons.yoy.stats.totalKwh).toBeNull(); // 2034 does not exist in the demo
    expect(first.body.comparisons.yoy.delta.deltaAvgKwh).toBeNull();
  });

  it('uptime: healthy overall (it is a demo of a good plant) with a segments timeline for short ranges', async () => {
    const { body } = await demoRequest('uptime', { from: '2036-08-01', to: '2036-08-31' });
    expect(body.aggregate.uptimePct).toBeGreaterThan(97);
    expect(body.aggregate.uptimePct).toBeLessThanOrEqual(100);
    expect(Array.isArray(body.segments)).toBe(true);
  });

  it('bills: complete periods carry a small variance; the gap period is flagged incomplete', async () => {
    const { body } = await demoRequest('bills');
    const gap = body.bills.find((b) => b.billDate.startsWith('2036-03'));
    expect(gap.complete).toBe(false);
    const clean = body.bills.find((b) => b.billDate === '2036-08-05' || b.billDate.startsWith('2036-08'));
    expect(clean.complete).toBe(true);
    expect(Math.abs(clean.variancePct)).toBeLessThan(5);
  });

  it('telemetry: a bell-shaped day of 5-minute points; empty outside the dataset', async () => {
    const { body } = await demoRequest('telemetry', { date: '2036-09-14' });
    expect(body.points.length).toBeGreaterThan(120);
    const kw = body.points.map((p) => p.pac_kw);
    const peakAt = kw.indexOf(Math.max(...kw)) / kw.length;
    expect(peakAt).toBeGreaterThan(0.3);
    expect(peakAt).toBeLessThan(0.7);
    expect(body.points[0].pv_v).toHaveLength(8);
    expect((await demoRequest('telemetry', { date: '2020-01-01' })).body.points).toEqual([]);
  });

  it('export works on demo data and unknown stays an empty cell', async () => {
    const r = await demoRequest('export', { kind: 'daily', from: '2036-03-01', to: '2036-03-03' });
    expect(r.filename).toBe('daily_generation_2036-03-01_2036-03-03.csv');
    expect(r.csv.split('\r\n')[0]).toBe('date,generation_kwh,peak_kw');
    expect(r.csv.split('\r\n').length).toBe(1 + 1 + 1); // header + 03-01 + trailing '' (03-02, 03-03 are the gap)
  });

  it('rejects bad input exactly like the real endpoint', async () => {
    await expect(Promise.resolve().then(() => demoRequest('range', { from: '2036-09-10', to: '2036-09-01' }))).rejects.toBeInstanceOf(HttpError);
    expect(() => demoRequest('nope')).toThrow(HttpError);
  });

  it('createDemoRepo has the same method surface as the real repository', () => {
    expect(Object.keys(createDemoRepo(ds)).sort()).toEqual(['alarms', 'bills', 'dailyRows', 'segments', 'settings', 'telemetryDay', 'uptimeDays']);
  });
});
