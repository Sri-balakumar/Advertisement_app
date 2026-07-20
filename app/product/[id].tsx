import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientButton } from '@/components/gradient-button';
import { Brand, Colors, Radius, Shadow } from '@/constants/theme';
import { discountPct, getProduct } from '@/data/mock';

function RoundBtn({
  icon,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.round}>
      <Ionicons name={icon} size={22} color="#fff" />
    </Pressable>
  );
}

export default function ProductDetail() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = getProduct(id);
  const off = discountPct(p);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero */}
        <LinearGradient colors={p.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <SafeAreaView edges={['top']}>
            <View style={styles.heroBar}>
              <RoundBtn icon="chevron-back" onPress={() => router.back()} />
              <RoundBtn icon="heart-outline" />
            </View>
          </SafeAreaView>
          <View style={styles.heroCenter}>
            <Text style={styles.heroInitial}>{p.name.charAt(0)}</Text>
          </View>
          {off > 0 ? (
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>{off}% OFF</Text>
            </View>
          ) : null}
        </LinearGradient>

        {/* Body */}
        <View style={styles.body}>
          <Text style={[styles.brand, { color: c.tint }]}>{p.brand.toUpperCase()}</Text>
          <Text style={[styles.name, { color: c.text }]}>{p.name}</Text>
          <Text style={[styles.tagline, { color: c.textMuted }]}>{p.tagline}</Text>

          <View style={styles.ratingRow}>
            <View style={styles.ratingPill}>
              <Ionicons name="star" size={13} color="#fff" />
              <Text style={styles.ratingText}>{p.rating.toFixed(1)}</Text>
            </View>
            <Text style={[styles.ratingCount, { color: c.textMuted }]}>
              {p.ratingCount.toLocaleString()} ratings
            </Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: c.text }]}>₹{p.price.toLocaleString()}</Text>
            {off > 0 ? (
              <>
                <Text style={[styles.mrp, { color: c.textMuted }]}>₹{p.mrp.toLocaleString()}</Text>
                <View style={styles.savePill}>
                  <Text style={styles.saveText}>Save ₹{(p.mrp - p.price).toLocaleString()}</Text>
                </View>
              </>
            ) : null}
          </View>

          {/* Highlights */}
          <View style={styles.chips}>
            {p.highlights.map((h) => (
              <View key={h} style={[styles.chip, { backgroundColor: c.card, borderColor: c.border }]}>
                <Ionicons name="checkmark-circle" size={14} color={Brand.emerald} />
                <Text style={[styles.chipText, { color: c.text }]}>{h}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.section, { color: c.text }]}>About this product</Text>
          <Text style={[styles.desc, { color: c.textMuted }]}>{p.description}</Text>

          {/* Delivery card */}
          <View style={[styles.info, Shadow.soft, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.infoRow}>
              <Ionicons name="rocket-outline" size={18} color={c.tint} />
              <Text style={[styles.infoText, { color: c.text }]}>Free delivery by tomorrow</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="shield-checkmark-outline" size={18} color={c.tint} />
              <Text style={[styles.infoText, { color: c.text }]}>7-day easy returns</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Sticky bottom bar */}
      <View style={[styles.bar, { backgroundColor: c.card, borderTopColor: c.border }]}>
        <Pressable style={[styles.cart, { borderColor: c.border }]}>
          <Ionicons name="cart-outline" size={22} color={c.text} />
        </Pressable>
        <GradientButton label="Buy now" icon="flash" onPress={() => {}} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 320, paddingHorizontal: 20 },
  heroBar: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6 },
  round: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroInitial: { color: 'rgba(255,255,255,0.9)', fontSize: 120, fontWeight: '900' },
  heroBadge: {
    position: 'absolute',
    bottom: 26,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  heroBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  body: {
    backgroundColor: 'transparent',
    marginTop: -22,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  brand: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  name: { fontSize: 24, fontWeight: '900', marginTop: 4 },
  tagline: { fontSize: 14, marginTop: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  ratingText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  ratingCount: { fontSize: 13 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  price: { fontSize: 28, fontWeight: '900' },
  mrp: { fontSize: 16, textDecorationLine: 'line-through' },
  savePill: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  saveText: { color: '#166534', fontSize: 12, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: '600' },
  section: { fontSize: 17, fontWeight: '800', marginTop: 24 },
  desc: { fontSize: 14, lineHeight: 22, marginTop: 8 },
  info: { marginTop: 20, borderRadius: Radius.lg, borderWidth: 1, padding: 16, gap: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { fontSize: 14, fontWeight: '600' },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
  },
  cart: {
    width: 54,
    height: 54,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
