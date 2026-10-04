// tests/v3Foundation.test.js
//
// The pure half of the v3 frontend foundation (src/v3): theme registry, access mapping, nav,
// the data client and the request cache. Component rendering is covered in v3Shell.test.js.

import { describe, it, expect, vi } from 'vitest';
import { THEMES, DEFAULT_THEME, isThemeId, resolveTheme, nextTheme, schemeOf } from '../src/v3/theme/themes.js';
import { readPref, writePref } from '../src/v3/theme/storage.js';
import { levelForUser, dataModeFor, canSee, roleLabel } from '../src/v3/access/level.js';
import { navFor, navGroup, titleFor } from '../src/v3/shell/nav.js';
import { ApiError, buildQuery, cacheKey, createLiveSource, createDemoSource } from '../src/v3/data/client.js';
import { createResourceCache } from '../src/v3/data/cache.js';

describe('themes', () => {
  it('is dark first and falls back to the default for anything unregistered', () => {
    expect(DEFAULT_THEME).toBe('dark');
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('nope')).toBe('dark');
    expect(resolveTheme(null)).toBe('dark');
    expect(isThemeId('dark')).toBe(true);
  });
  it('cycles through the registry and reports a colour scheme', () => {
    expect(nextTheme('dark')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
    expect(schemeOf('light')).toBe('light');
    expect(schemeOf('unknown')).toBe('dark');
  });
  it('every theme card has the four preview swatches', () => {
    for (const t of THEMES) expect(Object.keys(t.preview).sort()).toEqual(['bg', 'ceb', 'gen', 'glass']);
  });
});

describe('preference storage', () => {
  it('round-trips and survives a storage that throws', () => {
    const mem = new Map();
    const ok = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
    expect(writePref('theme', 'light', ok)).toBe(true);
    expect(readPref('theme', 'dark', ok)).toBe('light');
    expect(readPref('missing', 'x', ok)).toBe('x');
    const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); } };
    expect(readPref('theme', 'dark', broken)).toBe('dark');
    expect(writePref('theme', 'light', broken)).toBe(false);
    expect(readPref('theme', 'dark', undefined)).toBe('dark');
  });
});

describe('access levels (browser convenience, the API is the control)', () => {
  it('maps the Clerk user to a level', () => {
    expect(levelForUser({ isLoaded: false })).toBe('loading');
    expect(levelForUser(null)).toBe('loading');
    expect(levelForUser({ isLoaded: false, gaveUp: true })).toBe('none');
    expect(levelForUser({ isLoaded: false, gaveUp: false })).toBe('loading');
    expect(levelForUser({ isLoaded: true, isSignedIn: false })).toBe('none');
    expect(levelForUser({ isLoaded: true, isSignedIn: true, publicMetadata: {} })).toBe('none');
    expect(levelForUser({ isLoaded: true, isSignedIn: true, publicMetadata: { role: 'viewer' } })).toBe('viewer');
    expect(levelForUser({ isLoaded: true, isSignedIn: true, publicMetadata: { role: 'admin' } })).toBe('admin');
  });
  it('only viewers and admins request real data', () => {
    expect(dataModeFor('none')).toBe('demo');
    expect(dataModeFor('loading')).toBe('demo');
    expect(dataModeFor('viewer')).toBe('live');
    expect(dataModeFor('admin')).toBe('live');
  });
  it('canSee never passes while loading and respects the ladder', () => {
    expect(canSee('loading', 'none')).toBe(false);
    expect(canSee('none', 'none')).toBe(true);
    expect(canSee('viewer', 'admin')).toBe(false);
    expect(canSee('admin', 'viewer')).toBe(true);
    expect(canSee('none', undefined)).toBe(true);
  });
  it('labels each role and defaults to visitor', () => {
    expect(roleLabel('admin').label).toBe('Admin');
    expect(roleLabel('weird').label).toBe('Visitor');
  });
});

describe('navigation', () => {
  it('shows Admin only to admins; Pro metrics and Settings to everyone', () => {
    expect(navFor('none').map((n) => n.id)).toEqual(['overview', 'pro', 'settings']);
    expect(navFor('viewer').map((n) => n.id)).toEqual(['overview', 'pro', 'settings']);
    expect(navFor('admin').map((n) => n.id)).toEqual(['overview', 'pro', 'admin', 'settings']);
    expect(navFor('loading')).toEqual([]);
  });
  it('splits main and footer groups', () => {
    expect(navGroup('admin', 'foot').map((n) => n.id)).toEqual(['settings']);
    expect(navGroup('admin', 'main').map((n) => n.id)).toEqual(['overview', 'pro', 'admin']);
  });
  it('titles pages by path', () => {
    expect(titleFor('/')).toBe('Overview');
    expect(titleFor('/pro')).toBe('Pro metrics');
    expect(titleFor('/admin/bills')).toBe('Admin');
    expect(titleFor('/signin')).toBe('Sign in');
    expect(titleFor('/nowhere')).toBe('Solar Analytics');
  });
});

describe('data client', () => {
  it('builds stable queries and cache keys', () => {
    expect(buildQuery({ to: '2036-09-14', from: '2036-09-01', skip: null, blank: '' })).toBe('from=2036-09-01&to=2036-09-14');
    expect(cacheKey('range', { b: 1, a: 2 })).toBe(cacheKey('range', { a: 2, b: 1 }));
    expect(buildQuery()).toBe('');
  });

  const jsonRes = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

  it('sends the bearer token and returns the body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonRes(200, { rows: [] }));
    const live = createLiveSource({ getToken: async () => 'tok', fetchImpl });
    const out = await live('comparison', { year: 2036 });
    expect(out).toEqual({ rows: [] });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/data/comparison?year=2036');
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('refuses without a session instead of calling the API', async () => {
    const fetchImpl = vi.fn();
    const live = createLiveSource({ getToken: async () => null, fetchImpl });
    await expect(live('live')).rejects.toMatchObject({ status: 401, code: 'no_session' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('turns API errors, network failures and junk bodies into ApiError', async () => {
    const get = (fetchImpl) => createLiveSource({ getToken: async () => 't', fetchImpl })('bills');
    await expect(get(vi.fn().mockResolvedValue(jsonRes(403, { error: 'Forbidden', code: 'forbidden' })))).rejects.toMatchObject({ status: 403, code: 'forbidden', message: 'Forbidden' });
    await expect(get(vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => { throw new Error('html'); } }))).rejects.toMatchObject({ status: 502, code: 'http_502' });
    await expect(get(vi.fn().mockRejectedValue(new TypeError('offline')))).rejects.toMatchObject({ code: 'network' });
    await expect(get(vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => null }))).rejects.toMatchObject({ code: 'bad_body' });
    await expect(get(vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error('x'); } }))).rejects.toMatchObject({ code: 'bad_body' });
  });

  it('lets an abort through unchanged so callers can ignore it', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const live = createLiveSource({ getToken: async () => 't', fetchImpl: vi.fn().mockRejectedValue(abort) });
    await expect(live('live')).rejects.toBe(abort);
  });

  it('demo source unwraps bodies and normalises errors', async () => {
    const demo = createDemoSource(async (n) => ({ body: { n } }));
    expect(await demo('live')).toEqual({ n: 'live' });
    const bad = createDemoSource(async () => { throw Object.assign(new Error('bad range'), { status: 400, code: 'bad_range' }); });
    await expect(bad('range')).rejects.toBeInstanceOf(ApiError);
    await expect(bad('range')).rejects.toMatchObject({ status: 400, code: 'bad_range' });
    await expect(createDemoSource(async () => ({}))('x')).rejects.toMatchObject({ code: 'bad_body' });
    await expect(createDemoSource(async () => { throw new Error('boom'); })('x')).rejects.toMatchObject({ code: 'demo_error' });
  });
});

describe('resource cache', () => {
  it('shares an in-flight call and reuses a fresh result', async () => {
    let t = 0;
    const cache = createResourceCache({ ttlMs: 100, now: () => t });
    const load = vi.fn().mockResolvedValue('A');
    const a = cache.get('k', load);
    const b = cache.get('k', load);
    expect(await a.promise).toBe('A');
    expect(await b.promise).toBe('A');
    expect(load).toHaveBeenCalledTimes(1);
    expect(b.cached).toBe(true);
    expect(cache.peek('k')).toBe('A');
    t = 50;
    expect(cache.get('k', load).cached).toBe(true);
    t = 200;
    await cache.get('k', load).promise;
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('never caches a failure and force bypasses the cache', async () => {
    const cache = createResourceCache();
    const load = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue('ok');
    await expect(cache.get('k', load).promise).rejects.toThrow('down');
    expect(cache.peek('k')).toBeUndefined();
    expect(await cache.get('k', load).promise).toBe('ok');
    await cache.get('k', load, { force: true }).promise;
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('drops everything when the epoch (mode or user) changes', async () => {
    const cache = createResourceCache();
    cache.setEpoch('demo');
    await cache.get('k', async () => 1).promise;
    expect(cache.size).toBe(1);
    cache.setEpoch('demo');
    expect(cache.size).toBe(1);
    cache.setEpoch('live:user_1');
    expect(cache.size).toBe(0);
    cache.clear();
    expect(cache.peek('k')).toBeUndefined();
  });
});
