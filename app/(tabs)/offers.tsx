import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OfferCard } from '@/components/offer-card';
import { Colors, Radius } from '@/constants/theme';
import { CATEGORIES, PRODUCTS } from '@/data/mock';

const SCREEN = Dimensions.get('window').width;
const GRID_W = (SCREEN - 40 - 14) / 2;
const FILTERS = ['All', ...CATEGORIES.map((c) => c.name)];

export default function OffersScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const [filter, setFilter] = useState('All');

  const list = filter === 'All' ? PRODUCTS : PRODUCTS.filter((p) => p.category === filter);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.background }}>
      <Text style={[styles.h1, { color: c.text }]}>Offers</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsRow}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        {FILTERS.map((f) => {
          const active = f === filter;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? c.tint : c.card,
                  borderColor: active ? c.tint : c.border,
                },
              ]}>
              <Text style={[styles.chipText, { color: active ? '#fff' : c.textMuted }]}>{f}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.grid}>
        {list.map((p) => (
          <OfferCard
            key={p.id}
            product={p}
            width={GRID_W}
            onPress={() => router.push({ pathname: '/product/[id]', params: { id: p.id } })}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '900', paddingHorizontal: 20, paddingTop: 6 },
  chipsRow: { flexGrow: 0, marginTop: 14, marginBottom: 4 },
  chip: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 13, fontWeight: '700' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
});
