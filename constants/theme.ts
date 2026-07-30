/**
 * NEXGENN Price Checker — design tokens.
 * Indigo → violet brand system with light/dark surfaces.
 */
import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1f2937',
    textMuted: '#6b7280',
    background: '#f4f5f7',
    card: '#ffffff',
    tint: '#4f46e5',
    icon: '#6b7280',
    border: '#eceef2',
    tabIconDefault: '#9aa0ac',
    tabIconSelected: '#4f46e5',
    tabBar: '#ffffff',
  },
  dark: {
    text: '#f5f6fa',
    textMuted: '#9aa0ac',
    background: '#0b0b12',
    card: '#16161f',
    tint: '#9b8cff',
    icon: '#9aa0ac',
    border: '#24242f',
    tabIconDefault: '#6b7280',
    tabIconSelected: '#9b8cff',
    tabBar: '#12121b',
  },
};

export type ColorScheme = keyof typeof Colors;

/** Brand constants that stay the same in light & dark. */
export const Brand = {
  indigo: '#4f46e5',
  indigoDeep: '#4338ca',
  violet: '#7c3aed',
  cyan: '#22d3ee',
  amber: '#f59e0b',
  rose: '#f43f5e',
  emerald: '#10b981',
  /** Primary hero gradient. */
  gradient: ['#4f46e5', '#7c3aed'] as const,
  /** Deep splash gradient (top → bottom). */
  splash: ['#312e81', '#4f46e5', '#7c3aed'] as const,
};

/** A palette of gradients we cycle through for cards / banners. */
export const Gradients: [string, string][] = [
  ['#4f46e5', '#7c3aed'],
  ['#f43f5e', '#f59e0b'],
  ['#06b6d4', '#3b82f6'],
  ['#10b981', '#06b6d4'],
  ['#8b5cf6', '#ec4899'],
  ['#f59e0b', '#ef4444'],
];

/** One typographic scale used across the app (clean/minimal system). */
export const Type = {
  h1: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.3 },
  h2: { fontSize: 19, fontWeight: '800' as const, letterSpacing: -0.2 },
  title: { fontSize: 16.5, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '500' as const },
  label: { fontSize: 13, fontWeight: '600' as const },
  caption: { fontSize: 12.5, fontWeight: '500' as const },
  section: { fontSize: 12, fontWeight: '800' as const, letterSpacing: 1 },
} as const;

export const Radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 26,
  pill: 999,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Shadow = {
  card: {
    shadowColor: '#4f46e5',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  soft: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
});
