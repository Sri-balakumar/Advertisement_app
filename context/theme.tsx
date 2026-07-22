import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

export type ThemePref = 'system' | 'light' | 'dark';
export type Scheme = 'light' | 'dark';

type ThemeContextValue = {
  /** The user's choice: follow the OS, or force light / dark. */
  pref: ThemePref;
  /** The effective scheme after resolving 'system'. */
  scheme: Scheme;
  setPref: (p: ThemePref) => void;
};

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'theme_pref';

/**
 * Holds the in-app light/dark preference (persisted) and exposes the effective
 * scheme. `useColorScheme` reads this, so flipping the toggle re-themes the
 * whole app; 'system' falls back to the OS setting.
 */
export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const system = useSystemColorScheme();
  const [pref, setPrefState] = useState<ThemePref>('system');

  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(STORAGE_KEY);
        if (v === 'light' || v === 'dark' || v === 'system') setPrefState(v);
      } catch {
        // ignore — default to following the system
      }
    })();
  }, []);

  const setPref = (p: ThemePref) => {
    setPrefState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  };

  const scheme: Scheme = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;

  return (
    <ThemeContext.Provider value={{ pref, scheme, setPref }}>{children}</ThemeContext.Provider>
  );
}

export function useThemePreference(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemePreference must be used within a ThemePreferenceProvider');
  return ctx;
}
