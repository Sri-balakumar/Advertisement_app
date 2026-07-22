import { useContext, useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { ThemeContext } from '@/context/theme';

/**
 * Web variant: recalculated on the client after hydration to support static
 * rendering. Respects the in-app theme toggle once mounted, and otherwise the
 * OS scheme.
 */
export function useColorScheme(): 'light' | 'dark' {
  const [hasHydrated, setHasHydrated] = useState(false);
  useEffect(() => setHasHydrated(true), []);

  const ctx = useContext(ThemeContext);
  const system = useRNColorScheme();

  if (!hasHydrated) return 'light';
  return ctx?.scheme ?? (system === 'dark' ? 'dark' : 'light');
}
