import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Card, EmptyState, Header, HeaderIcon, Screen, Skeleton, useC } from '@/components/ui';
import { Brand, Radius, Type } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { getScanProducts, ScanProduct } from '@/services/odoo';

export default function ProductsScreen() {
  const c = useC();
  const router = useRouter();
  const { user } = useAuth();
  const base = user?.base_url || '';

  const [products, setProducts] = useState<ScanProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(
    async (q: string) => {
      if (!base) {
        setLoading(false);
        return;
      }
      setError('');
      try {
        setProducts(await getScanProducts(base, q));
      } catch (e: any) {
        setError(e?.message || 'Could not load products.');
      } finally {
        setLoading(false);
      }
    },
    [base],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(query);
    setRefreshing(false);
  }, [load, query]);

  useFocusEffect(
    useCallback(() => {
      load(query);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => load(query), 350);
    return () => clearTimeout(t);
  }, [query, load]);

  const renderItem = ({ item }: { item: ScanProduct }) => (
    <Card
      onPress={() => router.push({ pathname: '/product-form', params: { id: String(item.id) } })}
      style={styles.row}>
      {item.thumb ? (
        <Image source={{ uri: item.thumb }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: c.background }]}>
          <Ionicons name="cube-outline" size={20} color={c.textMuted} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[Type.body, { color: c.text, fontWeight: '700' }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[Type.caption, { color: c.textMuted, marginTop: 2 }]} numberOfLines={1}>
          {item.barcode || 'No barcode'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
    </Card>
  );

  return (
    <Screen>
      <Header
        title="Products"
        onBack={() => router.back()}
        gradient={['#2563eb', '#22d3ee']}
        right={<HeaderIcon name="refresh" onPress={() => load(query)} color="#fff" />}
      />

      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <View style={[styles.search, { backgroundColor: c.card, borderColor: c.border }]}>
          <Ionicons name="search" size={18} color={c.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search products or barcode"
            placeholderTextColor={c.textMuted}
            style={[styles.searchInput, { color: c.text }]}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={c.textMuted} />
            </Pressable>
          ) : null}
        </View>
        <Text style={[Type.caption, { color: c.textMuted, marginTop: 8 }]}>
          Tap a product to edit, or ＋ to add a new one.
        </Text>
      </View>

      {loading ? (
        <View style={{ padding: 16, gap: 10 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <View key={i} style={[styles.skelRow, { backgroundColor: c.card, borderColor: c.border }]}>
              <Skeleton style={{ width: 46, height: 46, borderRadius: 10 }} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton style={{ width: '60%', height: 12, borderRadius: 6 }} />
                <Skeleton style={{ width: '35%', height: 10, borderRadius: 6 }} />
              </View>
            </View>
          ))}
        </View>
      ) : error ? (
        <EmptyState icon="cloud-offline-outline" title="Couldn’t load" text={error} actionLabel="Retry" onAction={() => load(query)} />
      ) : products.length === 0 ? (
        <EmptyState icon="cube-outline" title="No products" text="Tap the ＋ button to add your first product." />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => String(p.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 96, gap: 10 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.tint} colors={[c.tint]} />}
        />
      )}

      <Pressable onPress={() => router.push('/product-form')} style={styles.fab}>
        <LinearGradient colors={Brand.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabInner}>
          <Ionicons name="add" size={30} color="#fff" />
        </LinearGradient>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 15 },
  skelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  thumb: { width: 46, height: 46, borderRadius: 10 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 26,
    width: 60,
    height: 60,
    borderRadius: 30,
    shadowColor: '#4f46e5',
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  fabInner: { flex: 1, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
});
