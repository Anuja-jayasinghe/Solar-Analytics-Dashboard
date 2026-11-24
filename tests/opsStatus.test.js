// tests/opsStatus.test.js — GET /api/ops/status (Admin → Health, #241) and the rows the tab draws from it.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createStatusHandler, readStatus } from '../api/_lib/ops/status.js';
import { alertItems, errorItems, localStamp, runItems, sectionProblem } from '../src/v3/admin/health.js';

afterEach(() => vi.restoreAllMocks());

function fakeDb(byTable) {
  return {
    from(table) {
      const result = byTable[table];
      const q = new Proxy({}, { get: (_, p) => (p === 'then' ? (res, rej) => (result instanceof Error ? rej(result) : res(result)) : () => q) });
      return q;
    }
  };
}

function mockRes() {
  const res = { statusCode: 200, headers: {} };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.end = () => res;
  return res;
}

describe('readStatus', () => {
  it('reads each section on its own: rows, not set up, or failed', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = await readStatus(fakeDb({
      collector_runs: { data: [{ id: 1, job: 'telemetry', status: 'failed', error: 'x'.repeat(500) }], error: null },
      alert_state: { data: null, error: { code: '42P01', message: 'relation "public.alert_state" does not exist' } },
      error_events: new Error('network')
    }));
    expect(out.runs.rows[0].error).toHaveLength(200);
    expect(out.alerts).toEqual({ rows: null, problem: 'not_set_up' });
    expect(out.errors).toEqual({ rows: null, problem: 'failed' });
  });
});

describe('GET /api/ops/status', () => {
  it('is admin only', async () => {
    const verify = vi.fn(async (_req, res) => { res.status(403).json({ error: 'Forbidden - Admins only' }); return null; });
    const res = mockRes();
    await createStatusHandler({ verify, db: fakeDb({}) })({ method: 'GET', headers: {} }, res);
    expect(res.statusCode).toBe(403);
  });

  it('answers the three sections, never cached', async () => {
    const ok = { data: [], error: null };
    const res = mockRes();
    await createStatusHandler({ verify: async () => ({ id: 'user_admin' }), db: fakeDb({ collector_runs: ok, alert_state: ok, error_events: ok }) })({ method: 'GET', headers: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ runs: { rows: [] }, alerts: { rows: [] }, errors: { rows: [] } });
    expect(res.headers['Cache-Control']).toBe('private, no-store');
  });
});

describe('Admin → Health monitoring rows', () => {
  it('shows times in Colombo', () => {
    expect(localStamp('2036-03-02T00:30:00Z')).toBe('2036-03-02 06:00');
    expect(localStamp(null)).toBe('—');
  });

  it('a run that wrote nothing is not shown as good', () => {
    const items = runItems([
      { id: 1, job: 'telemetry', status: 'ok', started_at: '2036-03-01T18:45:00Z', points_written: 288, alarms_written: 0, days_derived: 7 },
      { id: 2, job: 'telemetry', status: 'empty', started_at: '2036-02-28T18:45:00Z' },
      { id: 3, job: 'backfill', status: 'failed', started_at: '2036-02-27T18:45:00Z', error: 'SolisCloud 401' }
    ]);
    expect(items.map((i) => i.tone)).toEqual(['good', 'warn', 'bad']);
    expect(items[0]).toMatchObject({ label: 'telemetry · 2036-03-02 00:15', tip: 'Wrote 288 points, 7 days.' });
    expect(items[1].tip).toBe('Wrote nothing.');
    expect(items[2].tip).toBe('Error: SolisCloud 401');
  });

  it('alerts and errors', () => {
    expect(alertItems([{ key: 'data:live-stale', title: 'Live inverter data has stopped', opened_at: '2036-03-02T04:30:00Z', occurrences: 3, last_sent_at: '2036-03-02T04:30:00Z' }])[0])
      .toMatchObject({ label: 'Live inverter data has stopped', value: 'since 2036-03-02 10:00', tone: 'bad' });
    const e = errorItems([{ fingerprint: 'f', source: 'api', message: 'm'.repeat(100), route: 'data/live', release: 'abc', occurrences: 4, first_seen_at: null, last_seen_at: null }])[0];
    expect(e.label.startsWith('API: ')).toBe(true);
    expect(e.label.length).toBeLessThanOrEqual(75);
    expect(e.value).toBe('4×');
  });

  it('explains a section that is not set up', () => {
    expect(sectionProblem({ rows: [] })).toBeNull();
    expect(sectionProblem({ rows: null, problem: 'not_set_up' })).toContain('migration has not been applied');
    expect(sectionProblem({ rows: null, problem: 'failed' })).toBe('Could not be read right now.');
  });
});
