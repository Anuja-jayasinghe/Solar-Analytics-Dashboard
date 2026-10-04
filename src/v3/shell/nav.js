// src/v3/shell/nav.js
//
// The navigation, as data. One list drives the desktop sidebar and the phone tab bar, so the two
// can never disagree. `min` is the access level needed to SEE the item (the API enforces it for real).
//
// Pro metrics is visible to everyone: visitors get a demo Pro page (decision D-9). Admin is admin only.

import { canSee } from '../access/level.js';

export const NAV = Object.freeze([
  Object.freeze({ id: 'overview', path: '/', label: 'Overview', title: 'Overview', icon: 'overview', min: 'none', group: 'main', end: true }),
  Object.freeze({ id: 'pro', path: '/pro', label: 'Pro metrics', title: 'Pro metrics', icon: 'pro', min: 'none', group: 'main' }),
  Object.freeze({ id: 'admin', path: '/admin', label: 'Admin', title: 'Admin', icon: 'admin', min: 'admin', group: 'main' }),
  Object.freeze({ id: 'settings', path: '/settings', label: 'Settings', title: 'Settings', icon: 'settings', min: 'none', group: 'foot' })
]);

/** Items this level may see, in display order. */
export function navFor(level) {
  return NAV.filter((n) => canSee(level, n.min));
}

export function navGroup(level, group) {
  return navFor(level).filter((n) => n.group === group);
}

/** Page title for a pathname (header). Unknown paths get the product name. */
export function titleFor(pathname) {
  if (pathname === '/signin') return 'Sign in';
  const hit = NAV.filter((n) => (n.end ? pathname === n.path : pathname === n.path || pathname.startsWith(`${n.path}/`)))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return hit ? hit.title : 'Solar Analytics';
}
