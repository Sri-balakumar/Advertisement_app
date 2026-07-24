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
import { Platform } from 'react-native';
import 'react-native-reanimated';

import '@/lib/global-font'; // side-effect: apply Inter to all Text/TextInput
import { AnimatedSplash } from '@/components/animated-splash';
import { AuthProvider, useAuth } from '@/context/auth';
import { TabBarProvider } from '@/context/tabbar';
import { ThemePreferenceProvider } from '@/context/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

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
        <TabBarProvider>
          <RootNavigator />
        </TabBarProvider>
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
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Show the animated splash until it finishes AND the session + fonts load.
  const ready = splashDone && !initializing && fontsLoaded;

  // Decide the initial destination once, after splash + session are known.
  useEffect(() => {
    if (!ready || routed.current) return;
    routed.current = true;
    if (!onboarded) {
      router.replace('/onboarding');
    } else if (!user) {
      router.replace('/login');
    }
    // else: already anchored on (tabs)
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
