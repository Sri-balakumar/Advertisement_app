import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/auth';

const { width: W, height: H } = Dimensions.get('window');
const BG = '#EBF1FC';
const WAVE = '#DCE6FA';
const NAVY = '#1e2a5a';
const MUTED = '#5b6472';

type Slide = {
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  title: string;
  text: string;
};

const SLIDES: Slide[] = [
  {
    icon: 'albums',
    accent: '#4f46e5',
    title: 'Ads that sell for you',
    text: 'Images and videos scroll across your screens all day — your storefront, always on.',
  },
  {
    icon: 'qr-code',
    accent: '#7c3aed',
    title: 'Scan to discover',
    text: 'Every ad carries a QR. One scan opens the product, its live price and today’s offer.',
  },
  {
    icon: 'options',
    accent: '#f43f5e',
    title: 'All from one app',
    text: 'Add ads, set what plays and where each QR leads — managed live. Built by Alphalize.',
  },
];

export default function Onboarding() {
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
      ref.current?.scrollToOffset({ offset: n * W, animated: true });
      setIndex(n);
    } else {
      finish();
    }
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setIndex(Math.round(e.nativeEvent.contentOffset.x / W));

  const last = index === SLIDES.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="dark" />
      <View style={styles.wave} />
      <SafeAreaView style={{ flex: 1 }}>
        {/* Top bar: 369 logo centered, Skip on the right */}
        <View style={styles.topBar}>
          <View style={styles.side} />
          <Image
            source={require('../assets/images/logo-369-ad.png')}
            resizeMode="contain"
            style={styles.logo}
          />
          <Pressable style={[styles.side, styles.skip]} onPress={finish} hitSlop={10}>
            <Text style={styles.skipText}>Skip</Text>
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
            <View style={[styles.slide, { width: W }]}>
              <View style={[styles.iconWrap, { backgroundColor: item.accent + '1a', borderColor: item.accent + '33' }]}>
                <Ionicons name={item.icon} size={64} color={item.accent} />
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.text}>{item.text}</Text>
            </View>
          )}
        />

        <View style={styles.footer}>
          <View style={styles.dots}>
            {SLIDES.map((s, i) => (
              <View key={s.title} style={[styles.dot, i === index && styles.dotActive]} />
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
  wave: {
    position: 'absolute',
    bottom: 0,
    left: -W * 0.3,
    right: -W * 0.3,
    height: H * 0.26,
    backgroundColor: WAVE,
    borderTopLeftRadius: W * 0.9,
    borderTopRightRadius: W * 0.9,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 56,
  },
  side: { width: 56 },
  logo: { width: 116, height: 54 },
  skip: { alignItems: 'flex-end' },
  skipText: { color: MUTED, fontSize: 15, fontWeight: '700' },
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
  title: { color: NAVY, fontSize: 27, fontWeight: '900', textAlign: 'center' },
  text: { color: MUTED, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },
  footer: { paddingHorizontal: 28, paddingBottom: 12, gap: 22 },
  dots: { flexDirection: 'row', gap: 7, justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(30,42,90,0.22)' },
  dotActive: { width: 22, backgroundColor: '#4f46e5' },
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
