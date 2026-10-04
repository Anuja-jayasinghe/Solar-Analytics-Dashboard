// tests/v3Admin.test.js
//
// The admin screens' logic: bill review form, role changes, data-health items, and the admin API wrapper.
// The server stays the control (it re-checks admin and re-validates); these tests pin that the UI sends
// exactly what the endpoints accept and never invents a value.

import { describe, it, expect, vi } from 'vitest';
import { BILL_FIELDS, toBillDraft, validateBillDraft, buildRecord, impliedRate, queueItems, uploadProblem } from '../src/v3/admin/billForm.js';
import { ROLE_OPTIONS, roleOfLevel, levelLabel, displayName, sortUsers, canChangeRole, withRole, roleProblem } from '../src/v3/admin/users.js';
import { freshnessItems, MAINTENANCE, workflowUrl, REPO_URL } from '../src/v3/admin/health.js';
import { createAdminApi } from '../src/v3/data/adminApi.js';

const extraction = {
  id: 'ex1', ingestion_id: 'in1', review_status: 'pending_review',
  billing_period_start: '2036-08-06', billing_period_end: '2036-09-03', meter_reading: 97597, units_exported: 4102, earnings: 180488,
  account_number: 'ACC-1', billing_month: '2036-09', validation_errors: ['units mismatch'], ceb_bill_ingestions: { file_path: 'ceb/2036/09/x.pdf', id: 'in1' }
};

describe('bill review draft', () => {
  it('turns an extraction into text, leaving unread figures blank and keeping a printed 0', () => {
    expect(toBillDraft(extraction)).toEqual({ billing_period_start: '2036-08-06', billing_period_end: '2036-09-03', meter_reading: '97597', units_exported: '4102', earnings: '180488' });
    expect(toBillDraft({ ...extraction, units_exported: null, earnings: 0 })).toMatchObject({ units_exported: '', earnings: '0' });
    expect(toBillDraft(null).meter_reading).toBe('');
    expect(BILL_FIELDS.every((f) => f.required)).toBe(true);
  });
  it('requires every field and checks dates, numbers and order', () => {
    expect(validateBillDraft(toBillDraft(extraction))).toEqual({});
    const blank = validateBillDraft({ ...toBillDraft(extraction), earnings: '' });
    expect(blank).toEqual({ earnings: 'Required' });
    expect(validateBillDraft({ ...toBillDraft(extraction), billing_period_end: '03/09/2036' }).billing_period_end).toContain('date');
    expect(validateBillDraft({ ...toBillDraft(extraction), meter_reading: '-4' }).meter_reading).toContain('number');
    expect(validateBillDraft({ ...toBillDraft(extraction), units_exported: 'abc' }).units_exported).toContain('number');
    expect(validateBillDraft({ ...toBillDraft(extraction), billing_period_start: '2036-09-03', billing_period_end: '2036-08-06' }).billing_period_end).toContain('after');
    expect(validateBillDraft({ ...toBillDraft(extraction), earnings: '0' })).toEqual({});
  });
  it('builds exactly the record the endpoint accepts, anchored on the bill date', () => {
    const rec = buildRecord(toBillDraft(extraction), extraction);
    expect(rec).toEqual({
      bill_date: '2036-09-03', billing_period_start: '2036-08-06', billing_period_end: '2036-09-03',
      meter_reading: 97597, units_exported: 4102, earnings: 180488,
      account_number: 'ACC-1', billing_month: '2036-09', ingestion_id: 'in1', data_source: 'dashboard_upload', file_path: 'ceb/2036/09/x.pdf'
    });
    expect(() => buildRecord({ ...toBillDraft(extraction), earnings: '' }, extraction)).toThrow(RangeError);
    expect(buildRecord(toBillDraft(extraction), { ingestion_id: 'z' }).account_number).toBeNull();
  });
  it('shows the implied rate so a typo stands out, and nothing when it cannot be computed', () => {
    expect(impliedRate(toBillDraft(extraction))).toBeCloseTo(44, 6);
    expect(impliedRate({ units_exported: '0', earnings: '10' })).toBeNull();
    expect(impliedRate({ units_exported: '', earnings: '10' })).toBeNull();
    expect(impliedRate(null)).toBeNull();
  });
  it('queues unapproved extractions and failed uploads, never approved ones', () => {
    const items = queueItems({
      extractions: [extraction, { ...extraction, id: 'ex2', review_status: 'approved' }, { ...extraction, id: 'ex3', review_status: 'auto_approved', validation_errors: null }],
      failedIngestions: [{ id: 'f1', status: 'failed_extraction', file_path: 'p.pdf' }]
    });
    expect(items.map((i) => i.id)).toEqual(['ex1', 'ex3', 'failed-f1']);
    expect(items[0].problems).toEqual(['units mismatch']);
    expect(items[1].problems).toEqual([]);
    expect(items[2]).toMatchObject({ kind: 'failed', ingestionId: 'f1', status: 'failed_extraction' });
    expect(queueItems(undefined)).toEqual([]);
  });
  it('explains upload failures in plain words', () => {
    expect(uploadProblem({ status: 409 })).toContain('already been uploaded');
    expect(uploadProblem({ status: 400, message: 'Not a PDF' })).toBe('Not a PDF');
    expect(uploadProblem({ status: 403 })).toContain('admin');
    expect(uploadProblem({ code: 'network' })).toContain('network');
  });
});

describe('users and roles', () => {
  const users = [
    { id: 'u3', email: 'z@example.test', firstName: '', lastName: '', accessLevel: 'none', role: 'user' },
    { id: 'u1', email: 'owner@example.test', firstName: 'Owner', lastName: 'One', accessLevel: 'admin', role: 'admin' },
    { id: 'u2', email: 'a@example.test', firstName: 'Ann', lastName: '', accessLevel: 'viewer', role: 'viewer' }
  ];
  it('offers exactly the roles the server accepts', () => {
    expect(ROLE_OPTIONS.map((r) => r.value)).toEqual(['user', 'viewer', 'admin']);
    expect(roleOfLevel('none')).toBe('user');
    expect(roleOfLevel('viewer')).toBe('viewer');
    expect(roleOfLevel('weird')).toBe('user');
    expect(levelLabel('admin')).toBe('Admin');
    expect(levelLabel('x')).toBe('No access');
  });
  it('names people and sorts admins first, then viewers, then the rest', () => {
    expect(displayName(users[1])).toBe('Owner One');
    expect(displayName(users[0])).toBe('z@example.test');
    expect(displayName({})).toBe('Unnamed user');
    expect(sortUsers(users).map((u) => u.id)).toEqual(['u1', 'u2', 'u3']);
    expect(sortUsers(undefined)).toEqual([]);
  });
  it('you cannot change your own role', () => {
    expect(canChangeRole(users[1], 'u1')).toBe(false);
    expect(canChangeRole(users[1], 'u2')).toBe(true);
    expect(canChangeRole(null, 'u2')).toBe(false);
  });
  it('applies a saved role locally', () => {
    const next = withRole(users, 'u3', 'viewer');
    expect(next.find((u) => u.id === 'u3')).toMatchObject({ role: 'viewer', accessLevel: 'viewer' });
    expect(withRole(users, 'u2', 'user').find((u) => u.id === 'u2').accessLevel).toBe('none');
    expect(users[0].accessLevel).toBe('none'); // the original list is untouched
  });
  it('turns failures into plain sentences', () => {
    expect(roleProblem({ status: 403 })).toContain('admin');
    expect(roleProblem({ status: 400, message: 'You cannot remove your own admin role' })).toContain('own admin role');
    expect(roleProblem({ code: 'network' })).toContain('network');
  });
});

describe('data health', () => {
  const totals = (o = {}) => ({
    generation: { totalKwh: 1, dayCount: 618, firstDay: '2035-01-01', lastDay: '2036-09-14', missingDays: 5 },
    earnings: { totalLkr: 1, billCount: 20, billsWithoutEarnings: 0, firstBillDate: '2035-02-03', lastBillDate: '2036-09-03' }, ...o
  });
  const by = (items, label) => items.find((i) => i.label === label);

  it('yesterday is current; older warns, then alarms; missing days are counted, not hidden', () => {
    const ok = freshnessItems({ totals: totals(), todayKey: '2036-09-15' });
    expect(by(ok, 'Latest daily total')).toMatchObject({ value: '2036-09-14', tone: 'good' });
    expect(by(ok, 'Days without a reading')).toMatchObject({ value: '5', tone: 'warn' });
    expect(by(ok, 'Latest bill').tone).toBe('good');
    expect(by(freshnessItems({ totals: totals(), todayKey: '2036-09-17' }), 'Latest daily total').tone).toBe('warn');
    expect(by(freshnessItems({ totals: totals(), todayKey: '2036-09-25' }), 'Latest daily total').tone).toBe('bad');
    expect(by(freshnessItems({ totals: totals(), todayKey: '2036-12-01' }), 'Latest bill').tone).toBe('warn');
  });
  it('flags bills without an earnings figure and says unknown when nothing is loaded', () => {
    const t = totals();
    t.earnings.billsWithoutEarnings = 2;
    expect(by(freshnessItems({ totals: t, todayKey: '2036-09-15' }), 'Bills without earnings')).toMatchObject({ value: '2', tone: 'warn' });
    const none = freshnessItems({ totals: null, todayKey: null });
    expect(by(none, 'Latest daily total').value).toBe('unknown');
    expect(by(none, 'Latest bill').value).toBe('none yet');
    expect(by(freshnessItems({ totals: totals({ generation: { dayCount: 0, firstDay: null, lastDay: null, missingDays: 0 } }), todayKey: '2036-09-15' }), 'Latest daily total').value).toBe('unknown');
  });
  it('maintenance links open the matching GitHub workflow, and every workflow exists in the repo', async () => {
    expect(workflowUrl('db-snapshot.yml')).toBe(`${REPO_URL}/actions/workflows/db-snapshot.yml`);
    const fs = await import('node:fs');
    for (const m of MAINTENANCE) expect(fs.existsSync(`.github/workflows/${m.id}`)).toBe(true);
  });
});

describe('admin API wrapper', () => {
  const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  const api = (fetchImpl, token = 'tok') => createAdminApi({ getToken: async () => token, fetchImpl });

  it('sends the bearer token and the right verb, path and body for each call', async () => {
    const f = vi.fn().mockResolvedValue(res(200, { ok: 1 }));
    const a = api(f);
    await a.listQueue();
    await a.extract('in1');
    await a.approve({ extractionId: 'ex1', ingestionId: 'in1', record: { x: 1 } });
    await a.discard('in1');
    await a.signedUrl('p.pdf');
    await a.listUsers();
    await a.setRole('user_1', 'viewer');
    const calls = f.mock.calls.map(([url, init]) => [init.method, url, init.body ? JSON.parse(init.body) : undefined]);
    expect(calls).toEqual([
      ['GET', '/api/ceb-bills/ingestions?view=queue', undefined],
      ['POST', '/api/ceb-bills/extract', { ingestionId: 'in1' }],
      ['PUT', '/api/ceb-bills/records', { extractionId: 'ex1', ingestionId: 'in1', record: { x: 1 } }],
      ['DELETE', '/api/ceb-bills/delete', { ingestionId: 'in1' }],
      ['POST', '/api/ceb-bills/signed-url', { filePath: 'p.pdf' }],
      ['GET', '/api/admin/users', undefined],
      ['PATCH', '/api/admin/users/user_1', { role: 'viewer' }]
    ]);
    for (const [, init] of f.mock.calls) expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('uploads the file as multipart without forcing a content type', async () => {
    const f = vi.fn().mockResolvedValue(res(201, { ingestionId: 'in9' }));
    const file = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    expect(await api(f).uploadBill(file)).toEqual({ ingestionId: 'in9' });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('/api/ceb-bills/upload');
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.body.get('file')).toBeInstanceOf(Blob);
    expect(init.headers['Content-Type']).toBeUndefined();
  });

  it('does not call the server without a session', async () => {
    const f = vi.fn();
    await expect(api(f, null).listUsers()).rejects.toMatchObject({ status: 401, code: 'no_session' });
    expect(f).not.toHaveBeenCalled();
  });

  it('keeps the server’s own message and joined details so the screen can say what was wrong', async () => {
    const bad = api(vi.fn().mockResolvedValue(res(400, { error: 'Invalid record', details: ['earnings is required', 'bill_date invalid'] })));
    await expect(bad.approve({ extractionId: 'e', ingestionId: 'i', record: {} })).rejects.toMatchObject({ status: 400, message: 'earnings is required; bill_date invalid' });
    const dup = api(vi.fn().mockResolvedValue(res(409, { error: 'Already ingested', ingestionId: 'in1' })));
    await expect(dup.uploadBill(new Blob(['x']))).rejects.toMatchObject({ status: 409, message: 'Already ingested' });
    const html = api(vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => { throw new Error('html'); } }));
    await expect(html.listQueue()).rejects.toMatchObject({ status: 502, code: 'http_502' });
    const off = api(vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(off.listQueue()).rejects.toMatchObject({ code: 'network' });
  });

  it('an empty success body is an empty object, not an error', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error('no body'); } });
    expect(await api(f).discard('in1')).toEqual({});
  });
});
