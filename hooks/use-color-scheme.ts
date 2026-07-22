import { useContext } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { ThemeContext } from '@/context/theme';

/**
 * The effective color scheme. Respects the in-app theme toggle
 * (ThemePreferenceProvider) and falls back to the OS scheme when no preference
 * provider is mounted.
 */
export function useColorScheme(): 'light' | 'dark' {
  const ctx = useContext(ThemeContext);
  const system = useRNColorScheme();
  return ctx?.scheme ?? (system === 'dark' ? 'dark' : 'light');
}
