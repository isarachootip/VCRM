'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'dark' | 'light';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('artifact_theme') as Theme | null;
      if (saved && (saved === 'dark' || saved === 'light' || saved === 'system')) {
        setThemeState(saved);
      } else {
        setThemeState('dark');
      }
    } catch {
      setThemeState('dark');
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    let actual: 'dark' | 'light' = 'dark';

    if (theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      actual = media.matches ? 'dark' : 'light';
    } else {
      actual = theme;
    }

    setResolvedTheme(actual);

    if (actual === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }

    try {
      localStorage.setItem('artifact_theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (t: Theme) => {
    setThemeState(t);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: 'dark' as Theme,
      resolvedTheme: 'dark' as 'dark' | 'light',
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return ctx;
};
