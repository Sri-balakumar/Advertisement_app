import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
  useFonts,
} from '@expo-google-fonts/inter';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as NavigationBar from 'expo-navigation-bar';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Image, Platform } from 'react-native';
import 'react-native-reanimated';

import '@/lib/global-font'; // side-effect: apply Inter to all Text/TextInput
import { AnimatedSplash } from '@/components/animated-splash';
import { RouteError } from '@/components/route-error';
import { AuthProvider, useAuth } from '@/context/auth';
import { ManageLockProvider } from '@/context/manage-lock';
import { TabBarProvider } from '@/context/tabbar';
import { ThemePreferenceProvider } from '@/context/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

// expo-router renders this instead of a blank screen when a route throws.
export { RouteError as ErrorBoundary };

/**
 * Startup tracing. Every line is prefixed [boot] so you can filter the Metro
 * console with it. Remove this block once the launch sequence is understood.
 */
const boot = (...args: unknown[]) => console.log('[boot]', ...args);

boot('module init — resolving branding assets…');
try {
  const assets: Record<string, number> = {
    'splash logo (logo-369-ad)': require('@/assets/images/logo-369-ad.png'),
    'app icon (icon.png)': require('@/assets/images/icon.png'),
    'nexgenn wordmark': require('@/assets/images/nexgenn-pos.png'),
    'alphalize wordmark': require('@/assets/images/alphalize.png'),
  };
  for (const [label, mod] of Object.entries(assets)) {
    const src = Image.resolveAssetSource(mod);
    boot(`  ${label}: ${src?.width}x${src?.height} → ${src?.uri}`);
  }
} catch (e: any) {
  boot('  ASSET RESOLVE FAILED:', e?.message || e);
}

SplashScreen.preventAutoHideAsync()
  .then(() => boot('native splash: auto-hide prevented'))
  .catch((e) => boot('native splash: preventAutoHide FAILED —', e?.message || e));

export default function RootLayout() {
  return (
    <ThemePreferenceProvider>
      <ThemedRoot />
    </ThemePreferenceProvider>
  );
}

function ThemedRoot() {
  const colorScheme = useColorScheme();

  // Contrast the Android nav-bar icons with the theme (best-effort; fully
  // applies in a dev/prod build). Light icons in dark mode, dark in light.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    try {
      NavigationBar.setButtonStyleAsync(colorScheme === 'dark' ? 'light' : 'dark').catch(() => {});
    } catch {
      // native module unavailable in this runtime — ignore
    }
  }, [colorScheme]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        {/* Inside AuthProvider — the lock config is fetched from the signed-in
            user's server. */}
        <ManageLockProvider>
          <TabBarProvider>
            <RootNavigator />
          </TabBarProvider>
        </ManageLockProvider>
      </AuthProvider>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { user, onboarded, initializing } = useAuth();
  const router = useRouter();
  const [splashDone, setSplashDone] = useState(false);
  const routed = useRef(false);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  useEffect(() => {
    boot('RootNavigator mounted — hiding native splash');
    SplashScreen.hideAsync()
      .then(() => boot('native splash: hidden'))
      .catch((e) => boot('native splash: hideAsync FAILED —', e?.message || e));
  }, []);

  // Show the animated splash until it finishes AND the session + fonts load.
  const ready = splashDone && !initializing && fontsLoaded;

  // Which of the three gates is still holding the splash up?
  useEffect(() => {
    boot(
      `gates → splashDone=${splashDone} fontsLoaded=${fontsLoaded} authInitializing=${initializing} ⇒ ready=${ready}`,
    );
    if (!ready) {
      const waiting = [
        !splashDone && 'splash animation',
        !fontsLoaded && 'Inter fonts',
        initializing && 'auth session',
      ].filter(Boolean);
      boot('  still waiting on:', waiting.join(', '));
    }
  }, [splashDone, fontsLoaded, initializing, ready]);

  // Decide the initial destination once, after splash + session are known.
  useEffect(() => {
    if (!ready || routed.current) return;
    routed.current = true;
    boot(`routing → onboarded=${onboarded} signedIn=${!!user}`);
    if (!onboarded) {
      boot('  → /onboarding');
      router.replace('/onboarding');
    } else if (!user) {
      boot('  → /login');
      router.replace('/login');
    } else {
      boot('  → staying on (tabs)');
    }
  }, [ready, onboarded, user, router]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
        <Stack.Screen name="banners" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="scan-fields" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="scan-config" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="scan-settings" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="banner-form" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="products" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="product-form" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="scan-history" options={{ animation: 'slide_from_right' }} />
      </Stack>
      {!ready && <AnimatedSplash onDone={() => setSplashDone(true)} />}
    </>
  );
}
