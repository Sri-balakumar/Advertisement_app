import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
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

import { Radius } from '@/constants/theme';
import { Banner } from '@/data/mock';

const SCREEN = Dimensions.get('window').width;
const PAD = 20;
const CARD_H = 172;

export function BannerCarousel({
  banners,
  onPressBanner,
}: {
  banners: Banner[];
  onPressBanner: (b: Banner) => void;
}) {
  const ref = useRef<FlatList<Banner>>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % banners.length;
        ref.current?.scrollToOffset({ offset: next * SCREEN, animated: true });
        return next;
      });
    }, 3800);
    return () => clearInterval(t);
  }, [banners.length]);

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN));
  };

  return (
    <View>
      <FlatList
        ref={ref}
        data={banners}
        keyExtractor={(b) => b.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onEnd}
        renderItem={({ item }) => (
          <View style={{ width: SCREEN, paddingHorizontal: PAD }}>
            <Pressable
              onPress={() => onPressBanner(item)}
              style={({ pressed }) => [{ opacity: pressed ? 0.95 : 1 }]}>
              <LinearGradient
                colors={item.colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.card}>
                <View style={styles.blob} />
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
                <View style={styles.content}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.subtitle}>{item.subtitle}</Text>
                  <View style={styles.cta}>
                    <Text style={styles.ctaText}>Shop now →</Text>
                  </View>
                </View>
              </LinearGradient>
            </Pressable>
          </View>
        )}
      />
      <View style={styles.dots}>
        {banners.map((b, i) => (
          <View key={b.id} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: CARD_H,
    borderRadius: Radius.xl,
    padding: 20,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  blob: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  badge: {
    position: 'absolute',
    top: 18,
    left: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  content: {},
  title: { color: '#fff', fontSize: 23, fontWeight: '900', letterSpacing: 0.2 },
  subtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginTop: 4 },
  cta: {
    alignSelf: 'flex-start',
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  ctaText: { color: '#111827', fontSize: 13, fontWeight: '800' },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 14 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#cbd0da' },
  dotActive: { width: 20, backgroundColor: '#4f46e5' },
});
