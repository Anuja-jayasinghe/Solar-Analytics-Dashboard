// src/v3/access/level.js
//
// What a visitor may SEE in the browser. This is a convenience only: the API enforces access
// server-side (api/_lib/verifyAdminToken.js). Hiding a screen here never protects data.
//
// Levels come from shared/domain/access.js: 'none' (demo), 'viewer', 'admin'.

import { accessLevelFromMetadata, satisfiesLevel } from '../../../shared/domain/access.js';

/**
 * @param {{isLoaded:boolean, isSignedIn?:boolean, publicMetadata?:object|null, gaveUp?:boolean, hintSignedOut?:boolean}} u  Clerk's useUser() shape.
 *   `gaveUp`: Clerk did not finish loading in time (wrong domain, offline, blocked): treat as signed out so the demo still works.
 *   `hintSignedOut`: Clerk's own cookie says nobody is signed in, so the demo can start now instead of waiting for Clerk's script.
 * @returns {'loading'|'none'|'viewer'|'admin'}
 */
export function levelForUser(u) {
  if (!u) return 'loading';
  if (!u.isLoaded) return u.gaveUp || u.hintSignedOut ? 'none' : 'loading';
  if (!u.isSignedIn) return 'none';
  return accessLevelFromMetadata(u.publicMetadata);
}

/** Real data is only requested for viewers and admins; everyone else runs on the demo source. */
export function dataModeFor(level) {
  return satisfiesLevel(level, 'viewer') ? 'live' : 'demo';
}

/** Does `level` meet the screen's requirement? 'loading' never does. */
export function canSee(level, required) {
  if (required === 'none' || required === undefined) return level !== 'loading';
  return satisfiesLevel(level, required);
}

export const ROLE_LABELS = Object.freeze({
  none: { label: 'Visitor', sub: 'Demo data' },
  viewer: { label: 'Viewer', sub: 'Real data, read only' },
  admin: { label: 'Admin', sub: 'Full access' }
});

export function roleLabel(level) {
  return ROLE_LABELS[level] ?? ROLE_LABELS.none;
}

/**
 * Does Clerk's own cookie say nobody is signed in? Clerk sets `__client_uat` (a readable timestamp, "0" when signed
 * out) on the app's domain. No cookie, or only zeros, means a first-time or signed-out visitor: they get the demo
 * immediately, without waiting for Clerk's script. If it is wrong in either direction nothing unsafe happens:
 * the API enforces access, and once Clerk loads the real state replaces the guess.
 * @param {string} cookieString  document.cookie
 */
export function signedOutHint(cookieString) {
  const values = [...String(cookieString ?? '').matchAll(/(?:^|;\s*)__client_uat(?:_[A-Za-z0-9]+)?=([^;]*)/g)].map((m) => m[1].trim());
  return values.every((v) => v === '' || v === '0');
}
