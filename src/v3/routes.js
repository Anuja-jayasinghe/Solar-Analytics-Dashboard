// src/v3/routes.js
//
// Where old addresses go now that v3 is the app at "/". The previous dashboard lives under /v1 (deprecated),
// but people have bookmarks and links to the old paths, and the new app's own preview lived under /v3.
// Pure, so every rule is unit tested. Returns the new path, or null when the path needs no redirect.

const EXACT = {
  '/dashboard': '/',
  '/demodashbaard': '/', // the old demo route, with its typo: the new Overview is the demo for visitors
  '/demosettings': '/settings',
  '/login': '/signin',
  '/signup': '/signin',
  '/access': '/signin'
};

export function legacyRedirect(pathname) {
  if (typeof pathname !== 'string') return null;
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (Object.prototype.hasOwnProperty.call(EXACT, p)) return EXACT[p];
  if (p === '/admin/dashboard' || p.startsWith('/admin/dashboard/')) return '/admin';
  if (p === '/v3') return '/';
  if (p.startsWith('/v3/')) return p.slice(3) || '/'; // the preview prefix is simply dropped
  return null;
}
