// tests/log.test.js — the audit line every privileged API action emits.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { audit, actorOf, requestIdOf, withRequestLog, setLogSink, waitUntilOf, isMissingTable } from '../api/_lib/log.js';

afterEach(() => vi.restoreAllMocks());

describe('audit()', () => {
  it('emits one [AUDIT] line of parseable JSON with who, what and to what', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const req = { headers: { 'x-vercel-id': 'bom1::abc' } };
    const actor = actorOf({ id: 'user_1', emailAddresses: [{ emailAddress: 'a@example.com' }] });

    audit(req, {
      action: 'user.update',
      actor,
      target: { userId: 'user_2' },
      changes: { role: { from: 'user', to: 'admin' } }
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const [tag, line] = spy.mock.calls[0];
    expect(tag).toBe('[AUDIT]');
    const entry = JSON.parse(line);
    expect(entry).toMatchObject({
      type: 'audit',
      requestId: 'bom1::abc',
      action: 'user.update',
      actor: { id: 'user_1' },
      target: { userId: 'user_2' },
      changes: { role: { from: 'user', to: 'admin' } }
    });
    expect(Number.isNaN(Date.parse(entry.at))).toBe(false);
  });

  it('never logs the actor\'s e-mail address', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    audit({}, { action: 'x', actor: actorOf({ id: 'user_1', emailAddresses: [{ emailAddress: 'a@example.com' }] }) });
    expect(spy.mock.calls[0][1]).not.toContain('a@example.com');
  });

  it('tolerates a request without headers', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(requestIdOf({})).toBeNull();
    expect(actorOf({ id: 'user_1' })).toEqual({ id: 'user_1' });
    expect(audit(undefined, { action: 'x', actor: actorOf(null) }).requestId).toBeNull();
  });
});

describe('withRequestLog()', () => {
  it('logs one [REQUEST] line when the response finishes, with status, latency and actor', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const req = { method: 'PUT', headers: { 'x-vercel-id': 'bom1::r1' } };
    const res = Object.assign(new EventEmitter(), { statusCode: 200 });

    const handler = withRequestLog('ceb-bills/records', async (rq, rs) => {
      rq.adminUser = { id: 'user_9' }; // what verifyAdminToken sets
      rs.statusCode = 403;
    });

    await handler(req, res);
    expect(spy).not.toHaveBeenCalled(); // nothing until the response is done
    res.emit('finish');

    expect(spy).toHaveBeenCalledTimes(1);
    const [tag, line] = spy.mock.calls[0];
    expect(tag).toBe('[REQUEST]');
    expect(JSON.parse(line)).toMatchObject({
      type: 'request',
      requestId: 'bom1::r1',
      route: 'ceb-bills/records',
      method: 'PUT',
      status: 403,
      actor: 'user_9'
    });
  });

  it('passes the handler result through and tolerates a response that is not an emitter', async () => {
    const handler = withRequestLog('x', async () => 'done');
    await expect(handler({ method: 'GET', headers: {} }, {})).resolves.toBe('done');
  });
});

describe('withRequestLog() with a derived route', () => {
  it('names the route from the request, bounded in length', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = Object.assign(new EventEmitter(), { statusCode: 200 });
    const handler = withRequestLog((req) => `data/${req.query.resource}`, async () => {});

    await handler({ method: 'GET', headers: {}, query: { resource: 'live' } }, res);
    res.emit('finish');
    expect(JSON.parse(spy.mock.calls[0][1]).route).toBe('data/live');

    const res2 = Object.assign(new EventEmitter(), { statusCode: 404 });
    await handler({ method: 'GET', headers: {}, query: { resource: 'x'.repeat(500) } }, res2);
    res2.emit('finish');
    expect(JSON.parse(spy.mock.calls[1][1]).route.length).toBeLessThanOrEqual(60);
  });
});

describe('durable copies (#241)', () => {
  afterEach(() => setLogSink(null));

  it('copies a [REQUEST] line to request_log and an [AUDIT] line to admin_audit_log', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const rows = [];
    setLogSink((table, row) => { rows.push([table, row]); return Promise.resolve(); });

    const res = Object.assign(new EventEmitter(), { statusCode: 200 });
    const handler = withRequestLog('data/live', async (rq, rs) => {
      rq.authUser = { id: 'user_3' };
      rq.accessLevel = 'viewer';
      rs.statusCode = 502;
    });
    await handler({ method: 'GET', headers: { 'x-vercel-id': 'bom1::q' } }, res);
    res.emit('finish');
    audit({ headers: {} }, { action: 'setting.update', actor: actorOf({ id: 'user_1' }), target: { setting: 'rate' }, changes: { from: 1, to: 2 } });

    expect(rows[0]).toEqual(['request_log', expect.objectContaining({
      request_id: 'bom1::q', route: 'data/live', method: 'GET', status: 502, actor: 'user_3', access_level: 'viewer'
    })]);
    expect(rows[0][1].latency_ms).toBeGreaterThanOrEqual(0);
    expect(rows[1]).toEqual(['admin_audit_log', expect.objectContaining({
      action: 'setting.update', actor_id: 'user_1', target: { setting: 'rate' }, changes: { from: 1, to: 2 }
    })]);
  });

  it('hands the write to Vercel waitUntil when there is a request context', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const waitUntil = vi.fn();
    const key = Symbol.for('@vercel/request-context');
    globalThis[key] = { get: () => ({ waitUntil }) };
    try {
      expect(waitUntilOf()).toBe(waitUntil);
      setLogSink(() => Promise.resolve());
      audit({}, { action: 'x', actor: actorOf(null) });
      expect(waitUntil).toHaveBeenCalledTimes(1);
      expect(typeof waitUntil.mock.calls[0][0].then).toBe('function');
    } finally {
      delete globalThis[key];
    }
    expect(waitUntilOf()).toBeNull();
  });

  it('never fails the request: a throwing or rejecting sink is swallowed', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setLogSink(() => { throw new Error('boom'); });
    expect(() => audit({}, { action: 'x', actor: actorOf(null) })).not.toThrow();
    expect(warn).toHaveBeenCalled();
    setLogSink(() => Promise.reject(new Error('later')));
    expect(() => audit({}, { action: 'x', actor: actorOf(null) })).not.toThrow();
  });

  it('does not write outside a Vercel deployment', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const before = process.env.VERCEL;
    delete process.env.VERCEL;
    try {
      // default sink: returns null (no write) when VERCEL is not "1"
      expect(() => audit({}, { action: 'x', actor: actorOf(null) })).not.toThrow();
    } finally {
      if (before !== undefined) process.env.VERCEL = before;
    }
  });

  it('recognises a missing table, so an unapplied migration warns once and stops trying', () => {
    expect(isMissingTable({ code: '42P01' })).toBe(true);
    expect(isMissingTable({ code: 'PGRST205', message: "Could not find the table 'public.request_log'" })).toBe(true);
    expect(isMissingTable({ code: '23505', message: 'duplicate key' })).toBe(false);
    expect(isMissingTable(null)).toBe(false);
  });
});
