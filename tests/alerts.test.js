// tests/alerts.test.js
//
// api/_lib/alerts.js, the one alert path (issue #241). Pins the deduplication (an outage is one email on
// open, a reminder at most daily, one on resolve), the daily cap, the idempotency key, that nothing throws,
// and the Supabase store's queries.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  alertConfigFromEnv,
  composeAlertEmail,
  createAlerter,
  createMailer,
  supabaseAlertStore,
  DEFAULT_ALERT_FROM
} from '../api/_lib/alerts.js';

const HOUR = 60 * 60 * 1000;
const T0 = Date.parse('2036-03-01T06:00:00Z');

function memoryStore() {
  const rows = new Map();
  return {
    rows,
    async get(key) { return rows.has(key) ? { ...rows.get(key) } : null; },
    async save(row) { rows.set(row.key, { ...row }); },
    async countSentSince(since) { return [...rows.values()].filter((r) => r.last_sent_at && r.last_sent_at >= since).length; }
  };
}

function setup({ dailyCap } = {}) {
  let t = T0;
  const sendEmail = vi.fn(async () => ({ id: 'em_1' }));
  const mailer = createMailer({ resend: { sendEmail }, from: 'A <a@example.test>', to: 'owner@example.test' });
  const store = memoryStore();
  const alerter = createAlerter({ mailer, store, now: () => t, ...(dailyCap ? { dailyCap } : {}) });
  return { alerter, store, sendEmail, advance: (ms) => { t += ms; } };
}

beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe('alertConfigFromEnv', () => {
  it('falls back to the bill intake address and the default sender', () => {
    const c = alertConfigFromEnv({ RESEND_API_KEY: 'k', BILL_ALERT_TO: ' owner@example.test ' });
    expect(c).toMatchObject({ resendApiKey: 'k', to: 'owner@example.test', from: DEFAULT_ALERT_FROM });
    expect(alertConfigFromEnv({ ALERT_TO: 'x@example.test', BILL_ALERT_TO: 'y@example.test' }).to).toBe('x@example.test');
    expect(alertConfigFromEnv({}).to).toBeNull();
  });
});

describe('composeAlertEmail', () => {
  it('marks the phase in the subject and escapes HTML', () => {
    expect(composeAlertEmail({ phase: 'open', title: 'Site down' }).subject).toBe('[Solar Alert] Site down');
    expect(composeAlertEmail({ phase: 'reminder', title: 'Site down', openedAt: 'x', occurrences: 9 }).text).toContain('9 checks so far');
    const r = composeAlertEmail({ phase: 'resolved', title: 'Site down', lines: ['<b>503</b>'], link: 'https://example.test/a' });
    expect(r.subject).toBe('[Solar Resolved] Site down');
    expect(r.html).toContain('&lt;b&gt;503&lt;/b&gt;');
    expect(r.text).toContain('- <b>503</b>');
    expect(r.text).toContain('More: https://example.test/a');
  });
});

describe('createAlerter', () => {
  it('turns a six-hour outage checked every 15 minutes into two emails', async () => {
    const { alerter, sendEmail, advance } = setup();
    for (let i = 0; i < 24; i++) {
      await alerter.raise('site:ready', { title: 'Site is not ready', lines: ['503'] });
      advance(15 * 60 * 1000);
    }
    expect(sendEmail).toHaveBeenCalledTimes(1);
    await alerter.resolve('site:ready');
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail.mock.calls.map(([m]) => m.subject)).toEqual(['[Solar Alert] Site is not ready', '[Solar Resolved] Site is not ready']);
  });

  it('counts occurrences and reminds at most once a day while open', async () => {
    const { alerter, store, sendEmail, advance } = setup();
    await alerter.raise('k', { title: 'T' });
    advance(23 * HOUR);
    expect((await alerter.raise('k', { title: 'T' })).reason).toBe('deduplicated');
    advance(1 * HOUR);
    const r = await alerter.raise('k', { title: 'T' });
    expect(r).toMatchObject({ phase: 'reminder', sent: true });
    expect(store.rows.get('k').occurrences).toBe(3);
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it('opens again after it was resolved', async () => {
    const { alerter, sendEmail, advance } = setup();
    await alerter.raise('k', { title: 'T' });
    await alerter.resolve('k', { quiet: true });
    advance(HOUR);
    const r = await alerter.raise('k', { title: 'T' });
    expect(r.phase).toBe('open');
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it('resolve is a no-op for a key that is not open', async () => {
    const { alerter, sendEmail } = setup();
    expect(await alerter.resolve('never')).toMatchObject({ sent: false, reason: 'not_open' });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('stops emailing at the daily cap but still records the alert', async () => {
    const { alerter, store, sendEmail } = setup({ dailyCap: 2 });
    for (const k of ['a', 'b', 'c']) await alerter.raise(k, { title: k });
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(store.rows.get('c')).toMatchObject({ status: 'open', last_sent_at: null });
  });

  it('uses one idempotency key per opening, so concurrent checks send once', async () => {
    const { alerter, sendEmail } = setup();
    await alerter.raise('k', { title: 'T' });
    const [, key] = sendEmail.mock.calls[0];
    expect(key).toMatch(/^alert:k:\d+:open$/);
  });

  it('never throws: a failed send or a broken store is reported, not raised', async () => {
    const failing = createMailer({ resend: { sendEmail: async () => { throw new Error('Resend 500'); } }, from: 'f', to: 't' });
    const store = memoryStore();
    const a = createAlerter({ mailer: failing, store, now: () => T0 });
    expect(await a.raise('k', { title: 'T' })).toMatchObject({ sent: false, reason: 'send_failed' });
    expect(store.rows.get('k').last_sent_at).toBeNull(); // so the next check tries again as a reminder

    const broken = { get: async () => { throw new Error('relation "alert_state" does not exist'); } };
    const b = createAlerter({ mailer: failing, store: broken, now: () => T0 });
    expect(await b.raise('k', { title: 'T' })).toMatchObject({ sent: false, reason: 'state_failed' });
    expect(await b.resolve('k')).toMatchObject({ sent: false, reason: 'state_failed' });
  });

  it('reports a missing mail configuration as a failed send', async () => {
    const a = createAlerter({ mailer: createMailer({ resend: null, from: 'f', to: null }), store: memoryStore(), now: () => T0 });
    const r = await a.raise('k', { title: 'T' });
    expect(r).toMatchObject({ sent: false, reason: 'send_failed' });
    expect(r.error).toContain('not configured');
  });
});

describe('supabaseAlertStore', () => {
  it('reads, upserts and counts through the alert_state table', async () => {
    const calls = [];
    const chain = (result) => {
      const q = new Proxy({}, {
        get(_, prop) {
          if (prop === 'then') return (res) => res(result);
          return (...args) => { calls.push([prop, ...args]); return q; };
        }
      });
      return q;
    };
    const db = { from: (t) => { calls.push(['from', t]); return chain({ data: { key: 'k' }, count: 3, error: null }); } };
    const store = supabaseAlertStore(db);
    expect(await store.get('k')).toEqual({ key: 'k' });
    await store.save({ key: 'k' });
    expect(await store.countSentSince('2036-01-01T00:00:00Z')).toBe(3);
    expect(calls).toContainEqual(['eq', 'key', 'k']);
    expect(calls).toContainEqual(['upsert', { key: 'k' }, { onConflict: 'key' }]);
    expect(calls).toContainEqual(['gte', 'last_sent_at', '2036-01-01T00:00:00Z']);
    expect(calls.filter((c) => c[0] === 'from').every((c) => c[1] === 'alert_state')).toBe(true);
  });

  it('throws a named error the alerter turns into state_failed', async () => {
    const db = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'boom' } }) }) }) }) };
    await expect(supabaseAlertStore(db).get('k')).rejects.toThrow('alert_state read failed: boom');
  });
});
