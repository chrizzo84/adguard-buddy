"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'green' | 'purple' | 'orange';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [theme, setTheme] = useState<Theme>('green'); // Default theme

  // Effect to load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('adguard-buddy-theme') as Theme | null;
    if (savedTheme && ['green', 'purple', 'orange'].includes(savedTheme)) {
      setTheme(savedTheme);
    }
  }, []);

  // Effect to apply theme class to body and save to localStorage
  useEffect(() => {
    const body = document.body;
    // Remove old theme classes
    body.classList.remove('theme-green', 'theme-purple', 'theme-orange');
    // Add new theme class
    body.classList.add(`theme-${theme}`);
    // Save to localStorage
    localStorage.setItem('adguard-buddy-theme', theme);
  }, [theme]);

  const value = { theme, setTheme };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
