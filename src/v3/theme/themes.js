// src/v3/theme/themes.js
//
// The theme registry. A theme is ONLY a block of CSS variables in styles/tokens.css keyed by
// `[data-theme="<id>"]`; components read tokens and never a literal colour. To add a theme:
//   1. add a `[data-theme="<id>"]` block to styles/tokens.css (every token the others define),
//   2. add one entry here.
// Nothing else changes. Settings > Appearance lists whatever is registered.
//
// `preview` is the four swatches the Settings card paints (it cannot read another theme's CSS).

export const THEMES = Object.freeze([
  Object.freeze({
    id: 'dark',
    name: 'Sunrise Night',
    note: 'Dark first. Orange on navy.',
    scheme: 'dark',
    preview: Object.freeze({ bg: '#0A0F1F', glass: 'rgba(255,255,255,.14)', gen: '#FF8A1F', ceb: '#5AA9FF' })
  }),
  Object.freeze({
    id: 'light',
    name: 'Sunrise Day',
    note: 'Warm paper, same orange.',
    scheme: 'light',
    preview: Object.freeze({ bg: '#F5F2EC', glass: 'rgba(255,255,255,.95)', gen: '#F26A00', ceb: '#2D7DE0' })
  })
]);

export const DEFAULT_THEME = 'dark';

export function isThemeId(id) {
  return THEMES.some((t) => t.id === id);
}

/** A stored value that is no longer a registered theme falls back to the default (never throws). */
export function resolveTheme(stored) {
  return isThemeId(stored) ? stored : DEFAULT_THEME;
}

/** The next theme in registry order (the header button cycles; Settings picks directly). */
export function nextTheme(id) {
  const i = THEMES.findIndex((t) => t.id === id);
  return THEMES[(i + 1) % THEMES.length].id;
}

/** `color-scheme` for native controls (date pickers, scrollbars). */
export function schemeOf(id) {
  return THEMES.find((t) => t.id === id)?.scheme ?? 'dark';
}
