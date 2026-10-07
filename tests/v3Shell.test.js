// tests/v3Shell.test.js
//
// Server-render smoke tests for the v3 shell and its primitives (no DOM needed): the right nav for each
// access level, themes applied through data-theme, the route guard, and the unknown-is-not-zero rule.

import { describe, it, expect } from 'vitest';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AccessContext } from '../src/v3/access/context.js';
import { RequireAccess } from '../src/v3/access/RequireAccess.jsx';
import { ThemeProvider } from '../src/v3/theme/ThemeProvider.jsx';
import { DataContext } from '../src/v3/data/context.js';
import { AppShell } from '../src/v3/shell/AppShell.jsx';
import { Segmented } from '../src/v3/ui/Segmented.jsx';
import { Tip } from '../src/v3/ui/Tip.jsx';
import { PrefsContext } from '../src/v3/prefs/context.js';
import { Pill } from '../src/v3/ui/Pill.jsx';
import { Glass } from '../src/v3/ui/Glass.jsx';
import SignInPage from '../src/v3/pages/SignInPage.jsx';

const access = (level, extra = {}) => ({ level, userId: level === 'none' ? null : 'u1', email: null, firstName: null, clerk: false, profile: { nickname: '', avatar: 'initial' }, saveProfile: async () => {}, getToken: async () => 't', signOut: () => {}, ...extra });
const data = (mode) => ({ mode, ready: true, epoch: `${mode}:x`, request: () => ({ promise: new Promise(() => {}) }), peek: () => undefined });

function renderShell(level, path = '/', mode = level === 'none' ? 'demo' : 'live') {
  return renderToString(
    h(ThemeProvider, null,
      h(AccessContext.Provider, { value: access(level) },
        h(DataContext.Provider, { value: data(mode) },
          h(MemoryRouter, { initialEntries: [path] },
            h(Routes, null, h(Route, { element: h(AppShell) }, h(Route, { path: '*', element: h('p', null, 'page body') }))))))));
}

describe('app shell', () => {
  it('visitor: demo badge, dark theme, no Admin entry', () => {
    const html = renderShell('none');
    expect(html).toContain('data-theme="dark"');
    expect(html).toContain('DEMO DATA');
    expect(html).toContain('aria-label="Overview"');
    expect(html).toContain('aria-label="Pro metrics"');
    expect(html).toContain('aria-label="Settings"');
    expect(html).not.toContain('aria-label="Admin"');
    expect(html).toContain('Visitor');
    expect(html).toContain('page body');
  });

  it('admin: Admin entry appears and the demo badge does not', () => {
    const html = renderShell('admin');
    expect(html).toContain('aria-label="Admin"');
    expect(html).not.toContain('DEMO DATA');
    expect(html).toContain('aria-label="Account: Admin, Admin"'); // the account bubble, top right
  });

  it('titles the page from the path and marks the current page', () => {
    const html = renderShell('viewer', '/pro');
    expect(html).toContain('>Pro metrics</h1>');
    expect(html).toMatch(/aria-current="page"[^>]*aria-label="Pro metrics"|aria-label="Pro metrics"[^>]*aria-current="page"/);
  });

  it('offers the theme switch with the next theme named', () => {
    expect(renderShell('none')).toContain('aria-label="Switch to Sunrise Day"');
  });
});

describe('route guard', () => {
  const guarded = (level) =>
    renderToString(
      h(AccessContext.Provider, { value: access(level) },
        h(MemoryRouter, { initialEntries: ['/admin'] },
          h(Routes, null,
            h(Route, { path: '/admin', element: h(RequireAccess, { level: 'admin' }, h('p', null, 'secret admin page')) }),
            h(Route, { path: '/signin', element: h('p', null, 'doorway') })))));

  it('shows the page to an admin', () => expect(guarded('admin')).toContain('secret admin page'));
  it('shows a placeholder, never the page, while access resolves', () => {
    const html = guarded('loading');
    expect(html).not.toContain('secret admin page');
    expect(html).toContain('aria-busy="true"');
  });
  it('explains to a signed-in viewer that they lack access', () => {
    const html = guarded('viewer');
    expect(html).not.toContain('secret admin page');
    expect(html).toContain('does not have access');
  });
  // A signed-out visitor is redirected to /signin by <Navigate>, which only acts in a browser; the
  // decision itself (canSee) is covered in v3Foundation.test.js.
});

describe('primitives', () => {
  it('Segmented marks the chosen option as pressed (group) or selected (tabs)', () => {
    const opts = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];
    const group = renderToString(h(Segmented, { options: opts, value: 'b', onChange() {}, label: 'Range' }));
    expect(group).toContain('aria-label="Range"');
    expect(group).toMatch(/aria-pressed="true"[^>]*>B</);
    const tabs = renderToString(h(Segmented, { options: opts, value: 'a', onChange() {}, role: 'tablist', label: 'Explore', small: true }));
    expect(tabs).toContain('role="tablist"');
    expect(tabs).toMatch(/aria-selected="true"[^>]*>A</);
    expect(tabs).toContain('v3-seg sm');
  });

  it('Tip describes its content for assistive tech and renders nothing extra without text', () => {
    const withHints = (el) => h(PrefsContext.Provider, { value: { hints: true, showMark: true, setHints() {}, setShowMark() {} } }, el);
    const html = renderToString(withHints(h(Tip, { text: 'earned in 20 months' }, h('span', null, '3.07 M'))));
    expect(html).toContain('role="tooltip"');
    expect(html).toContain('earned in 20 months');
    expect(html).toMatch(/aria-describedby="[^"]+"/);
    expect(renderToString(h(Tip, { text: '' }, h('span', null, 'x')))).toBe('<span>x</span>');
  });

  it('Pill and Glass render their tone and tag', () => {
    expect(renderToString(h(Pill, { tone: 'good' }, 'online'))).toContain('data-tone="good"');
    const g = renderToString(h(Glass, { as: 'article', card: true }, 'x'));
    expect(g).toMatch(/^<article class="v3-glass v3-card"/);
  });
});

describe('sign-in doorway', () => {
  const door = (ctx) =>
    renderToString(h(AccessContext.Provider, { value: ctx }, h(MemoryRouter, null, h(SignInPage))));
  it('when auth is configured, waits for it and always keeps the demo and a way to contact the owner', () => {
    const html = door(access('loading', { clerk: true }));
    expect(html).toContain('aria-label="Loading sign-in"');
    expect(html).toContain('https://anujajay.com/#contact');
    expect(html).toContain('Keep exploring the demo');
    for (const r of ['Visitor', 'Viewer', 'Admin']) expect(html).toContain(r);
  });
  it('without auth configured there is no sign-in form, only the demo', () => {
    const html = door(access('none', { clerk: false }));
    expect(html).toContain('Sign-in is not available');
    expect(html).toContain('Keep exploring the demo');
  });
});

import { PlantCard } from '../src/v3/settings/PlantCard.jsx';
import { AccountCard } from '../src/v3/settings/AccountCard.jsx';

describe('settings cards', () => {
  const settings = { dailyTargetKwh: 150, capacityKwp: 41.76, acRatedKw: 40, ratePerKwh: null };
  it('admin: fields are editable with a Save button (disabled until something changes)', () => {
    const html = renderToString(h(PlantCard, { settings, loading: false, canEdit: true, onSave: async () => {} }));
    expect(html).toContain('You can edit');
    expect(html).toContain('value="150"');
    expect(html).not.toMatch(/<input[^>]*disabled/);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Save</);
  });
  it('viewer or visitor: the same values, read only, and no Save', () => {
    const html = renderToString(h(PlantCard, { settings, loading: false, canEdit: false, onSave: async () => {} }));
    expect(html).toContain('Read only');
    expect(html).toContain('value="150"');
    expect(html).toMatch(/<input[^>]*disabled/);
    expect(html).not.toContain('>Save<');
  });
  it('an unset value shows an empty box, never 0', () => {
    const html = renderToString(h(PlantCard, { settings, loading: false, canEdit: true, onSave: async () => {} }));
    expect(html).toContain('placeholder="not set"');
    expect(html).not.toMatch(/value="0"/);
  });
  it('shows a skeleton while loading', () => {
    expect(renderToString(h(PlantCard, { settings: null, loading: true, canEdit: true, onSave: async () => {} }))).toContain('aria-busy="true"');
  });
  it('account: sign-in for visitors, sign-out for signed-in users', () => {
    const visitor = renderToString(h(AccountCard, { level: 'none', email: null, onSignIn() {}, onSignOut() {} }));
    expect(visitor).toContain('Visitor');
    expect(visitor).toContain('>Sign in<');
    expect(visitor).not.toContain('>Sign out<');
    const admin = renderToString(h(AccountCard, { level: 'admin', email: 'owner@example.test', onSignIn() {}, onSignOut() {} }));
    expect(admin).toContain('owner@example.test');
    expect(admin).toContain('>Sign out<');
  });
});

import AdminPage from '../src/v3/pages/AdminPage.jsx';

describe('admin page', () => {
  const renderAdmin = (level) =>
    renderToString(
      h(AccessContext.Provider, { value: access(level) },
        h(DataContext.Provider, { value: data('live') },
          h(MemoryRouter, { initialEntries: ['/admin'] },
            h(Routes, null,
              h(Route, { path: '/admin', element: h(RequireAccess, { level: 'admin' }, h(AdminPage)) }))))));

  it('an admin sees the three sections with Bills open: upload, the review queue and approved bills', () => {
    const html = renderAdmin('admin');
    expect(html).toContain('aria-label="Admin sections"');
    for (const t of ['Bills', 'Access', 'Data health']) expect(html).toContain(`>${t}<`);
    expect(html).toContain('Upload a CEB bill');
    expect(html).toContain('Needs your check');
    expect(html).toContain('Approved bills');
    expect(html).toMatch(/aria-selected="true"[^>]*>Bills</);
  });

  it('a viewer never sees admin content, only the access message', () => {
    const html = renderAdmin('viewer');
    expect(html).not.toContain('Upload a CEB bill');
    expect(html).toContain('does not have access');
  });
});

import { AVATARS, AVATAR_GROUPS, FEATURED_AVATAR_IDS, assignMissingAvatar, avatarById, cleanNickname, displayNameFor, initialOf, normalizeProfile, randomAvatarId, savedAvatarId, NICKNAME_MAX } from '../src/v3/access/avatars.js';
import { openPeriodSoFar, lifetimeGeneration } from '../src/v3/overview/format.js';
import { blockCopy } from '../src/v3/shell/copy.js';
import { PREF_DEFAULTS } from '../src/v3/prefs/context.js';

describe('round 2 fixes', () => {
  it('hints are off and the Mark above line on, by default', () => {
    expect(PREF_DEFAULTS).toEqual({ hints: false, showMark: true });
    // with the default (hints off) a Tip renders its wrapper but no bubble
    const html = renderToString(h(Tip, { text: 'x' }, h('b', null, 'v')));
    expect(html).toBe('<span class="v3-tip"><b>v</b></span>');
    // a chart value shows on hover even with hints off; the explanation does not
    const v = renderToString(h(Tip, { value: 'Aug 2036 · 4,100 kWh', text: 'long explanation' }, h('b', null, 'v')));
    expect(v).toContain('Aug 2036 · 4,100 kWh');
    expect(v).not.toContain('long explanation');
  });

  it('the sidebar starts collapsed and no longer carries the account', () => {
    const html = renderShell('admin');
    expect(html).toContain('data-collapsed="true"');
    expect(html).toContain('src="/favicon.svg"');
    expect(html).not.toMatch(/v3-rail[\s\S]*Full access/);
    expect(html).toContain('aria-label="Turn hints on"');
    expect(html).not.toContain('role="tooltip"'); // no labels on the sidebar at all
  });

  it('profile: 28 Solar Crew choices, legacy migration, a clean nickname, and a sensible name', () => {
    expect(AVATARS).toHaveLength(28);
    expect(AVATAR_GROUPS.map((group) => group.avatars.length)).toEqual([7, 7, 7, 7]);
    expect(new Set(AVATARS.map((avatar) => avatar.id)).size).toBe(28);
    expect(FEATURED_AVATAR_IDS).toHaveLength(8);
    expect(avatarById('nope').id).toBe('initial');
    expect(savedAvatarId('initial')).toBeNull();
    expect(savedAvatarId('sun')).toBe('sol');
    expect(savedAvatarId('moon')).toBe('luna');
    expect(randomAvatarId(() => 0)).toBe('sol');
    expect(randomAvatarId(() => 0.999999)).toBe('fern');
    expect(cleanNickname('  Solar   Fan  ')).toBe('Solar Fan');
    expect(cleanNickname('x'.repeat(40))).toHaveLength(NICKNAME_MAX);
    expect(displayNameFor({ nickname: '', firstName: 'Anuja', email: 'a@b.c', fallback: 'Admin' })).toBe('Anuja');
    expect(displayNameFor({ nickname: 'Boss', firstName: 'Anuja', fallback: 'Admin' })).toBe('Boss');
    expect(displayNameFor({ email: 'owner@example.test', fallback: 'Admin' })).toBe('owner');
    expect(displayNameFor({ fallback: 'Visitor' })).toBe('Visitor');
    expect(initialOf('anuja')).toBe('A');
    expect(initialOf('')).toBe('?');
    expect(normalizeProfile({ nickname: ' n ', avatar: 'sun', extra: 1 })).toEqual({ nickname: 'n', avatar: 'sol' });
    expect(normalizeProfile(undefined)).toEqual({ nickname: '', avatar: 'initial' });
  });

  it('assigns a random character only when a signed-in account has no saved choice', async () => {
    const updates = [];
    const user = { unsafeMetadata: { preference: 'keep', profile: { nickname: 'Solar Fan', avatar: 'initial' } }, update: async (next) => { updates.push(next); } };
    expect(await assignMissingAvatar(user, () => 0.5)).toBe('nova');
    expect(updates).toEqual([{ unsafeMetadata: { preference: 'keep', profile: { nickname: 'Solar Fan', avatar: 'nova' } } }]);
    user.unsafeMetadata.profile.avatar = 'orbit';
    expect(await assignMissingAvatar(user, () => 0)).toBe('orbit');
    expect(updates).toHaveLength(1);
    user.unsafeMetadata.profile.avatar = 'leaf';
    expect(await assignMissingAvatar(user, () => 0)).toBe('terra');
    expect(updates).toHaveLength(1);
  });

  it('the open billing period includes today from the live reading until today is stored', () => {
    const open = { startKey: '2026-10-04', endKey: '2026-10-04', kwh: null, daysPresent: 0, daysInPeriod: 1 };
    expect(openPeriodSoFar(open, { todayKwh: 146.4 }, '2026-10-03', '2026-10-04')).toEqual({ kwh: 146.4, includesToday: true, daysPresent: 1, daysInPeriod: 1 });
    const longer = { ...open, startKey: '2026-09-04', kwh: 1200, daysPresent: 10, daysInPeriod: 11 };
    expect(openPeriodSoFar(longer, { todayKwh: 100 }, '2026-10-03', '2026-10-04').kwh).toBe(1300);
    // already stored: not counted twice
    expect(openPeriodSoFar(longer, { todayKwh: 100 }, '2026-10-04', '2026-10-04')).toMatchObject({ kwh: 1200, includesToday: false });
    expect(openPeriodSoFar(longer, { todayKwh: 100 }, undefined, '2026-10-04')).toMatchObject({ kwh: 1200, includesToday: false });
    // no live reading and nothing stored: unknown, not zero
    expect(openPeriodSoFar(open, null, '2026-10-03', '2026-10-04').kwh).toBeNull();
    expect(openPeriodSoFar(null, { todayKwh: 1 }, null, '2026-10-04')).toBeNull();
  });

  it('all-time generation is the inverter lifetime counter, falling back to the daily records', () => {
    const totals = { generation: { totalKwh: 99599.3 } };
    expect(lifetimeGeneration({ totalKwh: 101116 }, totals)).toEqual({ kwh: 101116, source: 'counter' });
    expect(lifetimeGeneration({ totalKwh: null }, totals)).toEqual({ kwh: 99599.3, source: 'records' });
    expect(lifetimeGeneration(null, null)).toEqual({ kwh: null, source: null });
  });

  it('copying is blocked except out of form fields', () => {
    const ev = (target) => ({ target, prevented: false, preventDefault() { this.prevented = true; } });
    const page = ev({ tagName: 'DIV' }); blockCopy(page); expect(page.prevented).toBe(true);
    const field = ev({ tagName: 'INPUT' }); blockCopy(field); expect(field.prevented).toBe(false);
    const area = ev({ tagName: 'TEXTAREA' }); blockCopy(area); expect(area.prevented).toBe(false);
  });

  it('the demo lifetime counter agrees with the demo daily records', async () => {
    const { demoRequest } = await import('../shared/demo/demoApi.js');
    const live = (await demoRequest('live')).body;
    const totals = (await demoRequest('totals')).body;
    expect(live.totalKwh).toBeGreaterThan(totals.generation.totalKwh);
    expect(live.totalKwh - totals.generation.totalKwh).toBeLessThan(500); // today so far, nothing else
  });
});
