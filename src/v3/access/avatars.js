// src/v3/access/avatars.js
//
// The preset profile pictures. Each is an icon on a tinted disc, drawn from theme tokens, so it recolours with
// the theme. 'initial' (the default) shows the first letter of the name. Pure data + helpers, unit tested.

export const AVATARS = Object.freeze([
  { id: 'initial', label: 'Initial', icon: null, tone: 'gen' },
  { id: 'sun', label: 'Sun', icon: 'sun', tone: 'gen' },
  { id: 'bolt', label: 'Bolt', icon: 'bolt', tone: 'warn' },
  { id: 'panel', label: 'Panel', icon: 'panel', tone: 'ceb' },
  { id: 'leaf', label: 'Leaf', icon: 'leaf', tone: 'good' },
  { id: 'moon', label: 'Moon', icon: 'moon', tone: 'ceb' },
  { id: 'cloud', label: 'Cloud', icon: 'cloud', tone: 'ceb' },
  { id: 'mountain', label: 'Mountain', icon: 'mountain', tone: 'good' },
  { id: 'star', label: 'Star', icon: 'star', tone: 'warn' }
]);

export const NICKNAME_MAX = 24;

export function avatarById(id) {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}

/** Trimmed, single-spaced, at most NICKNAME_MAX characters; empty means "no nickname". */
export function cleanNickname(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, NICKNAME_MAX);
}

/** What to call the person: nickname, else first name, else the part of the email before @, else the role. */
export function displayNameFor({ nickname, firstName, email, fallback }) {
  return cleanNickname(nickname) || (firstName ?? '').trim() || (email ? String(email).split('@')[0] : '') || fallback;
}

/** The letter shown on the 'initial' avatar. */
export function initialOf(name) {
  const c = String(name ?? '').trim().charAt(0);
  return c ? c.toUpperCase() : '?';
}

/** A stored profile (from Clerk's unsafeMetadata or the browser) -> a safe one. Unknown avatars fall back. */
export function normalizeProfile(raw) {
  return { nickname: cleanNickname(raw?.nickname), avatar: avatarById(raw?.avatar).id };
}
