import { useCallback, useMemo, useState } from 'react';
import { readPref, writePref } from '../theme/storage.js';
import { PREF_DEFAULTS, PrefsContext } from './context.js';

const readBool = (key, fallback) => {
  const v = readPref(key, null);
  return v === 'on' ? true : v === 'off' ? false : fallback;
};

export function PrefsProvider({ children }) {
  const [showMark, setShowMarkState] = useState(() => readBool('mark', PREF_DEFAULTS.showMark));
  const setShowMark = useCallback((v) => { setShowMarkState(v); writePref('mark', v ? 'on' : 'off'); }, []);
  const value = useMemo(() => ({ showMark, setShowMark }), [showMark, setShowMark]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}
