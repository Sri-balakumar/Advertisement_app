import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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

import { BannerCarousel } from '@/components/banner-carousel';
import { CategoryPill } from '@/components/category-pill';
import { OfferCard } from '@/components/offer-card';
import { SectionHeader } from '@/components/section-header';
import { Colors, Radius } from '@/constants/theme';
import { BANNERS, CATEGORIES, PRODUCTS, TRENDING } from '@/data/mock';

const SCREEN = Dimensions.get('window').width;
const GRID_W = (SCREEN - 40 - 14) / 2;

export default function HomeScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();

  const openProduct = (id: string) =>
    router.push({ pathname: '/product/[id]', params: { id } });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.hello, { color: c.textMuted }]}>Hello 👋</Text>
            <View style={styles.locRow}>
              <Ionicons name="location" size={15} color={c.tint} />
              <Text style={[styles.loc, { color: c.text }]}>Bengaluru, IN</Text>
              <Ionicons name="chevron-down" size={14} color={c.textMuted} />
            </View>
          </View>
          <Pressable style={[styles.bell, { backgroundColor: c.card, borderColor: c.border }]}>
            <Ionicons name="notifications-outline" size={20} color={c.text} />
            <View style={styles.dot} />
          </Pressable>
        </View>

        {/* Search */}
        <Pressable
          onPress={() => router.push('/offers')}
          style={[styles.search, { backgroundColor: c.card, borderColor: c.border }]}>
          <Ionicons name="search" size={18} color={c.textMuted} />
          <Text style={[styles.searchText, { color: c.textMuted }]}>
            Search deals, brands, products…
          </Text>
        </Pressable>

        {/* Banner carousel */}
        <View style={{ marginTop: 18 }}>
          <BannerCarousel banners={BANNERS} onPressBanner={(b) => openProduct(b.productId)} />
        </View>

        {/* Categories */}
        <View style={styles.block}>
          <SectionHeader title="Categories" onAction={() => router.push('/offers')} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6 }}>
            {CATEGORIES.map((cat) => (
              <CategoryPill key={cat.id} category={cat} onPress={() => router.push('/offers')} />
            ))}
          </ScrollView>
        </View>

        {/* Trending */}
        <View style={styles.block}>
          <SectionHeader title="Trending now 🔥" onAction={() => router.push('/offers')} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 14, paddingRight: 4 }}>
            {TRENDING.map((p) => (
              <OfferCard key={p.id} product={p} onPress={() => openProduct(p.id)} />
            ))}
          </ScrollView>
        </View>

        {/* Top picks grid */}
        <View style={styles.block}>
          <SectionHeader title="Top picks for you" />
          <View style={styles.grid}>
            {PRODUCTS.map((p) => (
              <OfferCard
                key={p.id}
                product={p}
                width={GRID_W}
                onPress={() => openProduct(p.id)}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  hello: { fontSize: 13, fontWeight: '600' },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  loc: { fontSize: 16, fontWeight: '800' },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 11,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f43f5e',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 16,
    height: 50,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  searchText: { fontSize: 14 },
  block: { paddingHorizontal: 20, marginTop: 26 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
});
