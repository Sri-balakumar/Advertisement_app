import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth';

const W = Dimensions.get('window').width;

type Slide = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
  colors: [string, string];
};

const SLIDES: Slide[] = [
  {
    icon: 'megaphone',
    title: 'Hot deals, every day',
    text: 'Discover the best offers from your favourite brands — all in one place.',
    colors: ['#4f46e5', '#7c3aed'],
  },
  {
    icon: 'qr-code',
    title: 'Scan & unlock',
    text: 'Scan any 369 banner QR to jump straight to the product and its offer.',
    colors: ['#06b6d4', '#3b82f6'],
  },
  {
    icon: 'pricetags',
    title: 'Save more, instantly',
    text: 'Grab exclusive discounts and never miss a limited-time deal again.',
    colors: ['#f43f5e', '#f59e0b'],
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
    <LinearGradient colors={SLIDES[index].colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <Pressable style={styles.skip} onPress={finish} hitSlop={10}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>

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
              <View style={styles.iconWrap}>
                <Ionicons name={item.icon} size={68} color="#fff" />
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
          <Pressable style={styles.btn} onPress={next}>
            <Text style={styles.btnText}>{last ? 'Get Started' : 'Next'}</Text>
            <Ionicons name={last ? 'checkmark' : 'arrow-forward'} size={20} color="#4f46e5" />
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  skip: { alignSelf: 'flex-end', padding: 20 },
  skipText: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '600' },
  slide: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 8 },
  iconWrap: {
    width: 150,
    height: 150,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 34,
  },
  title: { color: '#fff', fontSize: 27, fontWeight: '900', textAlign: 'center' },
  text: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 8,
  },
  footer: { paddingHorizontal: 28, paddingBottom: 12, gap: 22 },
  dots: { flexDirection: 'row', gap: 7, justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.45)' },
  dotActive: { width: 22, backgroundColor: '#fff' },
  btn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnText: { color: '#4f46e5', fontSize: 16, fontWeight: '800' },
});
