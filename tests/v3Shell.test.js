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
import { Pill } from '../src/v3/ui/Pill.jsx';
import { Glass } from '../src/v3/ui/Glass.jsx';
import SignInPage from '../src/v3/pages/SignInPage.jsx';

const access = (level, extra = {}) => ({ level, userId: level === 'none' ? null : 'u1', email: null, getToken: async () => 't', signIn: () => {}, signOut: () => {}, ...extra });
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
    expect(html).toContain('Full access');
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
    const html = renderToString(h(Tip, { text: 'earned in 20 months' }, h('span', null, '3.07 M')));
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
  it('offers sign-in when auth is configured and always keeps the demo', () => {
    const html = door(access('none'));
    expect(html).toContain('>Sign in</button>');
    expect(html).toContain('Keep exploring the demo');
    for (const r of ['Visitor', 'Viewer', 'Admin']) expect(html).toContain(r);
  });
  it('without auth configured there is no sign-in button, only the demo', () => {
    const html = door(access('none', { signIn: null }));
    expect(html).not.toContain('>Sign in</button>');
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
