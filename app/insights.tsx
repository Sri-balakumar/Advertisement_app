import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Brand, Colors, Radius, Shadow } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getScanAnalytics, ScanAnalytics } from '@/services/odoo';

function fmtShort(iso?: string) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export default function InsightsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const { user } = useAuth();

  const [data, setData] = useState<ScanAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    if (!user?.base_url) {
      setLoading(false);
      return;
    }
    setErr('');
    setLoading(true);
    try {
      setData(await getScanAnalytics(user.base_url));
    } catch (e: any) {
      setErr(e?.message || 'Could not load analytics.');
    } finally {
      setLoading(false);
    }
  }, [user?.base_url]);

  useEffect(() => {
    load();
  }, [load]);

  const trendPct = data
    ? data.prev7 > 0
      ? Math.round(((data.last7 - data.prev7) / data.prev7) * 100)
      : data.last7 > 0
        ? 100
        : 0
    : 0;
  const trendUp = data ? data.last7 >= data.prev7 : true;

  const dayMax = data ? Math.max(1, ...data.by_day.map((d) => d.count)) : 1;
  const adMax = data && data.per_ad.length ? data.per_ad[0].count : 1;
  const ctryMax = data && data.by_country.length ? data.by_country[0].count : 1;
  const dimBar = scheme === 'dark' ? '#3b3b57' : '#c7d2fe';

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader
        title="Insights"
        right={
          <Pressable onPress={load} hitSlop={8}>
            <Ionicons name="refresh" size={20} color={c.textMuted} />
          </Pressable>
        }
      />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.tint} size="large" />
        </View>
      ) : err ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={44} color={c.textMuted} />
          <Text style={{ color: c.textMuted, marginTop: 8, textAlign: 'center' }}>{err}</Text>
          <Pressable onPress={load} style={[styles.retry, { backgroundColor: c.tint }]}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
          </Pressable>
        </View>
      ) : !data || data.total === 0 ? (
        <View style={styles.center}>
          <Ionicons name="stats-chart-outline" size={48} color={c.textMuted} />
          <Text style={{ color: c.text, fontWeight: '800', fontSize: 16, marginTop: 10 }}>
            No scans yet
          </Text>
          <Text style={{ color: c.textMuted, marginTop: 4, textAlign: 'center' }}>
            When people scan your ad QR codes, the numbers show up here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {/* Summary cards */}
          <View style={styles.cards}>
            <View style={[styles.card, Shadow.soft, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.cardNum, { color: c.text }]}>{data.total}</Text>
              <Text style={[styles.cardLabel, { color: c.textMuted }]}>Total scans</Text>
            </View>
            <View style={[styles.card, Shadow.soft, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.cardNum, { color: c.text }]}>{data.last7}</Text>
              <Text style={[styles.cardLabel, { color: c.textMuted }]}>Last 7 days</Text>
              <View style={styles.trendRow}>
                <Ionicons
                  name={trendUp ? 'arrow-up' : 'arrow-down'}
                  size={12}
                  color={trendUp ? Brand.emerald : Brand.rose}
                />
                <Text style={{ color: trendUp ? Brand.emerald : Brand.rose, fontSize: 11, fontWeight: '800' }}>
                  {Math.abs(trendPct)}%
                </Text>
              </View>
            </View>
            <View style={[styles.card, Shadow.soft, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.cardNum, { color: c.text }]}>{data.last30}</Text>
              <Text style={[styles.cardLabel, { color: c.textMuted }]}>Last 30 days</Text>
            </View>
          </View>

          {/* 14-day sparkline */}
          <Text style={[styles.section, { color: c.textMuted }]}>SCANS · LAST 14 DAYS</Text>
          <View style={[styles.panel, Shadow.soft, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.spark}>
              {data.by_day.map((d, i) => (
                <View key={d.date} style={styles.sparkCol}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: 4 + (d.count / dayMax) * 92,
                        backgroundColor: i === data.by_day.length - 1 ? c.tint : dimBar,
                      },
                    ]}
                  />
                </View>
              ))}
            </View>
            <View style={styles.sparkAxis}>
              <Text style={[styles.axisLabel, { color: c.textMuted }]}>{fmtShort(data.by_day[0]?.date)}</Text>
              <Text style={[styles.axisLabel, { color: c.textMuted }]}>Today</Text>
            </View>
          </View>

          {/* Top ads */}
          <Text style={[styles.section, { color: c.textMuted }]}>TOP ADS</Text>
          <View style={[styles.panel, Shadow.soft, { backgroundColor: c.card, borderColor: c.border }]}>
            {data.per_ad.map((a, i) => (
              <Pressable
                key={a.id}
                onPress={() => router.push({ pathname: '/ad-form', params: { id: String(a.id) } })}
                style={[styles.row, i < data.per_ad.length - 1 && { borderBottomColor: c.border, borderBottomWidth: 1 }]}>
                <Text style={[styles.rowName, { color: c.text }]} numberOfLines={1}>
                  {a.name || `Ad #${a.id}`}
                </Text>
                <View style={styles.rowBarWrap}>
                  <View style={[styles.rowBar, { width: `${Math.max(6, (a.count / adMax) * 100)}%`, backgroundColor: c.tint }]} />
                </View>
                <Text style={[styles.rowCount, { color: c.text }]}>{a.count}</Text>
              </Pressable>
            ))}
          </View>

          {/* By country */}
          <Text style={[styles.section, { color: c.textMuted }]}>BY COUNTRY</Text>
          <View style={[styles.panel, Shadow.soft, { backgroundColor: c.card, borderColor: c.border }]}>
            {data.by_country.length === 0 ? (
              <Text style={{ color: c.textMuted, padding: 6 }}>No location data yet.</Text>
            ) : (
              data.by_country.map((ct, i) => (
                <View
                  key={ct.name}
                  style={[styles.row, i < data.by_country.length - 1 && { borderBottomColor: c.border, borderBottomWidth: 1 }]}>
                  <Text style={[styles.rowName, { color: c.text }]} numberOfLines={1}>
                    {ct.name}
                  </Text>
                  <View style={styles.rowBarWrap}>
                    <View style={[styles.rowBar, { width: `${Math.max(6, (ct.count / ctryMax) * 100)}%`, backgroundColor: Brand.violet }]} />
                  </View>
                  <Text style={[styles.rowCount, { color: c.text }]}>{ct.count}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  retry: { marginTop: 14, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  cards: { flexDirection: 'row', gap: 10 },
  card: {
    flex: 1,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  cardNum: { fontSize: 24, fontWeight: '900' },
  cardLabel: { fontSize: 11, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 5 },
  section: { fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: 22, marginBottom: 10, marginLeft: 4 },
  panel: { borderRadius: Radius.lg, borderWidth: 1, padding: 14 },
  spark: { flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 3 },
  sparkCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '68%', borderTopLeftRadius: 3, borderTopRightRadius: 3, minHeight: 4 },
  sparkAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  axisLabel: { fontSize: 11 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  rowName: { width: 96, fontSize: 13, fontWeight: '700' },
  rowBarWrap: { flex: 1, height: 10, borderRadius: 5, backgroundColor: 'rgba(127,127,127,0.12)', overflow: 'hidden' },
  rowBar: { height: '100%', borderRadius: 5 },
  rowCount: { width: 34, textAlign: 'right', fontSize: 13, fontWeight: '800' },
});
