import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Card, EmptyState, Header, HeaderIcon, Screen, Skeleton, useC } from '@/components/ui';
import { Radius, Type } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { clearScanLog, getScanLog, ScanLogItem } from '@/services/odoo';

const STATE_META: Record<string, { label: string; tint: string; bg: string }> = {
  found: { label: 'Found', tint: '#059669', bg: 'rgba(16,185,129,0.14)' },
  not_found: { label: 'Not found', tint: '#e11d48', bg: 'rgba(244,63,94,0.14)' },
  disabled: { label: 'Off for scan', tint: '#d97706', bg: 'rgba(245,158,11,0.16)' },
};

function relTime(iso: string): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(t).toLocaleDateString();
}

export default function ScanHistoryScreen() {
  const c = useC();
  const router = useRouter();
  const { user } = useAuth();
  const base = user?.base_url || '';

  const [items, setItems] = useState<ScanLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notFoundOnly, setNotFoundOnly] = useState(false);

  const load = useCallback(async () => {
    if (!base) {
      setLoading(false);
      return;
    }
    setError('');
    try {
      setItems(await getScanLog(base));
    } catch (e: any) {
      setError(e?.message || 'Could not load scan history.');
    } finally {
      setLoading(false);
    }
  }, [base]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const shown = useMemo(
    () => (notFoundOnly ? items.filter((i) => i.state === 'not_found') : items),
    [items, notFoundOnly],
  );
  const missingCount = useMemo(() => items.filter((i) => i.state === 'not_found').length, [items]);

  const confirmClear = () => {
    Alert.alert('Clear scan history', 'Remove all recorded scans? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            await clearScanLog(base);
            setItems([]);
          } catch (e: any) {
            Alert.alert('Could not clear', e?.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: ScanLogItem }) => {
    const meta = STATE_META[item.state] || STATE_META.not_found;
    const title = item.product_name || item.barcode || '—';
    return (
      <Card haptic={false} style={styles.row}>
        <View style={[styles.chip, { backgroundColor: meta.bg }]}>
          <Text style={[styles.chipText, { color: meta.tint }]}>{meta.label}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[Type.body, { color: c.text, fontWeight: '700' }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[Type.caption, { color: c.textMuted, marginTop: 2 }]} numberOfLines={1}>
            {item.barcode || 'No barcode'}
            {item.user_name ? ` · ${item.user_name}` : ''}
          </Text>
        </View>
        <Text style={[Type.caption, { color: c.textMuted }]}>{relTime(item.scan_date)}</Text>
      </Card>
    );
  };

  return (
    <Screen>
      <Header
        title="Scan History"
        onBack={() => router.back()}
        gradient={['#2563eb', '#22d3ee']}
        right={<HeaderIcon name="trash-outline" onPress={confirmClear} color="#fff" />}
      />

      <View style={{ paddingHorizontal: 16, paddingTop: 12, flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={() => setNotFoundOnly(false)}
          style={[
            styles.filter,
            { borderColor: c.border, backgroundColor: !notFoundOnly ? c.tint : c.card },
          ]}>
          <Text style={[styles.filterText, { color: !notFoundOnly ? '#fff' : c.text }]}>All scans</Text>
        </Pressable>
        <Pressable
          onPress={() => setNotFoundOnly(true)}
          style={[
            styles.filter,
            { borderColor: c.border, backgroundColor: notFoundOnly ? '#e11d48' : c.card },
          ]}>
          <Text style={[styles.filterText, { color: notFoundOnly ? '#fff' : c.text }]}>
            Missing barcodes{missingCount ? ` (${missingCount})` : ''}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={{ padding: 16, gap: 10 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <View key={i} style={[styles.skelRow, { backgroundColor: c.card, borderColor: c.border }]}>
              <Skeleton style={{ width: 68, height: 22, borderRadius: 11 }} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton style={{ width: '55%', height: 12, borderRadius: 6 }} />
                <Skeleton style={{ width: '30%', height: 10, borderRadius: 6 }} />
              </View>
            </View>
          ))}
        </View>
      ) : error ? (
        <EmptyState icon="cloud-offline-outline" title="Couldn’t load" text={error} actionLabel="Retry" onAction={load} />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={notFoundOnly ? 'checkmark-circle-outline' : 'time-outline'}
          title={notFoundOnly ? 'No missing barcodes' : 'No scans yet'}
          text={
            notFoundOnly
              ? 'Every scanned barcode matched a product.'
              : 'Scanned products will appear here.'
          }
        />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(x) => String(x.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 96, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.tint} colors={[c.tint]} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filter: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterText: { fontSize: 13, fontWeight: '700' },
  skelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  chip: { paddingHorizontal: 10, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 11, fontWeight: '800' },
});
