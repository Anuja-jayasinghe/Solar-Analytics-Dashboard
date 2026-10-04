// tests/v3Cutover.test.js
//
// What makes v3 safe to be the default: old addresses still land somewhere sensible, an unknown address is a
// real 404, a crashing page does not blank the screen, the old dashboard is clearly marked, and production
// bundles carry no debug logging.

import { describe, it, expect, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import fs from 'node:fs';
import path from 'node:path';
import { legacyRedirect } from '../src/v3/routes.js';
import NotFoundPage from '../src/v3/pages/NotFoundPage.jsx';
import { AppErrorBoundary } from '../src/v3/ui/AppErrorBoundary.jsx';
import LegacyBanner from '../src/components/LegacyBanner.jsx';

describe('old addresses', () => {
  it('sends the old dashboard, demo, login and admin paths to their new home', () => {
    expect(legacyRedirect('/dashboard')).toBe('/');
    expect(legacyRedirect('/demodashbaard')).toBe('/');
    expect(legacyRedirect('/demosettings')).toBe('/settings');
    expect(legacyRedirect('/login')).toBe('/signin');
    expect(legacyRedirect('/signup')).toBe('/signin');
    expect(legacyRedirect('/access')).toBe('/signin');
    expect(legacyRedirect('/admin/dashboard')).toBe('/admin');
    expect(legacyRedirect('/admin/dashboard/ceb-billing')).toBe('/admin');
  });
  it('drops the old /v3 preview prefix', () => {
    expect(legacyRedirect('/v3')).toBe('/');
    expect(legacyRedirect('/v3/')).toBe('/');
    expect(legacyRedirect('/v3/pro')).toBe('/pro');
    expect(legacyRedirect('/v3/admin/bills')).toBe('/admin/bills');
  });
  it('tolerates a trailing slash and leaves everything else alone (that is the 404)', () => {
    expect(legacyRedirect('/dashboard/')).toBe('/');
    expect(legacyRedirect('/pro')).toBeNull();
    expect(legacyRedirect('/nowhere')).toBeNull();
    expect(legacyRedirect('/')).toBeNull();
    expect(legacyRedirect(undefined)).toBeNull();
    expect(legacyRedirect('/v30')).toBeNull();
  });
});

describe('404 page', () => {
  it('says the page does not exist, names the address, and offers the way back', () => {
    const html = renderToString(h(MemoryRouter, { initialEntries: ['/no/such/page'] }, h(NotFoundPage)));
    expect(html).toContain('404');
    expect(html).toContain('This page does not exist');
    expect(html).toContain('/no/such/page');
    expect(html).toContain('href="/"');
  });
});

describe('error boundary', () => {
  it('renders children normally', () => {
    expect(renderToString(h(AppErrorBoundary, null, h('p', null, 'fine')))).toContain('fine');
  });
  it('shows a plain message with a reload button instead of a blank screen when a page throws', () => {
    const state = AppErrorBoundary.getDerivedStateFromError();
    expect(state).toEqual({ failed: true });
    const b = new AppErrorBoundary({ children: null });
    b.state = state;
    const html = renderToString(b.render());
    expect(html).toContain('role="alert"');
    expect(html).toContain('Something went wrong');
    expect(html).toContain('Reload');
  });
  it('reports the error with console.error (kept in production builds)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    new AppErrorBoundary({}).componentDidCatch(new Error('boom'), { componentStack: 'in X' });
    expect(spy).toHaveBeenCalledWith('Render error', 'boom', 'in X');
    spy.mockRestore();
  });
});

describe('deprecated v1', () => {
  it('is labelled on every page and links to the new dashboard', () => {
    const html = renderToString(h(LegacyBanner));
    expect(html).toContain('V1');
    expect(html).toContain('DEPRECATED');
    expect(html).toContain('href="/"');
  });
  it('the legacy app is mounted under /v1 and the entry picks the app by that prefix', () => {
    const app = fs.readFileSync('src/App.jsx', 'utf8');
    expect(app).toMatch(/<Router basename="\/v1">/);
    expect(app).toContain('<LegacyBanner />');
    const main = fs.readFileSync('src/main.jsx', 'utf8');
    expect(main).toContain("path === '/v1'");
    expect(main).toContain('./v3/V3Root');
  });
});

describe('production hygiene', () => {
  const walk = (dir, out = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out);
      else if (/\.(js|jsx)$/.test(e.name)) out.push(p);
    }
    return out;
  };
  it('the new app contains no console.log/debug/info or debugger statements', () => {
    for (const f of walk('src/v3')) {
      const src = fs.readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/console\.(log|debug|info)\(/);
      expect(src, f).not.toMatch(/\bdebugger\b/);
    }
  });
  it('the production build strips log/debug/info but keeps warn and error', () => {
    const cfg = fs.readFileSync('vite.config.js', 'utf8');
    expect(cfg).toContain("pure: ['console.log', 'console.debug', 'console.info']");
    expect(cfg).not.toMatch(/drop:\s*\[[^\]]*console/);
  });
  it('no secret-looking variable is exposed to the browser bundle', () => {
    const env = fs.readFileSync('.env.example', 'utf8');
    expect(env).not.toMatch(/^VITE_[A-Z_]*(SECRET|SERVICE|PRIVATE|PASSWORD)/m);
  });
});
