// tests/settingsEndpoint.test.js
//
// api/settings.js: the pure rules (settingsRules.js) and the handler with the admin check and the
// database faked. Pinned: nothing is read or written before the caller is an authenticated admin;
// a setting can be addressed by id (v1) or by name (v3); only allowlisted names and valid values write.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const verifyAdminToken = vi.fn();
const from = vi.fn();

vi.mock('../api/_lib/verifyAdminToken.js', () => ({ verifyAdminToken }));
vi.mock('../api/_lib/supabaseServer.js', () => ({ supabase: { from }, blockOnConfigProblem: () => false }));

const { default: handler } = await import('../api/settings.js');
const { isAllowedSetting, isValidSettingValue, resolveTarget, settingProblem, ALLOWED_SETTINGS } = await import('../api/_lib/settingsRules.js');

const admin = { id: 'user_admin' };
const mockRes = () => ({
  headers: {}, statusCode: null, body: null,
  setHeader(k, v) { this.headers[k] = v; },
  status(c) { this.statusCode = c; return this; },
  json(p) { this.body = p; return this; },
  end() { return this; }
});
const req = (method, body) => ({ method, headers: { origin: 'https://solaredge.anujajay.com' }, body });

/** A fake supabase table: lookups resolve to `row`, updates are recorded. */
function fakeTable(row) {
  const calls = { eq: [], update: null };
  const chain = {
    select: () => chain,
    eq: (col, val) => { calls.eq.push([col, val]); return chain; },
    maybeSingle: async () => ({ data: row, error: null }),
    update: (patch) => { calls.update = patch; return chain; },
    single: async () => ({ data: { ...row, ...(calls.update ?? {}) }, error: null })
  };
  from.mockReturnValue(chain);
  return calls;
}

beforeEach(() => { verifyAdminToken.mockReset(); from.mockReset(); });

describe('settings rules', () => {
  it('allowlists exactly the writable settings', () => {
    expect(ALLOWED_SETTINGS).toEqual(['theme', 'rate_per_kwh', 'solar_grid_capacity', 'daily_generation_target', 'capacity_kwp']);
    expect(isAllowedSetting('rate_per_kwh')).toBe(true);
    expect(isAllowedSetting('service_key')).toBe(false);
  });
  it('numeric settings need a non-negative finite number; blank and junk are rejected', () => {
    expect(isValidSettingValue('capacity_kwp', '41.76')).toBe(true);
    expect(isValidSettingValue('capacity_kwp', 0)).toBe(true);
    for (const bad of ['', '  ', null, undefined, 'abc', '-1', 'Infinity']) expect(isValidSettingValue('rate_per_kwh', bad)).toBe(false);
  });
  it('theme must be a known theme', () => {
    expect(isValidSettingValue('theme', 'dark')).toBe(true);
    expect(isValidSettingValue('theme', 'neon')).toBe(false);
    expect(settingProblem('theme')).toContain('dark, light, orange');
    expect(settingProblem('rate_per_kwh')).toContain('non-negative number');
  });
  it('resolves the target by name or id, refusing a missing or non-allowlisted one', () => {
    expect(resolveTarget({ setting_name: 'capacity_kwp' })).toEqual({ by: 'name', name: 'capacity_kwp' });
    expect(resolveTarget({ id: 7 })).toEqual({ by: 'id', id: 7 });
    expect(resolveTarget({ setting_name: 'capacity_kwp', id: 7 })).toEqual({ by: 'name', name: 'capacity_kwp' });
    expect(resolveTarget({ setting_name: 'secrets' })).toMatchObject({ status: 403 });
    expect(resolveTarget({})).toMatchObject({ status: 400 });
    expect(resolveTarget(undefined)).toMatchObject({ status: 400 });
  });
});

describe('PUT /api/settings', () => {
  it('stops at the admin check: the database is never touched for a non-admin', async () => {
    verifyAdminToken.mockResolvedValue(null);
    const res = mockRes();
    await handler(req('PUT', { setting_name: 'rate_per_kwh', setting_value: 40 }), res);
    expect(from).not.toHaveBeenCalled();
  });

  it('updates a setting addressed by name (v3)', async () => {
    verifyAdminToken.mockResolvedValue(admin);
    const calls = fakeTable({ id: 11, setting_name: 'daily_generation_target', setting_value: '150' });
    const res = mockRes();
    await handler(req('PUT', { setting_name: 'daily_generation_target', setting_value: 160 }), res);
    expect(res.statusCode).toBe(200);
    expect(calls.eq[0]).toEqual(['setting_name', 'daily_generation_target']);
    expect(calls.update.setting_value).toBe('160');
    expect(calls.eq[1]).toEqual(['id', 11]);
  });

  it('still updates by row id (v1)', async () => {
    verifyAdminToken.mockResolvedValue(admin);
    const calls = fakeTable({ id: 4, setting_name: 'rate_per_kwh' });
    const res = mockRes();
    await handler(req('PUT', { id: 4, setting_value: '44' }), res);
    expect(res.statusCode).toBe(200);
    expect(calls.eq[0]).toEqual(['id', 4]);
  });

  it('rejects a bad value, a non-allowlisted name, a missing target and an unknown row without writing', async () => {
    verifyAdminToken.mockResolvedValue(admin);
    let calls = fakeTable({ id: 4, setting_name: 'rate_per_kwh' });
    let res = mockRes();
    await handler(req('PUT', { setting_name: 'rate_per_kwh', setting_value: 'abc' }), res);
    expect(res.statusCode).toBe(400);
    expect(calls.update).toBeNull();

    res = mockRes();
    await handler(req('PUT', { setting_name: 'admin_flag', setting_value: 1 }), res);
    expect(res.statusCode).toBe(403);

    res = mockRes();
    await handler(req('PUT', { setting_value: 1 }), res);
    expect(res.statusCode).toBe(400);

    calls = fakeTable(null);
    res = mockRes();
    await handler(req('PUT', { setting_name: 'capacity_kwp', setting_value: 40 }), res);
    expect(res.statusCode).toBe(404);
    expect(calls.update).toBeNull();
  });
});

// ---- the browser side of settings: draft logic and the writer ---------------------------------
const { PLANT_FIELDS, toDraft, parseField, validateDraft, changedFields } = await import('../src/v3/settings/form.js');
const { createSettingsWriter, createLiveSource } = await import('../src/v3/data/client.js');

describe('plant settings draft', () => {
  const stored = { dailyTargetKwh: 150, capacityKwp: 41.76, acRatedKw: 40, ratePerKwh: null };

  it('maps each editable field to its system_settings name', () => {
    expect(PLANT_FIELDS.map((f) => f.name)).toEqual(['daily_generation_target', 'capacity_kwp', 'solar_grid_capacity', 'rate_per_kwh']);
    for (const f of PLANT_FIELDS) expect(isAllowedSetting(f.name)).toBe(true); // the UI can only ask for what the server allows
  });
  it('turns stored numbers into text drafts and an unset value into an empty box', () => {
    expect(toDraft(stored)).toEqual({ dailyTargetKwh: '150', capacityKwp: '41.76', acRatedKw: '40', ratePerKwh: '' });
    expect(toDraft(null)).toEqual({ dailyTargetKwh: '', capacityKwp: '', acRatedKw: '', ratePerKwh: '' });
  });
  it('parses only non-negative numbers', () => {
    expect(parseField('41.76')).toBe(41.76);
    expect(parseField('0')).toBe(0);
    for (const bad of ['', '  ', 'abc', '-1', null, undefined]) expect(parseField(bad)).toBeNull();
  });
  it('flags bad input, and a blanked value that was set; a never-set blank is fine', () => {
    expect(validateDraft(stored, toDraft(stored))).toEqual({});
    expect(validateDraft(stored, { ...toDraft(stored), dailyTargetKwh: '-5' })).toHaveProperty('dailyTargetKwh');
    expect(validateDraft(stored, { ...toDraft(stored), capacityKwp: '' })).toHaveProperty('capacityKwp');
    expect(validateDraft(stored, { ...toDraft(stored), ratePerKwh: '' })).toEqual({});
  });
  it('writes only what changed, as numbers', () => {
    expect(changedFields(stored, toDraft(stored))).toEqual([]);
    const draft = { ...toDraft(stored), dailyTargetKwh: '160', ratePerKwh: '44' };
    expect(changedFields(stored, draft)).toEqual([
      { key: 'dailyTargetKwh', name: 'daily_generation_target', label: 'Daily target', value: 160 },
      { key: 'ratePerKwh', name: 'rate_per_kwh', label: 'Reference tariff', value: 44 }
    ]);
    expect(changedFields(stored, { ...toDraft(stored), capacityKwp: 'junk' })).toEqual([]);
  });
});

describe('settings writer', () => {
  const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  it('PUTs the setting by name with the bearer token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(200, { setting: { id: 1 } }));
    const put = createSettingsWriter({ getToken: async () => 'tok', fetchImpl });
    await put('daily_generation_target', 160);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/settings');
    expect(init.method).toBe('PUT');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body)).toEqual({ setting_name: 'daily_generation_target', setting_value: '160' });
  });
  it('does not call the server without a session, and surfaces refusals as ApiError', async () => {
    const fetchImpl = vi.fn();
    await expect(createSettingsWriter({ getToken: async () => null, fetchImpl })('capacity_kwp', 1)).rejects.toMatchObject({ code: 'no_session' });
    expect(fetchImpl).not.toHaveBeenCalled();
    const forbidden = createSettingsWriter({ getToken: async () => 't', fetchImpl: vi.fn().mockResolvedValue(res(403, { error: 'Forbidden' })) });
    await expect(forbidden('capacity_kwp', 1)).rejects.toMatchObject({ status: 403, message: 'Forbidden' });
    const offline = createSettingsWriter({ getToken: async () => 't', fetchImpl: vi.fn().mockRejectedValue(new TypeError('x')) });
    await expect(offline('capacity_kwp', 1)).rejects.toMatchObject({ code: 'network' });
  });
  it('a forced read bypasses the browser HTTP cache', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(200, { ok: 1 }));
    const live = createLiveSource({ getToken: async () => 't', fetchImpl });
    await live('settings', {}, { force: true });
    await live('settings', {});
    expect(fetchImpl.mock.calls[0][1].cache).toBe('no-cache');
    expect(fetchImpl.mock.calls[1][1].cache).toBe('default');
  });
});
