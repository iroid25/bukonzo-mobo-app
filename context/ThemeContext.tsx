import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme, Platform } from 'react-native';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: 'light' | 'dark';
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [theme, setTheme] = useState<'light' | 'dark'>(systemColorScheme === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    // Load saved preference
    const loadTheme = async () => {
      if (Platform.OS !== 'web') {
        try {
          const savedMode = await SecureStore.getItemAsync('theme-mode');
          if (savedMode) {
            setModeState(savedMode as ThemeMode);
          }
        } catch (error) {
          console.error('Failed to load theme:', error);
        }
      }
    };
    loadTheme();
  }, []);

  useEffect(() => {
    // Update theme based on mode and system scheme
    if (mode === 'system') {
      setTheme(systemColorScheme === 'dark' ? 'dark' : 'light');
    } else {
      setTheme(mode);
    }
  }, [mode, systemColorScheme]);

  const setMode = async (newMode: ThemeMode) => {
    setModeState(newMode);
    if (Platform.OS !== 'web') {
      try {
        await SecureStore.setItemAsync('theme-mode', newMode);
      } catch (error) {
        console.error('Failed to save theme:', error);
      }
    }
  };

  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode, isDark }}>
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
