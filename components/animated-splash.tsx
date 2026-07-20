import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/theme';

/**
 * Branded launch overlay: indigo→violet gradient, a pulsing ring behind the
 * "369" mark, then a smooth fade-out. Rendered above the app on cold start.
 */
export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const overlay = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(ring, {
        toValue: 1,
        duration: 1700,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ).start();

    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(950),
      Animated.timing(overlay, {
        toValue: 0,
        duration: 450,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => onDone());
  }, [logoOpacity, logoScale, overlay, ring]);

  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.7] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.root, { opacity: overlay }]}>
      <LinearGradient
        colors={Brand.splash}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        style={[styles.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
      />
      <Animated.View
        style={{ alignItems: 'center', opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>369</Text>
        </View>
        <Text style={styles.title}>369 Advertisement</Text>
        <Text style={styles.tag}>Discover · Scan · Save</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  ring: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 220,
    height: 220,
    marginTop: -110,
    marginLeft: -110,
    borderRadius: 110,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  badge: {
    width: 104,
    height: 104,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  badgeText: { color: '#fff', fontSize: 40, fontWeight: '800', letterSpacing: 1 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: 0.3 },
  tag: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 6, letterSpacing: 2 },
});
