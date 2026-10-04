import { useCallback, useMemo, useState } from 'react';
import { readPref, writePref } from '../theme/storage.js';
import { PREF_DEFAULTS, PrefsContext } from './context.js';

const readBool = (key, fallback) => {
  const v = readPref(key, null);
  return v === 'on' ? true : v === 'off' ? false : fallback;
};

export function PrefsProvider({ children }) {
  const [hints, setHintsState] = useState(() => readBool('hints', PREF_DEFAULTS.hints));
  const [showMark, setShowMarkState] = useState(() => readBool('mark', PREF_DEFAULTS.showMark));
  const setHints = useCallback((v) => { setHintsState(v); writePref('hints', v ? 'on' : 'off'); }, []);
  const setShowMark = useCallback((v) => { setShowMarkState(v); writePref('mark', v ? 'on' : 'off'); }, []);
  const value = useMemo(() => ({ hints, showMark, setHints, setShowMark }), [hints, showMark, setHints, setShowMark]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}
