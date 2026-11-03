// tests/dataApi.test.js
//
// The v3 read API end to end, with a fake repository and a fake auth: access control, validation,
// rate limiting, caching headers, error hygiene, and the correctness of each resource's output.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDataHandler } from '../api/_lib/data/handler.js';
import { createRateLimiter } from '../api/_lib/data/rateLimit.js';
import { createLiveProvider, mapLive } from '../api/_lib/data/live.js';
import { HttpError } from '../shared/data/query.js';

// ---- fakes ------------------------------------------------------------------------------------
function makeRes() {
  const res = { statusCode: 200, headers: {}, body: undefined, ended: false };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; res.ended = true; return res; };
  res.send = (b) => { res.body = b; res.ended = true; return res; };
  res.end = () => { res.ended = true; return res; };
  return res;
}
const req = (resource, query = {}, extra = {}) => ({ method: 'GET', headers: {}, query: { resource, ...query }, ...extra });

const range = (from, to, kwh = 100) => {
  const out = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push({ date: d.toISOString().slice(0, 10), kwh, peakKw: 30 });
  }
  return out;
};

function makeRepo(overrides = {}) {
  const calls = [];
  const track = (name, fn) => async (...a) => { calls.push([name, ...a]); return fn(...a); };
  const repo = {
    calls,
    dailyRows: track('dailyRows', async (from, to) => range(from, to).filter(() => true)),
    bills: track('bills', async () => [
      { bill_date: '2026-09-03', units_exported: 4007, earnings: 148259 },
      { bill_date: '2026-10-03', units_exported: 3783, earnings: 139971 }
    ]),
    uptimeDays: track('uptimeDays', async () => []),
    segments: track('segments', async () => []),
    alarms: track('alarms', async () => []),
    telemetryDay: track('telemetryDay', async () => []),
    telemetryRange: track('telemetryRange', async () => []),
    settings: track('settings', async () => ({ ratePerKwh: 37, capacityKwp: 41.76, acRatedKw: 40, dailyTargetKwh: 140 })),
    ...overrides
  };
  return repo;
}

const viewer = { id: 'user_viewer' };
function build({ verify = async () => viewer, repo = makeRepo(), live = async () => ({ status: 'online' }), limiter, ready } = {}) {
  return {
    repo,
    handler: createDataHandler({
      verify, repo, live, limiter: limiter ?? createRateLimiter({ limit: 1000 }), ready,
      now: () => Date.parse('2026-10-03T10:00:00Z')
    })
  };
}
async function call(handler, request) {
  const res = makeRes();
  await handler(request, res);
  return res;
}

// ---- access control ---------------------------------------------------------------------------
describe('access control', () => {
  it('stops at the auth step: no data is read when verify rejects', async () => {
    const repo = makeRepo();
    const { handler } = build({ repo, verify: async (_q, res) => { res.status(401).json({ error: 'Unauthorized' }); return null; } });
    const res = await call(handler, req('range', { from: '2026-10-01', to: '2026-10-02' }));
    expect(res.statusCode).toBe(401);
    expect(repo.calls).toEqual([]);
  });

  it('authorises BEFORE it even validates the resource (an anonymous probe learns nothing)', async () => {
    const { handler } = build({ verify: async (_q, res) => { res.status(403).json({ error: 'Forbidden' }); return null; } });
    const res = await call(handler, req('definitely-not-a-resource'));
    expect(res.statusCode).toBe(403);
  });

  it('only GET is accepted', async () => {
    const { handler } = build();
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const res = await call(handler, { ...req('settings'), method });
      expect(res.statusCode).toBe(405);
    }
  });

  it('answers a CORS preflight without authenticating', async () => {
    const verify = vi.fn();
    const { handler } = build({ verify });
    const res = await call(handler, { ...req('settings'), method: 'OPTIONS' });
    expect(res.statusCode).toBe(204);
    expect(verify).not.toHaveBeenCalled();
  });
});

describe('routing and validation', () => {
  it('an unknown resource is a 404, including prototype-pollution style names', async () => {
    const { handler } = build();
    for (const name of ['nope', '__proto__', 'constructor', 'toString', 'hasOwnProperty', '']) {
      const res = await call(handler, req(name));
      expect(res.statusCode, name).toBe(404);
    }
  });

  it('bad input is a 400 with a code, and the repository is never queried', async () => {
    const { handler, repo } = build();
    const res = await call(handler, req('range', { from: '2026-10-09', to: '2026-10-01' }));
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('invalid_range');
    expect(repo.calls.filter((c) => c[0] === 'dailyRows')).toEqual([]);
  });

  it('an unexpected failure is a generic 500 that leaks nothing', async () => {
    const repo = makeRepo({ settings: async () => { throw new Error('connection to db.secret-host.supabase.co refused (password=hunter2)'); } });
    const { handler } = build({ repo });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await call(handler, req('settings'));
    spy.mockRestore();
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/secret-host|hunter2|refused/);
  });

  it('stops when the server is misconfigured (ready() already answered)', async () => {
    const { handler, repo } = build({ ready: (res) => { res.status(500).json({ error: 'config' }); return false; } });
    const res = await call(handler, req('settings'));
    expect(res.statusCode).toBe(500);
    expect(repo.calls).toEqual([]);
  });
});

describe('rate limiting and caching', () => {
  it('returns 429 with Retry-After once the per-user limit is hit', async () => {
    const { handler } = build({ limiter: createRateLimiter({ limit: 2, windowMs: 60_000, now: () => 0 }) });
    expect((await call(handler, req('settings'))).statusCode).toBe(200);
    expect((await call(handler, req('settings'))).statusCode).toBe(200);
    const blocked = await call(handler, req('settings'));
    expect(blocked.statusCode).toBe(429);
    expect(Number(blocked.headers['Retry-After'])).toBeGreaterThan(0);
  });

  it('marks responses private (never shareable by a CDN) and varies on Authorization', async () => {
    const { handler } = build();
    const res = await call(handler, req('settings'));
    expect(res.headers['Cache-Control']).toMatch(/^private,/);
    expect(res.headers.Vary).toBe('Authorization');
  });
});

// ---- resources --------------------------------------------------------------------------------
describe('electrical history', () => {
  it('returns summarized completed days without exposing raw telemetry', async () => {
    const repo = makeRepo({ telemetryRange: async () => [{ ts: '2026-10-01T06:00:00Z', pac_kw: 20, pv_a: [5, 0], pv_v: [560, 560], ac_v: [220, 232, 246], fac_hz: 50, temp_c: 48, power_factor: 1 }] });
    const { handler } = build({ repo });
    const res = await call(handler, req('electrical', { from: '2026-10-01', to: '2026-10-02' }));
    expect(res.statusCode).toBe(200);
    expect(res.body.summary).toMatchObject({ daysRequested: 2, daysProducing: 1, producingSamples: 1 });
    expect(res.body.days[1]).toMatchObject({ samples: 0, producingSamples: 0 });
    expect(JSON.stringify(res.body)).not.toContain('pac_kw');
  });
});

describe('range', () => {
  it('computes Explore figures, with the tariff basis stated', async () => {
    const { handler } = build();
    const res = await call(handler, req('range', { from: '2026-10-01', to: '2026-10-03', rate: 'fixed' }));
    expect(res.statusCode).toBe(200);
    expect(res.body.stats.totalKwh).toBe(300);
    expect(res.body.stats.specificYield).toBeCloseTo(300 / 41.76, 6);
    expect(res.body.stats.revenue).toMatchObject({ lkr: 300 * 37, basis: 'fixed' });
    expect(res.body.rateMode).toBe('fixed');
  });

  it('defaults to the effective bill rate and leaves days after the last bill unrated', async () => {
    const { handler } = build();
    const res = await call(handler, req('range', { from: '2026-10-02', to: '2026-10-05' }));
    // bills cover up to 2026-10-03 (period 09-04..10-03); 10-04 and 10-05 have no bill yet.
    expect(res.body.stats.revenue.basis).toBe('effective');
    expect(res.body.stats.revenue.ratedDays).toBe(2);
    expect(res.body.stats.revenue.unratedDays).toBe(2);
  });

  it('reports the lowest FULL day: outage days and days without an uptime record never win', async () => {
    const kwh = { '2026-10-01': 120, '2026-10-02': 11.5, '2026-10-03': 95, '2026-10-04': 80 };
    const up = (day, trip = 0, gap = 0) => ({ day, status: trip + gap > 0 ? 'down' : 'ok', uptime_pct: 100, window_minutes: 660, trip_min: trip, gap_min: gap, comms_lost_min: 0, edge_gap_min: 0, trip_count: trip ? 1 : 0, gap_count: gap ? 1 : 0 });
    const repo = makeRepo({
      dailyRows: async (from, to) => range(from, to).map((r) => ({ ...r, kwh: kwh[r.date] })),
      // 10-02: a 3-hour power cut. 10-03: two short trips (12 min), still a full day. 10-04: no uptime record yet.
      uptimeDays: async () => [up('2026-10-01'), up('2026-10-02', 180), up('2026-10-03', 12)]
    });
    const { handler } = build({ repo });
    const res = await call(handler, req('range', { from: '2026-10-01', to: '2026-10-04' }));
    expect(res.body.stats.worst).toEqual({ date: '2026-10-02', kwh: 11.5 }); // still there for the chart scale
    expect(res.body.stats.lowestFull).toEqual({ day: { date: '2026-10-03', kwh: 95 }, fullDays: 2, stoppedDays: 1, unknownDays: 1 });
  });

  it('adds comparisons only when asked, and compares by average per day', async () => {
    const repo = makeRepo({
      dailyRows: async (from, to) => range(from, to, from >= '2026-10-01' ? 150 : 100)
    });
    const { handler } = build({ repo });
    const none = await call(handler, req('range', { from: '2026-10-01', to: '2026-10-03' }));
    expect(none.body.comparisons).toEqual({});
    const both = await call(handler, req('range', { from: '2026-10-01', to: '2026-10-03', compare: 'prev,yoy' }));
    expect(both.body.comparisons.prev.range).toEqual({ from: '2026-09-28', to: '2026-09-30' });
    expect(both.body.comparisons.prev.delta.deltaAvgPct).toBe(50);
    expect(both.body.comparisons.yoy.range).toEqual({ from: '2025-10-01', to: '2025-10-03' });
    expect(both.body.comparisons.prev.stats.series).toBeUndefined(); // baselines are slimmed
  });

  it('reports the unit-less truth when settings are missing: no capacity → no yield, not a guessed one', async () => {
    const repo = makeRepo({ settings: async () => ({ ratePerKwh: null, capacityKwp: null, acRatedKw: null, dailyTargetKwh: null }) });
    const { handler } = build({ repo });
    const res = await call(handler, req('range', { from: '2026-10-01', to: '2026-10-02', rate: 'fixed' }));
    expect(res.body.stats.specificYield).toBeNull();
    expect(res.body.stats.capacityFactor).toBeNull();
    expect(res.body.stats.revenue.lkr).toBeNull();
  });

  it('aggregates uptime for the same range from the derived table', async () => {
    const repo = makeRepo({
      uptimeDays: async () => [
        { day: '2026-10-01', status: 'ok', uptime_pct: '100.00', window_minutes: '660.0', trip_min: '0', gap_min: '0', comms_lost_min: '0', edge_gap_min: '0', trip_count: 0, gap_count: 0 },
        { day: '2026-10-02', status: 'ok', uptime_pct: '97.40', window_minutes: '660.0', trip_min: '17.3', gap_min: '0', comms_lost_min: '0', edge_gap_min: '0', trip_count: 3, gap_count: 0 },
        { day: '2026-10-03', status: 'no_data', uptime_pct: null, window_minutes: null, trip_min: '0', gap_min: '0', comms_lost_min: '0', edge_gap_min: '0', trip_count: 0, gap_count: 0 }
      ]
    });
    const { handler } = build({ repo });
    const res = await call(handler, req('range', { from: '2026-10-01', to: '2026-10-03' }));
    expect(res.body.uptime.daysTracked).toBe(3);
    expect(res.body.uptime.daysNoData).toBe(1);
    expect(res.body.uptime.tripCount).toBe(3);
    expect(res.body.uptime.uptimePct).toBeCloseTo(((1320 - 17.3) / 1320) * 100, 6);
  });
});

describe('comparison and bills', () => {
  it('comparison returns 12 LR-001 rows for the year', async () => {
    const { handler } = build();
    const res = await call(handler, req('comparison', { year: '2026' }));
    expect(res.body.rows).toHaveLength(12);
    expect(res.body.rows.find((r) => r.month === 'Sep')).toMatchObject({ status: 'finalized', ceb: 3783 });
    expect((await call(handler, req('comparison', {}))).statusCode).toBe(400);
  });

  it('comparison loads daily rows from the start of a long bill period and up to today', async () => {
    const repo = makeRepo({ bills: async () => [{ bill_date: '2025-06-04', units_exported: 3300 }, { bill_date: '2026-09-03', units_exported: 4007 }] });
    const { handler } = build({ repo });
    await call(handler, req('comparison', { year: '2026' }));
    expect(repo.calls.find((c) => c[0] === 'dailyRows').slice(1)).toEqual(['2025-06-05', '2027-01-31']);
    repo.calls.length = 0;
    await call(handler, req('comparison', { year: '2024' }));
    expect(repo.calls.find((c) => c[0] === 'dailyRows').slice(1)).toEqual(['2023-12-01', '2026-10-03']);
  });

  it('bills carry period, effective rate, completeness and a variance only for complete periods', async () => {
    const repo = makeRepo({
      dailyRows: async () => range('2026-09-04', '2026-10-03', 126).filter((r) => r.date !== '2026-09-20') // one missing day
    });
    const { handler } = build({ repo });
    const res = await call(handler, req('bills'));
    const latest = res.body.bills[0];
    expect(latest.billDate).toBe('2026-10-03');
    expect(latest.effectiveRatePerKwh).toBeCloseTo(37, 6);
    expect(latest.daysInPeriod).toBe(30);
    expect(latest.daysPresent).toBe(29);
    expect(latest.complete).toBe(false);
    expect(latest.varianceKwh).toBe(3783 - 29 * 126); // still reported, but flagged incomplete
  });

  it('an empty bills table is an empty list, not an error', async () => {
    const { handler } = build({ repo: makeRepo({ bills: async () => [] }) });
    expect((await call(handler, req('bills'))).body).toEqual({ bills: [] });
  });
});

describe('uptime, alarms, telemetry, settings, live', () => {
  it('uptime returns segments only for short ranges', async () => {
    const { handler, repo } = build();
    const short = await call(handler, req('uptime', { from: '2026-10-01', to: '2026-10-07' }));
    expect(short.body.segments).toEqual([]);
    const long = await call(handler, req('uptime', { from: '2026-01-01', to: '2026-10-01' }));
    expect(long.body.segments).toBeNull();
    expect(repo.calls.filter((c) => c[0] === 'segments')).toHaveLength(1);
  });

  it('alarms summarises by code and flags truncation', async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({ alarm_code: i < 2 ? '1011' : '1010', begin_ts: `2026-10-0${i + 1}T00:00:00Z` }));
    const { handler } = build({ repo: makeRepo({ alarms: async () => rows }) });
    const res = await call(handler, req('alarms', { from: '2026-10-01', to: '2026-10-03', limit: '3' }));
    expect(res.body.byCode).toEqual({ 1011: 2, 1010: 1 });
    expect(res.body.truncated).toBe(true);
    expect((await call(handler, req('alarms', { from: '2026-10-01', to: '2026-10-03', limit: '9999' }))).statusCode).toBe(400);
  });

  it('telemetry for today comes live from SolisCloud; past days, or a SolisCloud failure, from the database', async () => {
    // now = 2026-10-03 (Colombo)
    const today = [{ ts: '2026-10-03T05:00:00Z', pac_kw: 21.5 }];
    const stored = [{ ts: '2026-10-02T05:00:00Z', pac_kw: 20 }];
    const live = Object.assign(async () => ({ status: 'online' }), { today: async () => ({ date: '2026-10-03', points: today, fetchedAt: 123 }) });
    const repo = makeRepo({ telemetryDay: async () => stored });
    const { handler } = build({ repo, live });
    expect((await call(handler, req('telemetry', { date: '2026-10-03' }))).body).toMatchObject({ date: '2026-10-03', points: today, source: 'soliscloud', live: true });
    expect((await call(handler, req('telemetry', { date: '2026-10-02' }))).body).toMatchObject({ points: stored, source: 'database', live: false });

    const down = Object.assign(async () => ({ status: 'online' }), { today: async () => { throw new Error('solis down'); } });
    const fallback = build({ repo, live: down });
    expect((await call(fallback.handler, req('telemetry', { date: '2026-10-03' }))).body).toMatchObject({ points: stored, source: 'database', live: true });
    const empty = Object.assign(async () => ({ status: 'online' }), { today: async () => ({ date: '2026-10-03', points: [], fetchedAt: 1 }) });
    expect((await call(build({ repo, live: empty }).handler, req('telemetry', { date: '2026-10-03' }))).body.source).toBe('database');
  });

  it('telemetry needs a valid date', async () => {
    const { handler } = build();
    expect((await call(handler, req('telemetry', { date: '2026-10-02' }))).statusCode).toBe(200);
    expect((await call(handler, req('telemetry', { date: 'yesterday' }))).statusCode).toBe(400);
  });

  it('settings and live are passed through', async () => {
    const { handler } = build({ live: async () => ({ status: 'online', currentPowerKw: 12.5 }) });
    expect((await call(handler, req('settings'))).body.settings.capacityKwp).toBe(41.76);
    expect((await call(handler, req('live'))).body.currentPowerKw).toBe(12.5);
  });

  it('live adds the Colombo date from the server so the browser never decides what today is', async () => {
    const { handler } = build({ live: async () => ({ status: 'online' }) });
    expect((await call(handler, req('live'))).body.todayKey).toBe('2026-10-03');
  });

  it('a live upstream outage surfaces as 502, never a fabricated reading', async () => {
    const { handler } = build({ live: async () => { throw new HttpError(502, 'Live data is temporarily unavailable', 'upstream_unavailable'); } });
    const res = await call(handler, req('live'));
    expect(res.statusCode).toBe(502);
    expect(res.body.code).toBe('upstream_unavailable');
  });
});

describe('totals', () => {
  it('sums only days with a reading, reports missing days, and never turns unknown into 0', async () => {
    const rows = [
      { date: '2026-09-29', kwh: 100, peakKw: 20 },
      { date: '2026-10-01', kwh: 150, peakKw: 25 },
      { date: '2026-10-02', kwh: null, peakKw: null },
      { date: '2026-10-03', kwh: 0, peakKw: 0 }
    ];
    const { handler } = build({ repo: makeRepo({ dailyRows: async () => rows }) });
    const g = (await call(handler, req('totals'))).body.generation;
    expect(g).toEqual({ totalKwh: 250, dayCount: 3, firstDay: '2026-09-29', lastDay: '2026-10-03', missingDays: 2 });
  });

  it('earnings count only bills that carry an earnings figure', async () => {
    const bills = [
      { bill_date: '2026-09-03', units_exported: 100, earnings: 4000 },
      { bill_date: '2026-10-03', units_exported: 100, earnings: null },
      { bill_date: '2026-08-03', units_exported: 100, earnings: 3900 }
    ];
    const { handler } = build({ repo: makeRepo({ bills: async () => bills }) });
    const e = (await call(handler, req('totals'))).body.earnings;
    expect(e).toEqual({ totalLkr: 7900, billCount: 2, billsWithoutEarnings: 1, firstBillDate: '2026-08-03', lastBillDate: '2026-10-03' });
  });

  it('carries the server\'s Colombo date, so pages need not wait on SolisCloud to know which day it is', async () => {
    // now = 2026-10-03T10:00Z = 15:30 in Colombo, same calendar day
    const { handler } = build({ live: async () => { throw new HttpError(502, 'down', 'upstream_unavailable'); } });
    const body = (await call(handler, req('totals'))).body;
    expect(body.todayKey).toBe('2026-10-03');
  });

  it('carries the open bill period from the day after the latest bill, not from the 1st of the month', async () => {
    // today 2026-10-03, latest bill 2026-09-03: the open period is 4 Sep to 3 Oct, reported as September
    const bills = [{ bill_date: '2026-08-03', units_exported: 100, earnings: 3900 }, { bill_date: '2026-09-03', units_exported: 100, earnings: 4000 }];
    const { handler } = build({ repo: makeRepo({ bills: async () => bills, dailyRows: async (from, to) => range(from, to, 120) }) });
    const open = (await call(handler, req('totals'))).body.openPeriod;
    expect(open).toMatchObject({
      status: 'provisional', month: 'Sep', year: 2026, periodStart: '2026-09-04', periodEnd: '2026-10-03',
      lastBillDate: '2026-09-03', daysInPeriod: 30, daysPresent: 30, inverter: 3600
    });
  });

  it('with no data at all every figure is null or zero-count, not a fabricated total', async () => {
    const { handler } = build({ repo: makeRepo({ dailyRows: async () => [], bills: async () => [] }) });
    const body = (await call(handler, req('totals'))).body;
    expect(body.generation).toEqual({ totalKwh: null, dayCount: 0, firstDay: null, lastDay: null, missingDays: 0 });
    expect(body.earnings.totalLkr).toBeNull();
  });
});

describe('export', () => {
  it('daily CSV: attachment, CRLF, empty cell for unknown, safe filename', async () => {
    const repo = makeRepo({ dailyRows: async () => [{ date: '2026-10-01', kwh: 150.2, peakKw: null }, { date: '2026-10-02', kwh: 0, peakKw: 28 }] });
    const { handler } = build({ repo });
    const res = await call(handler, req('export', { kind: 'daily', from: '2026-10-01', to: '2026-10-02' }));
    expect(res.headers['Content-Type']).toMatch(/^text\/csv/);
    expect(res.headers['Content-Disposition']).toBe('attachment; filename="daily_generation_2026-10-01_2026-10-02.csv"');
    expect(res.body).toBe('date,generation_kwh,peak_kw\r\n2026-10-01,150.2,\r\n2026-10-02,0,28\r\n');
  });

  it('alarms CSV neutralises formula injection from upstream text', async () => {
    const repo = makeRepo({ alarms: async () => [{ begin_ts: '2026-10-01T00:00:00Z', end_ts: null, alarm_code: '1011', duration_ms: 300000, level: 1, message: '=cmd|"/c calc"!A1', advice: 'ok' }] });
    const { handler } = build({ repo });
    const res = await call(handler, req('export', { kind: 'alarms', from: '2026-10-01', to: '2026-10-02' }));
    expect(res.body).toContain("\"'=cmd|");
    expect(res.body).toContain(',5,'); // 300000 ms → 5 minutes
  });

  it('rejects an unknown kind', async () => {
    const { handler } = build();
    expect((await call(handler, req('export', { kind: 'passwords', from: '2026-10-01', to: '2026-10-02' }))).statusCode).toBe(400);
  });
});

// ---- live provider ----------------------------------------------------------------------------
describe('live provider', () => {
  const rec = { state: 1, stateExceptionFlag: 0, pac: 12.5, pacStr: 'kW', etoday: 80.5, etodayStr: 'kWh', etotal1: 100970, etotal: 100.97, etotalStr: 'MWh', dataTimestamp: 1790922598529 };

  it('maps units (kW, kWh, total from etotal1) and statuses', () => {
    const m = mapLive(rec, 5);
    expect(m).toMatchObject({ status: 'online', currentPowerKw: 12.5, todayKwh: 80.5, totalKwh: 100970, abnormalOffline: false, stale: false });
    expect(mapLive({ ...rec, state: 2 }, 5).status).toBe('offline');
    expect(mapLive({ ...rec, state: 3, currentState: 1011 }, 5)).toMatchObject({ status: 'alarm', faultCode: 1011 });
    expect(mapLive({ ...rec, state: 2, stateExceptionFlag: 1 }, 5).abnormalOffline).toBe(true);
  });

  it('keeps a measured 0 kW as 0 and an unknown power as null', () => {
    expect(mapLive({ ...rec, pac: 0 }, 5).currentPowerKw).toBe(0);
    expect(mapLive({ ...rec, pac: undefined }, 5).currentPowerKw).toBeNull();
  });

  it('caches within the TTL and collapses concurrent callers into one upstream call', async () => {
    let t = 0;
    const fetchInverter = vi.fn(async () => rec);
    const live = createLiveProvider({ fetchInverter, ttlMs: 60_000, now: () => t });
    await Promise.all([live(), live(), live()]);
    expect(fetchInverter).toHaveBeenCalledTimes(1);
    t = 30_000; await live();
    expect(fetchInverter).toHaveBeenCalledTimes(1);
    t = 61_000; await live();
    expect(fetchInverter).toHaveBeenCalledTimes(2);
  });

  it('serves the last good value marked stale on upstream failure, and 502s when it has none', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let t = 0; let fail = false;
    const live = createLiveProvider({ fetchInverter: async () => { if (fail) throw new Error('503'); return rec; }, ttlMs: 1000, now: () => t });
    const first = await live();
    expect(first.stale).toBe(false);
    fail = true; t = 5000;
    expect((await live()).stale).toBe(true);

    const cold = createLiveProvider({ fetchInverter: async () => { throw new Error('down'); } });
    await expect(cold()).rejects.toMatchObject({ status: 502 });
    spy.mockRestore();
  });

  it('marks where a reading came from: SolisCloud now, or memory when SolisCloud fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let t = 0; let fail = false;
    const live = createLiveProvider({ fetchInverter: async () => { if (fail) throw new Error('503'); return rec; }, ttlMs: 1000, now: () => t });
    expect(await live()).toMatchObject({ stale: false, upstream: 'ok', source: 'soliscloud' });
    fail = true; t = 5000;
    expect(await live()).toMatchObject({ stale: true, upstream: 'unavailable', source: 'memory' });
    spy.mockRestore();
  });
});

describe("live: today's 5-minute points for the day chart", () => {
  const noon = Date.parse('2036-09-10T06:30:00Z');
  const raw = [
    { dataTimestamp: Date.parse('2036-09-10T05:30:00Z'), pac: 20, pacStr: 'kW', state: 1 },
    { dataTimestamp: Date.parse('2036-09-10T05:35:00Z'), pac: 26.34, pacStr: 'kW', state: 1 },
    { dataTimestamp: Date.parse('2036-09-10T05:40:00Z'), pac: undefined, state: 1 }
  ];
  const rec = { state: 1, pac: 12.5, pacStr: 'kW', etoday: 80.5, etodayStr: 'kWh', etotal1: 100970, dataTimestamp: noon };

  it('returns the points as stored telemetry rows, and one SolisCloud read serves both the curve and the peak', async () => {
    const fetchDay = vi.fn(async () => raw);
    const live = createLiveProvider({ fetchInverter: async () => rec, fetchDay, now: () => noon });
    const t = await live.today();
    expect(t.date).toBe('2036-09-10');
    expect(t.points).toEqual([{ ts: '2036-09-10T05:30:00.000Z', pac_kw: 20 }, { ts: '2036-09-10T05:35:00.000Z', pac_kw: 26.34 }]); // unknown power dropped, not 0
    expect((await live()).peakTodayKw).toBe(26.3);
    await live.today();
    expect(fetchDay).toHaveBeenCalledTimes(1); // cached for 5 minutes
  });

  it('null without a day reader or when nothing could be read today', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await createLiveProvider({ fetchInverter: async () => rec, now: () => noon }).today()).toBeNull();
    expect(await createLiveProvider({ fetchInverter: async () => rec, fetchDay: async () => { throw new Error('down'); }, now: () => noon }).today()).toBeNull();
    spy.mockRestore();
  });
});

describe('live: the last saved reading when SolisCloud fails', () => {
  // 2026-11-03 06:30Z = 12:00 Colombo; the job saved a reading at 06:20Z = 11:50
  const noon = Date.parse('2026-11-03T06:30:00Z');
  const savedAt = Date.parse('2026-11-03T06:20:00Z');
  const raw = { state: 1, stateExceptionFlag: 0, pac: 30.1, pacStr: 'kW', etoday: 75.4, etodayStr: 'kWh', etotal1: 104400, dataTimestamp: savedAt };
  const down = async () => { throw new Error('gateway timeout'); };
  let spy;
  beforeEach(() => { spy = vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => spy.mockRestore());

  it('a fresh deployment with nothing in memory serves today\'s saved reading, clearly marked', async () => {
    const live = createLiveProvider({ fetchInverter: down, fetchSaved: async () => ({ raw, savedAtMs: savedAt }), now: () => noon });
    expect(await live()).toMatchObject({
      status: 'online', currentPowerKw: 30.1, todayKwh: 75.4, totalKwh: 104400, dataTimestamp: savedAt,
      stale: true, upstream: 'unavailable', source: 'saved'
    });
  });

  it('never shows an earlier day\'s reading as today: 502 instead', async () => {
    const yesterday = Date.parse('2026-11-02T12:00:00Z');
    const live = createLiveProvider({ fetchInverter: down, fetchSaved: async () => ({ raw: { ...raw, dataTimestamp: yesterday }, savedAtMs: yesterday }), now: () => noon });
    await expect(live()).rejects.toMatchObject({ status: 502, code: 'upstream_unavailable' });
  });

  it('a failing or empty saved-reading lookup still ends in a clean 502', async () => {
    const broken = createLiveProvider({ fetchInverter: down, fetchSaved: async () => { throw new Error('db down'); }, now: () => noon });
    await expect(broken()).rejects.toMatchObject({ status: 502 });
    const empty = createLiveProvider({ fetchInverter: down, fetchSaved: async () => null, now: () => noon });
    await expect(empty()).rejects.toMatchObject({ status: 502 });
  });

  it('when both exist, the newer of memory and saved wins', async () => {
    let t = Date.parse('2026-11-03T04:00:00Z'); let fail = false;
    const early = { ...raw, pac: 12, dataTimestamp: Date.parse('2026-11-03T03:55:00Z') };
    const live = createLiveProvider({
      fetchInverter: async () => { if (fail) throw new Error('down'); return early; },
      fetchSaved: async () => ({ raw, savedAtMs: savedAt }), ttlMs: 1000, now: () => t
    });
    expect((await live()).currentPowerKw).toBe(12);
    fail = true; t = noon;
    expect(await live()).toMatchObject({ source: 'saved', currentPowerKw: 30.1, stale: true });
  });

  it('does not touch the database while SolisCloud answers', async () => {
    const fetchSaved = vi.fn(async () => ({ raw, savedAtMs: savedAt }));
    const live = createLiveProvider({ fetchInverter: async () => raw, fetchSaved, now: () => noon });
    await live();
    expect(fetchSaved).not.toHaveBeenCalled();
  });
});

// ---- wiring smoke test ------------------------------------------------------------------------
describe('route module', () => {
  it('loads (all import paths resolve) and exports a handler', async () => {
    process.env.SUPABASE_URL ||= 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_KEY ||= 'test-key';
    const mod = await import('../api/data/[resource].js');
    expect(typeof mod.default).toBe('function');
  });
});

describe('live peak today', () => {
  const rec = { state: 1, pac: 12.5, pacStr: 'kW', etoday: 80.5, etodayStr: 'kWh', etotal1: 100970, dataTimestamp: 1790922598529 };
  // 2036-09-10 05:30Z = 11:00 Colombo
  const pt = (hhmmZ, kw) => ({ dataTimestamp: Date.parse('2036-09-10T' + hhmmZ + ':00Z'), pac: kw, pacStr: 'kW', state: 1 });
  const dayPoints = [pt('05:30', 20), pt('06:25', 26.34), pt('07:00', 18)];
  const noon = Date.parse('2036-09-10T06:30:00Z');

  it('adds the day peak and its Colombo time to the live reading', async () => {
    const live = createLiveProvider({ fetchInverter: async () => rec, fetchDay: async () => dayPoints, now: () => noon });
    expect(await live()).toMatchObject({ peakTodayKw: 26.3, peakTodayAt: '11:55' });
  });

  it('without a day reader, or when it fails, the peak is unknown and live still works', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const plain = createLiveProvider({ fetchInverter: async () => rec, now: () => noon });
    expect(await plain()).toMatchObject({ status: 'online', peakTodayKw: null, peakTodayAt: null });
    const broken = createLiveProvider({ fetchInverter: async () => rec, fetchDay: async () => { throw new Error('solis down'); }, now: () => noon });
    expect(await broken()).toMatchObject({ status: 'online', peakTodayKw: null, peakTodayAt: null });
    spy.mockRestore();
  });

  it('a day with no readable points has no peak (null, not 0 kW)', async () => {
    const live = createLiveProvider({ fetchInverter: async () => rec, fetchDay: async () => [], now: () => noon });
    expect(await live()).toMatchObject({ peakTodayKw: null, peakTodayAt: null });
  });

  it('does not make the live reading wait for a slow day-read, and uses the result on the next call', async () => {
    let release;
    const slow = new Promise((r) => { release = r; });
    const live = createLiveProvider({ fetchInverter: async () => rec, fetchDay: () => slow.then(() => dayPoints), ttlMs: 0, peakWaitMs: 20, now: () => noon });
    const first = await live(); // returns after ~20 ms with the peak unknown, not after the slow read
    expect(first).toMatchObject({ status: 'online', peakTodayKw: null });
    release();
    await new Promise((r) => setTimeout(r, 10));
    expect(await live()).toMatchObject({ peakTodayKw: 26.3, peakTodayAt: '11:55' });
  });

  it('reuses the peak for 5 minutes and keeps the last one if a refresh fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let t = noon; let fail = false;
    const fetchDay = vi.fn(async () => { if (fail) throw new Error('x'); return dayPoints; });
    const live = createLiveProvider({ fetchInverter: async () => rec, fetchDay, ttlMs: 1000, peakTtlMs: 300_000, now: () => t });
    await live();
    t += 60_000; await live();
    expect(fetchDay).toHaveBeenCalledTimes(1);
    fail = true; t += 400_000;
    expect(await live()).toMatchObject({ peakTodayKw: 26.3 });
    expect(fetchDay).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});
