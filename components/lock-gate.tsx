/**
 * PIN wall in front of a Manage screen. Which screens need it is configured in
 * Odoo → Signage Scan → App Lock; see context/manage-lock.tsx.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { Header, Screen, useC } from '@/components/ui';
import { Brand, Radius, Type } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useManageLock } from '@/context/manage-lock';
import { LockSection, verifyManagePin } from '@/services/odoo';

/** Exactly four digits, matching PIN_LEN in the Odoo module. Entering the
 *  fourth submits on its own, so there is no Unlock button to press. */
const PIN_LEN = 4;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

export function LockGate({
  section,
  title,
  children,
}: {
  section: LockSection;
  title: string;
  children: ReactNode;
}) {
  const c = useC();
  const router = useRouter();
  const { user } = useAuth();
  const base = user?.base_url || '';
  const { requiresPin, autoLockSeconds, refresh } = useManageLock();

  // Unlocking is per visit and lives here, not in the provider — leaving the
  // screen throws it away, so coming back always asks again.
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [retryIn, setRetryIn] = useState(0);
  const alive = useRef(true);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Re-lock the moment the screen loses focus. Using focus rather than unmount
  // matters for Manage, which is a tab and stays mounted when you switch away.
  //
  // Re-reading the config on focus is what makes a PIN set in Odoo take effect
  // without restarting the app — otherwise the terminal keeps whatever it read
  // at startup and appears not to lock at all.
  useFocusEffect(
    useCallback(() => {
      refresh();
      return () => {
        setUnlocked(false);
        setPin('');
        setError('');
      };
    }, [refresh]),
  );

  // Backgrounding the app does not blur the screen, so without this an unlocked
  // screen would still be unlocked when the terminal is picked up again.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') setUnlocked(false);
    });
    return () => sub.remove();
  }, []);

  const clearIdle = () => {
    if (idle.current) {
      clearTimeout(idle.current);
      idle.current = null;
    }
  };

  // Idle countdown: every touch restarts it, so it never interrupts someone
  // mid-edit, but a screen left sitting on the counter locks itself.
  const armIdle = useCallback(() => {
    clearIdle();
    idle.current = setTimeout(() => {
      idle.current = null;
      console.log(`[lock] ${section}: idle ${autoLockSeconds}s — re-locking`);
      setUnlocked(false);
    }, autoLockSeconds * 1000);
  }, [autoLockSeconds, section]);

  useEffect(() => {
    if (unlocked) armIdle();
    else clearIdle();
    return clearIdle;
  }, [unlocked, armIdle]);

  // Count the throttle window down so the wait is visible rather than a dead pad.
  useEffect(() => {
    if (retryIn <= 0) return;
    const t = setTimeout(() => setRetryIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [retryIn]);

  if (!requiresPin(section) || unlocked) {
    return (
      // Report any touch without stealing it — returning false lets the gesture
      // carry on to the screen underneath.
      <View
        style={{ flex: 1 }}
        onStartShouldSetResponderCapture={() => {
          if (unlocked) armIdle();
          return false;
        }}>
        {children}
      </View>
    );
  }

  const submit = async (value: string) => {
    setChecking(true);
    setError('');
    try {
      const res = await verifyManagePin(base, value);
      if (!alive.current) return;
      if (res.ok) {
        setPin('');
        setUnlocked(true);
        return;
      }
      setPin('');
      if (res.retry_in) {
        setRetryIn(res.retry_in);
        setError(`Too many attempts. Try again in ${res.retry_in}s.`);
      } else if (typeof res.tries_left === 'number') {
        setError(`Wrong PIN — ${res.tries_left} attempt${res.tries_left === 1 ? '' : 's'} left.`);
      } else {
        setError('Wrong PIN.');
      }
    } catch (e: any) {
      if (!alive.current) return;
      setPin('');
      setError(e?.message || 'Could not check the PIN.');
    } finally {
      if (alive.current) setChecking(false);
    }
  };

  const press = (k: string) => {
    if (checking || retryIn > 0) return;
    setError('');
    if (k === 'del') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= PIN_LEN) return;
    const next = pin + k;
    setPin(next);
    if (next.length === PIN_LEN) submit(next);
  };

  return (
    <Screen>
      {/* Manage is a tab, so there isn't always somewhere to go back to. */}
      <Header
        title={title}
        onBack={router.canGoBack() ? () => router.back() : undefined}
        gradient={['#2563eb', '#22d3ee']}
      />
      <View style={styles.wrap}>
        <View style={[styles.badge, { backgroundColor: Brand.indigo + '18' }]}>
          <Ionicons name="lock-closed" size={30} color={Brand.indigo} />
        </View>
        <Text style={[Type.h2, { color: c.text, marginTop: 14 }]}>Enter PIN</Text>
        <Text style={[Type.caption, { color: c.textMuted, marginTop: 6, textAlign: 'center' }]}>
          {title} is locked. Ask the manager for the PIN.
        </Text>

        <View style={styles.dots}>
          {Array.from({ length: PIN_LEN }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { borderColor: c.border },
                i < pin.length && { backgroundColor: Brand.indigo, borderColor: Brand.indigo },
              ]}
            />
          ))}
        </View>

        {error ? (
          <View style={styles.err}>
            <Ionicons name="alert-circle" size={15} color={Brand.rose} />
            <Text style={[Type.caption, { color: Brand.rose, flexShrink: 1 }]}>
              {retryIn > 0 ? `Too many attempts. Try again in ${retryIn}s.` : error}
            </Text>
          </View>
        ) : (
          <View style={styles.err} />
        )}

        <View style={styles.pad}>
          {KEYS.map((k, i) =>
            k === '' ? (
              <View key={i} style={styles.key} />
            ) : (
              <Pressable
                key={i}
                onPress={() => press(k)}
                style={({ pressed }) => [
                  styles.key,
                  { backgroundColor: c.card, borderColor: c.border },
                  pressed && { opacity: 0.6 },
                ]}>
                {k === 'del' ? (
                  <Ionicons name="backspace-outline" size={22} color={c.text} />
                ) : (
                  <Text style={[styles.keyText, { color: c.text }]}>{k}</Text>
                )}
              </Pressable>
            ),
          )}
        </View>

        {/* No Unlock button — the fourth digit submits on its own. */}
        <View style={styles.checking}>
          {checking ? <ActivityIndicator color={Brand.indigo} size="small" /> : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', paddingHorizontal: 28, paddingTop: 26 },
  badge: { width: 62, height: 62, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 12, marginTop: 22, minHeight: 16 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  err: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, minHeight: 20 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 10, maxWidth: 260 },
  key: {
    width: 74,
    height: 58,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { fontSize: 22, fontWeight: '700' },
  checking: { height: 34, justifyContent: 'center' },
});
