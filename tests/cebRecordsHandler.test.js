// tests/cebRecordsHandler.test.js
//
// Handler-level tests for /api/ceb-bills/records, with the admin check and the database
// replaced by fakes. They pin the things that matter most about this endpoint: nothing touches
// the database before the caller is authenticated, bad input never reaches it, approval is one
// RPC call, and a database that lacks the RPC still works (with a warning) rather than failing.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const verifyAdminToken = vi.fn();
const rpc = vi.fn();
const from = vi.fn();

vi.mock('../api/_lib/verifyAdminToken.js', () => ({ verifyAdminToken }));
vi.mock('../api/_lib/supabaseServer.js', () => ({
  supabase: { from, rpc },
  blockOnConfigProblem: () => false
}));

const { default: handler } = await import('../api/ceb-bills/records.js');

const admin = { id: 'user_admin', emailAddresses: [{ emailAddress: 'admin@example.test' }] };

function mockRes() {
  return {
    headers: {},
    statusCode: null,
    body: null,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    }
  };
}

const req = (method, body) => ({ method, headers: { origin: 'https://solaredge.anujajay.com' }, body });

const validRecord = { bill_date: '2026-09-03', meter_reading: 97597, units_exported: 4007, earnings: 148259 };
const ids = {
  extractionId: '123e4567-e89b-12d3-a456-426614174000',
  ingestionId: '223e4567-e89b-12d3-a456-426614174000'
};

beforeEach(() => {
  vi.clearAllMocks();
  verifyAdminToken.mockResolvedValue(admin);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('authentication comes first', () => {
  it('does not touch the database when the caller is not an admin', async () => {
    verifyAdminToken.mockResolvedValue(null); // verifyAdminToken has already sent the 401/403
    for (const method of ['GET', 'POST', 'PATCH', 'PUT']) {
      await handler(req(method, {}), mockRes());
    }
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects a method the endpoint does not implement', async () => {
    const res = mockRes();
    await handler(req('DELETE', {}), res);
    expect(res.statusCode).toBe(405);
    expect(verifyAdminToken).not.toHaveBeenCalled();
  });
});

describe('GET — the admin table', () => {
  it('returns every column of every row, newest first', async () => {
    const rows = [{ id: 2, bill_date: '2026-09-03', account_number: '0000000000', file_path: 'ceb/x.pdf' }];
    const order = vi.fn().mockResolvedValue({ data: rows, error: null });
    const select = vi.fn(() => ({ order }));
    from.mockReturnValue({ select });

    const res = mockRes();
    await handler(req('GET'), res);

    expect(from).toHaveBeenCalledWith('ceb_data');
    expect(select).toHaveBeenCalledWith('*');
    expect(order).toHaveBeenCalledWith('bill_date', { ascending: false });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ records: rows });
  });

  it('answers with an empty list rather than null when there are no rows', async () => {
    from.mockReturnValue({ select: () => ({ order: () => Promise.resolve({ data: null, error: null }) }) });
    const res = mockRes();
    await handler(req('GET'), res);
    expect(res.body).toEqual({ records: [] });
  });

  it('hides the database error from the caller', async () => {
    from.mockReturnValue({
      select: () => ({ order: () => Promise.resolve({ data: null, error: { message: 'relation "secret" ...' } }) })
    });
    const res = mockRes();
    await handler(req('GET'), res);
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/secret/);
  });
});

describe('PUT — approve a parsed bill', () => {
  it('rejects an invalid record before calling the database', async () => {
    const res = mockRes();
    await handler(req('PUT', { ...ids, record: { ...validRecord, bill_date: '2026-02-31' } }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.details).toContain('bill_date must be a valid YYYY-MM-DD date');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('requires an extraction id', async () => {
    const res = mockRes();
    await handler(req('PUT', { record: validRecord }), res);
    expect(res.statusCode).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('approves through ONE transactional RPC call', async () => {
    rpc.mockResolvedValue({ error: null });
    const res = mockRes();
    await handler(req('PUT', { ...ids, record: validRecord }), res);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('approve_ceb_extraction', {
      p_extraction_id: ids.extractionId,
      p_ingestion_id: ids.ingestionId,
      p_record: validRecord
    });
    expect(from).not.toHaveBeenCalled(); // no separate, non-atomic writes
    expect(res.statusCode).toBe(200);
    expect(res.body.approved).toBe(true);
  });

  it('reports a failed approval without leaking the database message', async () => {
    rpc.mockResolvedValue({ error: { code: 'P0002', message: 'extraction abc not found for ingestion def' } });
    const res = mockRes();
    await handler(req('PUT', { ...ids, record: validRecord }), res);
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/not found for ingestion/);
    expect(from).not.toHaveBeenCalled(); // an RPC failure must NOT fall back to partial writes
  });

  it('falls back to sequential writes, in order, while the function is not installed', async () => {
    rpc.mockResolvedValue({ error: { code: 'PGRST202', message: 'Could not find the function' } });
    const order = [];
    from.mockImplementation((table) => ({
      upsert: (rows, opts) => {
        order.push(`${table}.upsert`);
        expect(opts).toEqual({ onConflict: 'account_number, billing_month' });
        return Promise.resolve({ error: null });
      },
      update: (values) => ({
        eq: () => {
          order.push(`${table}.update:${values.review_status || values.status}`);
          return Promise.resolve({ error: null });
        }
      })
    }));

    const res = mockRes();
    await handler(req('PUT', { ...ids, record: validRecord }), res);

    expect(order).toEqual([
      'ceb_data.upsert',
      'ceb_bill_extractions.update:approved',
      'ceb_bill_ingestions.update:approved'
    ]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('approve_ceb_extraction() is not installed'));
    expect(res.statusCode).toBe(200);
  });
});

describe('POST — manual entry', () => {
  it('rejects a record with a missing figure', async () => {
    const res = mockRes();
    await handler(req('POST', { record: { bill_date: '2026-09-03', meter_reading: 1, earnings: 1 } }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.details).toContain('units_exported is required');
    expect(from).not.toHaveBeenCalled();
  });
});
