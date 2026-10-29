// src/v3/routes.js
//
// Where old addresses go now that v3 is the only app. People have bookmarks and links to the old
// paths: the v1 dashboard's own routes, its home under /v1 (deprecated at the v3 cutover, removed
// 2026-10-29), and the new app's preview under /v3.
// Pure, so every rule is unit tested. Returns the new path, or null when the path needs no redirect.

const EXACT = {
  '/dashboard': '/',
  '/demodashbaard': '/', // the old demo route, with its typo: the new Overview is the demo for visitors
  '/demosettings': '/settings',
  '/login': '/signin',
  '/access': '/signin'
};

// Top-level v3 pages, for /v1/<page> addresses that already match one.
const V3_PAGES = new Set(['/pro', '/settings', '/signin', '/signup', '/admin']);

export function legacyRedirect(pathname) {
  if (typeof pathname !== 'string') return null;
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (Object.prototype.hasOwnProperty.call(EXACT, p)) return EXACT[p];
  if (p === '/admin/dashboard' || p.startsWith('/admin/dashboard/')) return '/admin';
  // The removed v1 app: its page, if it has a v3 equivalent, otherwise the Overview.
  if (p === '/v1') return '/';
  if (p.startsWith('/v1/')) {
    const inner = p.slice(3);
    return legacyRedirect(inner) ?? (V3_PAGES.has(inner) ? inner : '/');
  }
  if (p === '/v3') return '/';
  if (p.startsWith('/v3/')) return p.slice(3) || '/'; // the preview prefix is simply dropped
  return null;
}
