import { useCallback, useMemo, useState } from 'react';
import { THEMES, resolveTheme, nextTheme, schemeOf } from './themes.js';
import { readPref, writePref } from './storage.js';
import { ThemeContext } from './context.js';

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => resolveTheme(readPref('theme', null)));

  const setTheme = useCallback((id) => {
    const next = resolveTheme(id);
    setThemeState(next);
    writePref('theme', next);
  }, []);

  const cycle = useCallback(() => setTheme(nextTheme(theme)), [theme, setTheme]);

  const value = useMemo(() => ({ theme, scheme: schemeOf(theme), themes: THEMES, setTheme, cycle }), [theme, setTheme, cycle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
