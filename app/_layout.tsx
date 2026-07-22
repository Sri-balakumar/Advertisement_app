import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import 'react-native-reanimated';

import { AnimatedSplash } from '@/components/animated-splash';
import { AuthProvider, useAuth } from '@/context/auth';
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

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <RootNavigator />
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

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Show the animated splash until it finishes AND the stored session loads.
  const ready = splashDone && !initializing;

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
        <Stack.Screen name="ad-form" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="address" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="support" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="about" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="insights" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="enquiries" options={{ animation: 'slide_from_right' }} />
      </Stack>
      {!ready && <AnimatedSplash onDone={() => setSplashDone(true)} />}
    </>
  );
}
