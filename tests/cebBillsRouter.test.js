// tests/cebBillsRouter.test.js
//
// api/ceb-bills/[action].js serves the bill endpoints (the six admin ones and the email webhook) from one function. These tests pin
// that each URL still reaches its own handler, that anything else is a 404, and that a handler
// is loaded only when its action is called (a queue read must not load the PDF parser).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const loaded = new Set();
const calls = [];

function fakeModule(name) {
  loaded.add(name);
  return {
    default: async (req, res) => {
      calls.push(name);
      return res.status(200).json({ handledBy: name });
    }
  };
}

vi.mock('../api/_lib/cebBills/upload.js', () => fakeModule('upload'));
vi.mock('../api/_lib/cebBills/extract.js', () => fakeModule('extract'));
vi.mock('../api/_lib/cebBills/ingestions.js', () => fakeModule('ingestions'));
vi.mock('../api/_lib/cebBills/signed-url.js', () => fakeModule('signed-url'));
vi.mock('../api/_lib/cebBills/records.js', () => fakeModule('records'));
vi.mock('../api/_lib/cebBills/delete.js', () => fakeModule('delete'));
vi.mock('../api/_lib/cebBills/inbound.js', () => fakeModule('inbound'));

const { default: router, CEB_BILL_ACTIONS } = await import('../api/ceb-bills/[action].js');

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

beforeEach(() => { calls.length = 0; });

describe('ceb-bills router', () => {
  it('serves exactly the six admin URLs and the email webhook', () => {
    expect([...CEB_BILL_ACTIONS].sort()).toEqual(['delete', 'extract', 'inbound', 'ingestions', 'records', 'signed-url', 'upload']);
  });

  it('loads only the handler that is called', async () => {
    await router({ method: 'GET', query: { action: 'ingestions', view: 'queue' } }, mockRes());
    expect(loaded.has('ingestions')).toBe(true);
    expect(loaded.has('extract')).toBe(false);
  });

  it.each(['upload', 'extract', 'ingestions', 'signed-url', 'records', 'delete', 'inbound'])('sends /api/ceb-bills/%s to its own handler', async (action) => {
    const res = mockRes();
    await router({ method: 'POST', query: { action } }, res);
    expect(calls).toEqual([action]);
    expect(res.body).toEqual({ handledBy: action });
  });

  it.each([
    ['an unknown action', 'approve'],
    ['an inherited object key', 'constructor'],
    ['a prototype key', '__proto__'],
    ['a repeated query value', ['records', 'delete']],
    ['no action', undefined]
  ])('answers 404 for %s, and calls no handler', async (_label, action) => {
    const res = mockRes();
    await router({ method: 'GET', query: { action } }, res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Unknown bill endpoint' });
    expect(calls).toEqual([]);
  });
});
