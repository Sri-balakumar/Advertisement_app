import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Image, StyleSheet, Text, View } from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');

const BG = '#EBF1FC';
const WAVE = '#DCE6FA';
const NAVY = '#1e2a5a';

type Card = { icon: keyof typeof Ionicons.glyphMap; color: string; x: number; y: number };

// Floating "what the app does" chips: an ad, a QR, a price tag, a carousel.
const CARDS: Card[] = [
  { icon: 'megaphone', color: '#4f46e5', x: 0.12, y: 0.16 },
  { icon: 'qr-code', color: '#7c3aed', x: 0.74, y: 0.2 },
  { icon: 'pricetags', color: '#f43f5e', x: 0.15, y: 0.66 },
  { icon: 'albums', color: '#06b6d4', x: 0.72, y: 0.64 },
];

/**
 * Branded launch overlay — the "369 light intro". A light background, the 369
 * logo scaling in, drifting ad/QR/price chips, a "Scroll · Scan · Save"
 * headline over a soft wave, and the Alphalize wordmark; then a smooth fade-out.
 */
export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const overlay = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const up = useRef(new Animated.Value(0)).current; // headline + wordmark rise-in
  const float = useRef(new Animated.Value(0)).current; // cards gentle drift

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(up, { toValue: 1, delay: 500, duration: 700, useNativeDriver: true }),
      ]),
      Animated.delay(1000),
      Animated.timing(overlay, {
        toValue: 0,
        duration: 500,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => onDone());
  }, [logoOpacity, logoScale, overlay, up, float]);

  const rise = up.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  const floatUp = float.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const floatDown = float.interpolate({ inputRange: [0, 1], outputRange: [0, 10] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.root, { opacity: overlay }]}>
      <StatusBar style="dark" />

      {/* soft wave band that seats the wordmark */}
      <View style={styles.wave} />

      {/* floating feature chips */}
      {CARDS.map((card, i) => (
        <Animated.View
          key={card.icon}
          style={[
            styles.card,
            {
              left: card.x * SW,
              top: card.y * SH,
              transform: [{ translateY: i % 2 === 0 ? floatUp : floatDown }],
            },
          ]}>
          <Ionicons name={card.icon} size={24} color={card.color} />
        </Animated.View>
      ))}

      {/* center: 369 logo + headline */}
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Animated.Image
          source={require('../assets/images/logo-369-ad.png')}
          resizeMode="contain"
          style={[styles.logo, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
        />
        <Animated.View
          style={{ alignItems: 'center', opacity: up, transform: [{ translateY: rise }] }}>
          <Text style={styles.headline}>Scroll · Scan · Save</Text>
          <View style={styles.underline} />
        </Animated.View>
      </View>

      {/* Alphalize wordmark */}
      <Animated.View style={[styles.bottom, { opacity: up }]}>
        <Image
          source={require('../assets/images/alphalize.png')}
          resizeMode="contain"
          style={styles.wordmark}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: BG },
  wave: {
    position: 'absolute',
    bottom: 0,
    left: -SW * 0.3,
    right: -SW * 0.3,
    height: SH * 0.3,
    backgroundColor: WAVE,
    borderTopLeftRadius: SW * 0.9,
    borderTopRightRadius: SW * 0.9,
  },
  card: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#334155',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  logo: { width: 260, height: 122, marginBottom: 22 },
  headline: { fontSize: 22, fontWeight: '900', color: NAVY, letterSpacing: 0.3 },
  underline: { width: 64, height: 4, borderRadius: 2, backgroundColor: '#4f46e5', marginTop: 10 },
  bottom: { position: 'absolute', bottom: 46, left: 0, right: 0, alignItems: 'center' },
  wordmark: { width: 168, height: 46 },
});
