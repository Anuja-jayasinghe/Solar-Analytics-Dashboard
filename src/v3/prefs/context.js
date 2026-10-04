import { createContext, useContext } from 'react';

// Per-viewer display preferences (saved in this browser).
//   hints:    hover/tap explanations on figures. OFF by default: they distract; switch on from the sidebar.
//   showMark: the "Mark above" line on the charts. ON by default; each chart can hide it.
export const PREF_DEFAULTS = Object.freeze({ hints: false, showMark: true });

export const PrefsContext = createContext({ ...PREF_DEFAULTS, setHints: () => {}, setShowMark: () => {} });

export function usePrefs() {
  return useContext(PrefsContext);
}
