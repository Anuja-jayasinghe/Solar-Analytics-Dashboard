// tests/dataApi.test.js
//
// The v3 read API end to end, with a fake repository and a fake auth: access control, validation,
// rate limiting, caching headers, error hygiene, and the correctness of each resource's output.

import { describe, it, expect, vi } from 'vitest';
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
