// tests/billIntake.test.js
//
// api/_lib/billIntake.js against a fake database and a fake PDF reader. These pin the parts that
// protect data: a duplicate lookup that fails throws (never "no duplicate"), a row that cannot be
// written removes its file again, a new extraction is saved BEFORE the old ones are removed, and
// reading a bill writes nothing at all (the email path depends on that to discard home bills).

import { describe, it, expect, vi } from 'vitest';
import { createBillIntake, extractionRow, pdfProblem } from '../api/_lib/billIntake.js';

/** A fake Supabase client. `results[table][op]` is what the chain resolves to; every call is logged. */
function fakeDb(results = {}) {
  const log = [];
  const storageLog = [];
  const resultFor = (table, op) => results[table]?.[op] ?? { data: null, error: null };

  function builder(table) {
    let op = 'select';
    const chain = {};
    for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'order', 'limit']) {
      chain[m] = (...args) => {
        // The first write verb decides which result the chain resolves to (`.insert().select()` is an insert).
        if (['insert', 'update', 'delete'].includes(m)) op = m;
        log.push({ table, m, args });
        return chain;
      };
    }
    chain.maybeSingle = async () => resultFor(table, op);
    chain.single = async () => resultFor(table, op);
    chain.then = (resolve, reject) => Promise.resolve(resultFor(table, op)).then(resolve, reject);
    return chain;
  }

  const storage = {
    from: (bucket) => ({
      upload: async (path, buffer, opts) => { storageLog.push({ m: 'upload', bucket, path, opts }); return results.storage?.upload ?? { error: null }; },
      remove: async (paths) => { storageLog.push({ m: 'remove', bucket, paths }); return { error: null }; },
      download: async (path) => { storageLog.push({ m: 'download', bucket, path }); return results.storage?.download ?? { data: null, error: { message: 'missing' } }; }
    })
  };

  return { db: { from: (t) => builder(t), storage }, log, storageLog };
}

const PDF = Buffer.from('%PDF-1.7\nfake bill');

describe('pdfProblem', () => {
  it('names an empty or non-PDF buffer, and passes a PDF', () => {
    expect(pdfProblem(Buffer.alloc(0))).toBe('empty');
    expect(pdfProblem(null)).toBe('empty');
    expect(pdfProblem(Buffer.from('<html>'))).toBe('not_pdf');
    expect(pdfProblem(PDF)).toBeNull();
  });
});

describe('findDuplicate', () => {
  it('returns the newest ingestion with the same hash, or null', async () => {
    const hit = { id: 'in1', file_path: 'p.pdf', received_at: 't', status: 'approved' };
    const { db } = fakeDb({ ceb_bill_ingestions: { select: { data: hit, error: null } } });
    expect(await createBillIntake({ db }).findDuplicate('abc')).toEqual(hit);
    const { db: empty } = fakeDb();
    expect(await createBillIntake({ db: empty }).findDuplicate('abc')).toBeNull();
  });

  it('throws when the lookup fails, rather than treating the bill as new', async () => {
    const { db } = fakeDb({ ceb_bill_ingestions: { select: { data: null, error: { message: 'down' } } } });
    await expect(createBillIntake({ db }).findDuplicate('abc')).rejects.toThrow('Duplicate check failed: down');
  });
});

describe('store', () => {
  const input = { buffer: PDF, filename: 'bill.pdf', ownerId: 'user_1', createdBy: 'a@example.test', sourceType: 'manual_upload', fileSha256: 'h1' };

  it('uploads the file, then writes the ingestion row with the hash and status received', async () => {
    const { db, log, storageLog } = fakeDb({ ceb_bill_ingestions: { insert: { data: { id: 'in9', received_at: 't9', status: 'received' }, error: null } } });
    const out = await createBillIntake({ db, bucket: 'b' }).store(input);
    expect(storageLog[0]).toMatchObject({ m: 'upload', bucket: 'b', opts: { upsert: false } });
    expect(storageLog[0].path).toMatch(/^ceb\/\d{4}\/\d{2}\/user_1\/.+_bill\.pdf$/);
    expect(log.find((c) => c.m === 'insert').args[0]).toMatchObject({ source_type: 'manual_upload', file_sha256: 'h1', status: 'received', created_by: 'a@example.test' });
    expect(out).toEqual({ ingestionId: 'in9', filePath: storageLog[0].path, status: 'received', receivedAt: 't9' });
  });

  it('removes the uploaded file again when the row cannot be written', async () => {
    const { db, storageLog } = fakeDb({ ceb_bill_ingestions: { insert: { data: null, error: { message: 'constraint' } } } });
    await expect(createBillIntake({ db, bucket: 'b' }).store(input)).rejects.toThrow('Failed to create ingestion row: constraint');
    expect(storageLog.map((c) => c.m)).toEqual(['upload', 'remove']);
    expect(storageLog[1].paths).toEqual([storageLog[0].path]);
  });

  it('writes no row when the upload fails', async () => {
    const { db, log } = fakeDb({ storage: { upload: { error: { message: 'quota' } } } });
    await expect(createBillIntake({ db }).store(input)).rejects.toThrow('Storage upload failed: quota');
    expect(log.some((c) => c.m === 'insert')).toBe(false);
  });
});

describe('download', () => {
  it('returns the file as a Buffer, or null when Storage cannot', async () => {
    const blob = { arrayBuffer: async () => PDF.buffer.slice(PDF.byteOffset, PDF.byteOffset + PDF.length) };
    const { db } = fakeDb({ storage: { download: { data: blob, error: null } } });
    expect((await createBillIntake({ db }).download('p.pdf')).equals(PDF)).toBe(true);
    const { db: missing } = fakeDb();
    expect(await createBillIntake({ db: missing }).download('p.pdf')).toBeNull();
  });
});

describe('loadTariff', () => {
  it('reads rate_per_kwh, and is null (never a default) when missing or unreadable', async () => {
    const tariffOf = async (row) => createBillIntake({ db: fakeDb({ system_settings: { select: row } }).db }).loadTariff();
    expect(await tariffOf({ data: { setting_value: '37.00' }, error: null })).toBe(37);
    expect(await tariffOf({ data: null, error: null })).toBeNull();
    expect(await tariffOf({ data: { setting_value: 'abc' }, error: null })).toBeNull();
    expect(await tariffOf({ data: null, error: { message: 'down' } })).toBeNull();
  });
});

describe('read', () => {
  it('parses and validates the text of a PDF held in memory, and writes nothing', async () => {
    const { db, log, storageLog } = fakeDb();
    const extractText = vi.fn(async () => 'not a bill');
    const { extracted, validation } = await createBillIntake({ db, extractText }).read(PDF, 37);
    expect(extractText).toHaveBeenCalledWith(PDF);
    expect(extracted.account_number).toBeNull(); // nothing found is null, never 0
    expect(validation.status).toBe('pending_review');
    expect(log).toEqual([]);
    expect(storageLog).toEqual([]);
  });
});

describe('saveExtraction', () => {
  const extracted = { account_number: '123', billing_month: 'OCT', billing_period_start: '2026-10-04', billing_period_end: '2026-11-03', bill_issue_date: null, meter_reading_current: 500, meter_reading_previous: 100, units_exported: 400, earnings: 14800 };
  const validation = { status: 'auto_approved', validation_errors: [], confidence_score: 100 };

  it('saves the new extraction first, then removes the older ones, then sets the ingestion status', async () => {
    const { db, log } = fakeDb({ ceb_bill_extractions: { insert: { data: { id: 'ex2' }, error: null } } });
    const out = await createBillIntake({ db }).saveExtraction('in1', extracted, validation);
    expect(out).toEqual({ id: 'ex2' });
    const order = log.filter((c) => ['insert', 'delete', 'update'].includes(c.m)).map((c) => `${c.table}.${c.m}`);
    expect(order).toEqual(['ceb_bill_extractions.insert', 'ceb_bill_extractions.delete', 'ceb_bill_ingestions.update']);
    expect(log).toContainEqual({ table: 'ceb_bill_extractions', m: 'neq', args: ['id', 'ex2'] });
    expect(log).toContainEqual({ table: 'ceb_bill_ingestions', m: 'update', args: [{ status: 'auto_approved' }] });
  });

  it('removes nothing when the new extraction cannot be saved', async () => {
    const { db, log } = fakeDb({ ceb_bill_extractions: { insert: { data: null, error: { message: 'bad' } } } });
    await expect(createBillIntake({ db }).saveExtraction('in1', extracted, validation)).rejects.toThrow('Failed to save extraction record: bad');
    expect(log.some((c) => c.m === 'delete')).toBe(false);
  });

  it('maps parser fields to extraction columns, keeping null as null', () => {
    const row = extractionRow('in1', { ...extracted, billing_period_start: null, earnings: null }, validation);
    expect(row).toMatchObject({ ingestion_id: 'in1', meter_reading: 500, meter_reading_previous: 100, billing_period_start: null, earnings: null, review_status: 'auto_approved' });
  });
});
