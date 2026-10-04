// src/v3/theme/storage.js
//
// Per-viewer conveniences (theme, collapsed sidebar). localStorage can be missing, full, blocked
// or throw (private windows, cleared site data), so every access is wrapped and the UI must render
// correctly without it.

const PREFIX = 'solar.v3.';

export function readPref(key, fallback, storage = globalThis.localStorage) {
  try {
    const v = storage?.getItem(PREFIX + key);
    return v === null || v === undefined ? fallback : v;
  } catch {
    return fallback;
  }
}

export function writePref(key, value, storage = globalThis.localStorage) {
  try {
    storage?.setItem(PREFIX + key, String(value));
    return true;
  } catch {
    return false;
  }
}
