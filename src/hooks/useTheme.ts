import { useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeColor = 'rose' | 'sage' | 'lavender' | 'champagne' | 'ocean' | 'peach' | 'slate' | 'default';

export const THEME_COLORS: { label: string; value: ThemeColor }[] = [
  { label: 'Default', value: 'default' },
  { label: 'Rose Quartz', value: 'rose' },
  { label: 'Sage Harmony', value: 'sage' },
  { label: 'Lavender Dream', value: 'lavender' },
  { label: 'Champagne Gold', value: 'champagne' },
  { label: 'Ocean Mist', value: 'ocean' },
  { label: 'Sunset Peach', value: 'peach' },
  { label: 'Slate Minimal', value: 'slate' },
];

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('notes_theme_mode');
      if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
      if (stored === 'true-black') return 'dark'; // Migrate old true-black
    }
    return 'system';
  });

  const [color, setColorState] = useState<ThemeColor>(() => {
    if (typeof window !== 'undefined') {
      const storedColor = localStorage.getItem('notes_theme_color') as ThemeColor | null;
      if (storedColor && THEME_COLORS.some(t => t.value === storedColor)) return storedColor;
      
      // Migrate old true-black mode to slate color
      const storedMode = localStorage.getItem('notes_theme_mode');
      if (storedMode === 'true-black') return 'slate';
    }
    return 'default';
  });

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Listen to OS prefers-color-scheme live
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handler = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && systemIsDark);
  const resolvedTheme: 'light' | 'dark' = isDark ? 'dark' : 'light';

  // Apply .dark and [data-theme] attribute to root with smooth transition
  useEffect(() => {
    const root = document.documentElement;
    
    // Add temporary transition class
    root.classList.add('theme-transition');
    const timer = setTimeout(() => {
      root.classList.remove('theme-transition');
    }, 300);

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    if (color !== 'default') {
      root.setAttribute('data-theme', color);
    } else {
      root.removeAttribute('data-theme');
    }

    localStorage.setItem('notes_theme_mode', mode);
    localStorage.setItem('notes_theme_color', color);

    return () => clearTimeout(timer);
  }, [isDark, mode, color]);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
  }, []);

  const setColor = useCallback((newColor: ThemeColor) => {
    setColorState(newColor);
  }, []);

  const toggleTheme = useCallback(() => {
    setModeState((current) => {
      if (current === 'light') return 'dark';
      if (current === 'dark') return 'system';
      return 'light';
    });
  }, []);

  return {
    mode,
    color,
    setMode,
    setColor,
    isDark,
    resolvedTheme,
    toggleTheme,
    theme: isDark ? 'dark' : 'light',
  };
}
