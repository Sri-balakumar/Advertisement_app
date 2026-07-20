import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { Colors, Radius, Shadow } from '@/constants/theme';
import { Product, discountPct } from '@/data/mock';

export function OfferCard({
  product,
  onPress,
  width = 168,
}: {
  product: Product;
  onPress?: () => void;
  width?: number;
}) {
  const c = Colors[useColorScheme() ?? 'light'];
  const off = discountPct(product);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
      <View
        style={[
          styles.card,
          Shadow.soft,
          { width, backgroundColor: c.card, borderColor: c.border },
        ]}>
        <LinearGradient
          colors={product.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.thumb}>
          {off > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{off}% OFF</Text>
            </View>
          ) : null}
          <Text style={styles.thumbInitial}>{product.name.charAt(0)}</Text>
        </LinearGradient>
        <View style={styles.body}>
          <Text style={[styles.brand, { color: c.textMuted }]} numberOfLines={1}>
            {product.brand}
          </Text>
          <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
            {product.name}
          </Text>
          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: c.text }]}>₹{product.price}</Text>
            {off > 0 ? (
              <Text style={[styles.mrp, { color: c.textMuted }]}>₹{product.mrp}</Text>
            ) : null}
          </View>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={12} color="#f59e0b" />
            <Text style={[styles.rating, { color: c.textMuted }]}>
              {product.rating.toFixed(1)}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  thumb: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  thumbInitial: { color: 'rgba(255,255,255,0.85)', fontSize: 48, fontWeight: '900' },
  badge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  body: { padding: 12 },
  brand: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  name: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 8 },
  price: { fontSize: 16, fontWeight: '800' },
  mrp: { fontSize: 12, textDecorationLine: 'line-through', marginBottom: 1 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6 },
  rating: { fontSize: 12, fontWeight: '600' },
});
