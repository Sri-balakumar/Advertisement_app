import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Card, EmptyState, Header, HeaderIcon, Screen, Skeleton, useC } from '@/components/ui';
import { Brand, Radius, Type } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import {
  getGlobalScanFields,
  getScanProducts,
  ScanProduct,
  setGlobalScanFields,
  toggleScanProduct,
} from '@/services/odoo';

export default function ScanFieldsScreen() {
  const c = useC();
  const router = useRouter();
  const { user } = useAuth();
  const base = user?.base_url || '';

  const [products, setProducts] = useState<ScanProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [globalMode, setGlobalMode] = useState(false);

  const loadGlobal = useCallback(() => {
    if (!base) return;
    getGlobalScanFields(base)
      .then((g) => setGlobalMode(g.mode))
      .catch(() => {});
  }, [base]);

  const onToggleGlobal = async (v: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    setGlobalMode(v);
    try {
      await setGlobalScanFields(base, { mode: v });
    } catch {
      setGlobalMode(!v);
    }
  };

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
      loadGlobal();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, loadGlobal]),
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

  const onToggle = async (item: ScanProduct, value: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    setBusyId(item.id);
    setProducts((prev) => prev.map((p) => (p.id === item.id ? { ...p, signage_enabled: value } : p)));
    try {
      await toggleScanProduct(base, item.id, value);
    } catch {
      setProducts((prev) => prev.map((p) => (p.id === item.id ? { ...p, signage_enabled: !value } : p)));
    } finally {
      setBusyId(null);
    }
  };

  const renderItem = ({ item }: { item: ScanProduct }) => (
    <Card style={styles.row}>
      <Pressable
        style={styles.rowMain}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          router.push({
            pathname: '/scan-config',
            params: { id: String(item.id), name: item.name, globalActive: globalMode ? '1' : '0' },
          });
        }}>
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
      </Pressable>
      <View style={styles.switchWrap}>
        {busyId === item.id ? (
          <ActivityIndicator size="small" color={c.tint} />
        ) : (
          <Switch value={item.signage_enabled} onValueChange={(v) => onToggle(item, v)} trackColor={{ true: Brand.indigo }} />
        )}
      </View>
    </Card>
  );

  return (
    <Screen>
      <Header
        title="Scan Fields"
        onBack={() => router.back()}
        gradient={['#2563eb', '#22d3ee']}
        right={<HeaderIcon name="refresh" onPress={() => load(query)} color="#fff" />}
      />

      <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 12 }}>
        {/* Global fields — one field set for every product */}
        <Card haptic={false}>
          <View style={styles.globalRow}>
            <View style={[styles.globalIcon, { backgroundColor: Brand.indigo + '15' }]}>
              <Ionicons name="albums-outline" size={20} color={Brand.indigo} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[Type.title, { color: c.text }]}>Same fields for all</Text>
              <Text style={[Type.caption, { color: c.textMuted, marginTop: 2 }]}>
                One field set shown for every product
              </Text>
            </View>
            <Switch value={globalMode} onValueChange={onToggleGlobal} trackColor={{ true: Brand.indigo }} />
          </View>
          {globalMode ? (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                router.push({ pathname: '/scan-config', params: { global: '1' } });
              }}
              style={[styles.globalLink, { borderTopColor: c.border }]}>
              <Ionicons name="options-outline" size={18} color={c.tint} />
              <Text style={[Type.body, { color: c.tint, fontWeight: '700', flex: 1 }]}>
                Configure global fields
              </Text>
              <Ionicons name="chevron-forward" size={18} color={c.tint} />
            </Pressable>
          ) : null}
        </Card>

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
          {globalMode
            ? 'Global fields are on — every product shows the same fields. Per-product settings below are used only when Global is off.'
            : 'On = scanning shows the product. Tap a product to choose its fields.'}
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
              <Skeleton style={{ width: 40, height: 22, borderRadius: 11 }} />
            </View>
          ))}
        </View>
      ) : error ? (
        <EmptyState icon="cloud-offline-outline" title="Couldn’t load" text={error} actionLabel="Retry" onAction={() => load(query)} />
      ) : products.length === 0 ? (
        <EmptyState icon="cube-outline" title="No products found" />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => String(p.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 10 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.tint} colors={[c.tint]} />}
        />
      )}
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
  globalRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  globalIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  globalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  skelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingRight: 12 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  thumb: { width: 46, height: 46, borderRadius: 10 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  switchWrap: { width: 52, alignItems: 'center', justifyContent: 'center' },
});
