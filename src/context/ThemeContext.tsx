'use client';

import React, { createContext, useContext, useEffect } from 'react';

type Theme = 'light';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    try {
      localStorage.removeItem('artifact_theme');
      localStorage.setItem('vcrm_theme', 'light');
    } catch {
      // ignore
    }

    const root = document.documentElement;
    root.classList.remove('dark');
    root.classList.add('light');
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: 'light', resolvedTheme: 'light', setTheme: () => {}, toggleTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: 'light' as Theme,
      resolvedTheme: 'light' as const,
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return ctx;
};

