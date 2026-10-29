// tests/log.test.js — the audit line every privileged API action emits.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { audit, actorOf, requestIdOf, withRequestLog } from '../api/_lib/log.js';

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
