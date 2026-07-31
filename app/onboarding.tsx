import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import {
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Aspect ratio of nexgenn-pos.png (1065×234). */
const LOGO_RATIO = 1065 / 234;

type Slide = {
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  title: string;
  text: string;
};

const SLIDES: Slide[] = [
  {
    icon: 'tv',
    accent: '#4f46e5',
    title: 'Signage that never sleeps',
    text: 'Images and videos play full-screen across your store screens all day — your storefront, always on.',
  },
  {
    icon: 'barcode',
    accent: '#7c3aed',
    title: 'Scan for instant prices',
    text: 'Show a product barcode to the camera or a USB scanner and its details and price appear at once.',
  },
  {
    icon: 'options',
    accent: '#10b981',
    title: 'You control what shows',
    text: 'Manage banners and pick exactly which product fields appear on scan — all from this app. Built by Alphalize.',
  },
];

export default function Onboarding() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const dark = scheme === 'dark';
  // Decorative bottom wave: a soft brand tint in light, a subtle violet glow in dark.
  const waveColor = dark ? 'rgba(124,58,237,0.12)' : '#DCE6FA';
  const dotIdle = dark ? 'rgba(255,255,255,0.22)' : 'rgba(30,42,90,0.22)';

  const { width: winW, height: winH } = useWindowDimensions();
  // Header-sized on a phone, noticeably larger on a tablet.
  const logoW = Math.min(Math.max(winW * 0.36, 140), 320);

  const ref = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const router = useRouter();
  const { completeOnboarding, user } = useAuth();

  const finish = async () => {
    await completeOnboarding();
    router.replace(user ? '/' : '/login');
  };

  const next = () => {
    if (index < SLIDES.length - 1) {
      const n = index + 1;
      ref.current?.scrollToOffset({ offset: n * winW, animated: true });
      setIndex(n);
    } else {
      finish();
    }
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setIndex(Math.round(e.nativeEvent.contentOffset.x / winW));

  const last = index === SLIDES.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <View
        style={[
          styles.wave,
          {
            backgroundColor: waveColor,
            left: -winW * 0.3,
            right: -winW * 0.3,
            height: winH * 0.26,
            borderTopLeftRadius: winW * 0.9,
            borderTopRightRadius: winW * 0.9,
          },
        ]}
      />
      <SafeAreaView style={{ flex: 1 }}>
        {/* Top bar: brand logo centered, Skip on the right */}
        <View style={styles.topBar}>
          <View style={styles.side} />
          <View style={dark ? styles.logoChipDark : undefined}>
            <Image
              source={require('../assets/images/nexgenn-pos.png')}
              resizeMode="contain"
              style={{ width: logoW, height: Math.round(logoW / LOGO_RATIO) }}
            />
          </View>
          <Pressable style={[styles.side, styles.skip]} onPress={finish} hitSlop={10}>
            <Text style={[styles.skipText, { color: c.textMuted }]}>Skip</Text>
          </Pressable>
        </View>

        <FlatList
          ref={ref}
          data={SLIDES}
          keyExtractor={(s) => s.title}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          renderItem={({ item }) => (
            <View style={[styles.slide, { width: winW }]}>
              <View style={[styles.iconWrap, { backgroundColor: item.accent + '1a', borderColor: item.accent + '33' }]}>
                <Ionicons name={item.icon} size={64} color={item.accent} />
              </View>
              <Text style={[styles.title, { color: c.text }]}>{item.title}</Text>
              <Text style={[styles.text, { color: c.textMuted }]}>{item.text}</Text>
            </View>
          )}
        />

        <View style={styles.footer}>
          <View style={styles.dots}>
            {SLIDES.map((s, i) => (
              <View
                key={s.title}
                style={[
                  styles.dot,
                  { backgroundColor: dotIdle },
                  i === index && [styles.dotActive, { backgroundColor: c.tint }],
                ]}
              />
            ))}
          </View>
          <Pressable onPress={next} style={styles.btnWrap}>
            <LinearGradient
              colors={Brand.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.btn}>
              <Text style={styles.btnText}>{last ? 'Get Started' : 'Next'}</Text>
              <Ionicons name={last ? 'checkmark' : 'arrow-forward'} size={20} color="#fff" />
            </LinearGradient>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Geometry comes from the live window size at render time — see the JSX.
  wave: {
    position: 'absolute',
    bottom: 0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 56,
  },
  side: { width: 56 },
  // The wordmark is black on transparent — back it with white on dark.
  logoChipDark: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  skip: { alignItems: 'flex-end' },
  skipText: { fontSize: 15, fontWeight: '700' },
  slide: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 8 },
  iconWrap: {
    width: 150,
    height: 150,
    borderRadius: 44,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 34,
  },
  title: { fontSize: 27, fontWeight: '900', textAlign: 'center' },
  text: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },
  footer: { paddingHorizontal: 28, paddingBottom: 12, gap: 22 },
  dots: { flexDirection: 'row', gap: 7, justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotActive: { width: 22 },
  btnWrap: { borderRadius: 16, overflow: 'hidden' },
  btn: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
