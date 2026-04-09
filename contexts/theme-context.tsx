import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

type ColorScheme = 'light' | 'dark';
type ThemeMode = ColorScheme | 'system';

interface ThemeContextType {
  colorScheme: ColorScheme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@app_theme_mode';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useSystemColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isLoading, setIsLoading] = useState(true);

  // Load saved theme preference on mount
  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system')) {
        setThemeModeState(savedTheme as ThemeMode);
      }
    } catch {
      // Failed to load theme preference
    } finally {
      setIsLoading(false);
    }
  };

  const setThemeMode = useCallback((mode: ThemeMode) => {
    // Update state immediately for instant UI response
    setThemeModeState(mode);
    // Save to storage in background
    AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch(() => {
      // Failed to save theme preference
    });
  }, []);

  // Determine the actual color scheme based on theme mode
  const colorScheme: ColorScheme =
    themeMode === 'system'
      ? systemColorScheme === 'dark' || systemColorScheme === 'light'
        ? systemColorScheme
        : 'light'
      : themeMode;

  const value = useMemo(
    () => ({ colorScheme, themeMode, setThemeMode }),
    [colorScheme, themeMode, setThemeMode]
  );

  // Don't render children until theme preference is loaded
  if (isLoading) {
    return null;
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
