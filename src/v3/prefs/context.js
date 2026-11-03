import { createContext, useContext } from 'react';

// Per-viewer display preferences (saved in this browser).
//   showMark: the "Mark above" line on the charts. ON by default; each chart can hide it.
// There is no hints switch any more: explanations sit behind info icons (ui/Info.jsx) and chart details always
// show on hover (ui/Tip.jsx). A saved 'hints' value from before is simply ignored.
export const PREF_DEFAULTS = Object.freeze({ showMark: true });

export const PrefsContext = createContext({ ...PREF_DEFAULTS, setShowMark: () => {} });

export function usePrefs() {
  return useContext(PrefsContext);
}
