// tests/watch.test.js
//
// The watchdog (#241): the daytime live-freshness rule, each check's raise/resolve decision, that one
// broken check does not stop the others, and the endpoint's secret handling.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { evaluateLiveFreshness } from '../shared/domain/freshness.js';
import { runChecks, isAuthorized, createWatchHandler, API_5XX_THRESHOLD } from '../api/_lib/ops/watch.js';
import { createAlerter, createMailer } from '../api/_lib/alerts.js';
import { operatingWindow, localDateKey } from '../shared/domain/time.js';

const MIN = 60_000;
// 2036-03-02 12:00 Colombo (06:30 UTC): well inside the operating window.
const NOON = Date.parse('2036-03-02T06:30:00Z');
const WIN = operatingWindow(localDateKey(NOON));

beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe('evaluateLiveFreshness', () => {
  const iso = (ms) => new Date(ms).toISOString();

  it('is ok within the limit and stale beyond it, in daylight', () => {
    expect(evaluateLiveFreshness({ latestIso: iso(NOON - 20 * MIN), nowMs: NOON, window: WIN }).state).toBe('ok');
    const v = evaluateLiveFreshness({ latestIso: iso(NOON - 90 * MIN), nowMs: NOON, window: WIN });
    expect(v).toMatchObject({ state: 'stale', ageMinutes: 90 });
    expect(v.reason).toContain('90 minutes old');
  });

  it('does not judge at night', () => {
    const night = WIN.endMs + 120 * MIN;
    expect(evaluateLiveFreshness({ latestIso: iso(NOON), nowMs: night, window: WIN }).state).toBe('night');
    expect(evaluateLiveFreshness({ latestIso: null, nowMs: NOON, window: null }).state).toBe('night');
  });

  it('does not count the night: the clock starts at the window', () => {
    const lastEvening = WIN.startMs - 12 * 60 * MIN;
    expect(evaluateLiveFreshness({ latestIso: iso(lastEvening), nowMs: WIN.startMs + 30 * MIN, window: WIN }).state).toBe('ok');
    expect(evaluateLiveFreshness({ latestIso: iso(lastEvening), nowMs: WIN.startMs + 61 * MIN, window: WIN }).state).toBe('stale');
    expect(evaluateLiveFreshness({ latestIso: null, nowMs: WIN.startMs + 61 * MIN, window: WIN }).reason).toContain('no live reading at all');
  });
});

function memoryStore() {
  const rows = new Map();
  return {
    rows,
    async get(k) { return rows.has(k) ? { ...rows.get(k) } : null; },
    async save(r) { rows.set(r.key, { ...r }); },
    async countSentSince(since) { return [...rows.values()].filter((r) => r.last_sent_at && r.last_sent_at >= since).length; },
    async listOpen() { return [...rows.values()].filter((r) => r.status === 'open'); }
  };
}

function healthyRepo(over = {}) {
  return {
    latestLiveTimestamp: async () => new Date(NOON - 10 * MIN).toISOString(),
    latestRunPerJob: async () => [{ job: 'telemetry', status: 'ok', started_at: '2036-03-01T18:45:00Z' }],
    server5xxSince: async () => [],
    errorGroupsFirstSeenSince: async () => [],
    ...over
  };
}

function setup(repo, nowMs = NOON) {
  const sendEmail = vi.fn(async () => ({ id: 'em' }));
  const store = memoryStore();
  let t = nowMs;
  const alerter = createAlerter({ mailer: createMailer({ resend: { sendEmail }, from: 'f', to: 'owner@example.test' }), store, now: () => t });
  const run = () => runChecks({ repo, alerter, store, nowMs: t, appUrl: 'https://app.test' });
  return { run, sendEmail, store, advance: (ms) => { t += ms; } };
}

describe('runChecks', () => {
  it('sends nothing when everything is healthy', async () => {
    const { run, sendEmail } = setup(healthyRepo());
    const checks = await run();
    expect(checks.map((c) => [c.key, c.action])).toEqual([
      ['data:live-stale', 'ok'], ['collector:failed', 'ok'], ['api:5xx-rate', 'ok'], ['error:new', 'ok']
    ]);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('stale live data: one email, then deduplicated, then one on recovery', async () => {
    let latest = new Date(NOON - 3 * 60 * MIN).toISOString();
    const { run, sendEmail, advance } = setup(healthyRepo({ latestLiveTimestamp: async () => latest }));
    await run(); advance(15 * MIN); await run(); advance(15 * MIN);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].subject).toBe('[Solar Alert] Live inverter data has stopped');
    latest = new Date(NOON + 25 * MIN).toISOString();
    const checks = await run();
    expect(checks[0]).toMatchObject({ key: 'data:live-stale', action: 'resolve', sent: true });
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it('a failed collector job raises, naming the job and its error', async () => {
    const { run, sendEmail } = setup(healthyRepo({ latestRunPerJob: async () => [{ job: 'telemetry', status: 'failed', started_at: 'x', error: 'SolisCloud 401' }] }));
    await run();
    const [msg] = sendEmail.mock.calls[0];
    expect(msg.subject).toContain('Collector job "telemetry" failed');
    expect(msg.text).toContain('SolisCloud 401');
  });

  it('API errors raise only at the threshold', async () => {
    const rows = (n) => Array.from({ length: n }, () => ({ route: 'data/live', status: 500 }));
    const few = setup(healthyRepo({ server5xxSince: async () => rows(API_5XX_THRESHOLD - 1) }));
    await few.run();
    expect(few.sendEmail).not.toHaveBeenCalled();
    const many = setup(healthyRepo({ server5xxSince: async () => rows(API_5XX_THRESHOLD) }));
    await many.run();
    expect(many.sendEmail.mock.calls[0][0].text).toContain(`data/live: ${API_5XX_THRESHOLD}`);
  });

  it('a new error group is emailed once and closed quietly a day later', async () => {
    const group = { fingerprint: 'abc', source: 'browser', message: 'boom', route: '/explore', release: '3.5.0', occurrences: 2, first_seen_at: 'x' };
    let groups = [group];
    const { run, sendEmail, store, advance } = setup(healthyRepo({ errorGroupsFirstSeenSince: async () => groups }));
    await run(); advance(15 * MIN); await run();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].subject).toBe('[Solar Alert] New browser error: boom');
    groups = [];
    advance(25 * 60 * MIN);
    await run();
    expect(store.rows.get('error:abc').status).toBe('resolved');
    // quiet: still only the one error email (the live check, a day on with a fixed reading, emails separately)
    expect(sendEmail.mock.calls.filter(([m]) => m.subject.includes('error'))).toHaveLength(1);
  });

  it('one failing check does not stop the others', async () => {
    const { run } = setup(healthyRepo({ latestLiveTimestamp: async () => { throw new Error('inverter_data_live: timeout'); } }));
    const checks = await run();
    expect(checks[0]).toMatchObject({ key: 'data:live-stale', action: 'error', detail: 'inverter_data_live: timeout' });
    expect(checks).toHaveLength(4);
  });

  it('skips the live check at night', async () => {
    const { run } = setup(healthyRepo({ latestLiveTimestamp: async () => null }), WIN.endMs + 3 * 60 * MIN);
    expect((await run())[0]).toMatchObject({ key: 'data:live-stale', action: 'skip' });
  });
});

describe('POST /api/ops/watch', () => {
  function mockRes() {
    const res = { statusCode: 200, headers: {} };
    res.setHeader = (k, v) => { res.headers[k] = v; };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    res.end = () => res;
    return res;
  }

  it('compares the secret in constant time and refuses anything else', () => {
    expect(isAuthorized('Bearer s3cret', 's3cret')).toBe(true);
    expect(isAuthorized('Bearer s3cre', 's3cret')).toBe(false);
    expect(isAuthorized('s3cret', 's3cret')).toBe(false);
    expect(isAuthorized(undefined, 's3cret')).toBe(false);
    expect(isAuthorized('Bearer ', '')).toBe(false);
  });

  it('503 without a configured secret, 401 with a wrong one', async () => {
    const h1 = createWatchHandler({ env: {} });
    const r1 = mockRes();
    await h1({ method: 'POST', headers: { authorization: 'Bearer x' } }, r1);
    expect(r1.statusCode).toBe(503);
    const h2 = createWatchHandler({ env: { OPS_WATCH_SECRET: 'right' } });
    const r2 = mockRes();
    await h2({ method: 'POST', headers: { authorization: 'Bearer wrong' } }, r2);
    expect(r2.statusCode).toBe(401);
  });

  it('runs the checks with the right secret and reports them', async () => {
    const chain = (result) => new Proxy({}, { get: (_, p) => (p === 'then' ? (res) => res(result) : () => chain(result)) });
    const db = { from: () => chain({ data: [], error: null, count: 0 }) };
    const h = createWatchHandler({ env: { OPS_WATCH_SECRET: 'right' }, db, mailer: createMailer({ resend: null, from: 'f', to: null }), now: () => NOON });
    const res = mockRes();
    await h({ method: 'POST', headers: { authorization: 'Bearer right' } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.checks.map((c) => c.key)).toEqual(['data:live-stale', 'collector:failed', 'api:5xx-rate', 'error:new']);
  });
});
