import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);

/** Set to false to restore dark mode + navbar toggle in MainLayout. */
export const THEME_SWITCH_UI_ENABLED = false;

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() =>
    THEME_SWITCH_UI_ENABLED ? localStorage.getItem('theme') || 'light' : 'light'
  );

  useEffect(() => {
    if (THEME_SWITCH_UI_ENABLED) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    }
  }, [theme]);

  const toggle = () => {
    if (THEME_SWITCH_UI_ENABLED) {
      setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
    }
  };

  const value = useMemo(
    () => ({
      theme: THEME_SWITCH_UI_ENABLED ? theme : 'light',
      setTheme: THEME_SWITCH_UI_ENABLED ? setTheme : () => {},
      toggle,
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme outside provider');
  }
  return ctx;
}
