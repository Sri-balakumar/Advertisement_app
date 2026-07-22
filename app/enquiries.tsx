import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { AppEnquiry, getEnquiries } from '@/services/odoo';
import { Brand, Colors, Radius, Shadow } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(s: string) {
  // '2026-07-22 14:47:59' → '22 Jul, 14:47'
  if (!s) return '';
  const [d, t] = s.split(' ');
  const [, mo, day] = d.split('-');
  return `${day} ${MONTHS[Number(mo) - 1] || ''}, ${(t || '').slice(0, 5)}`;
}

export default function EnquiriesScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const { user } = useAuth();
  const [items, setItems] = useState<AppEnquiry[]>([]);
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
      setItems(await getEnquiries(user.base_url));
    } catch (e: any) {
      setErr(e?.message || 'Could not load enquiries.');
    } finally {
      setLoading(false);
    }
  }, [user?.base_url]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader
        title="Enquiries"
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
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="chatbubbles-outline" size={48} color={c.textMuted} />
          <Text style={{ color: c.text, fontWeight: '800', fontSize: 16, marginTop: 10 }}>
            No enquiries yet
          </Text>
          <Text style={{ color: c.textMuted, marginTop: 4, textAlign: 'center' }}>
            Leads from your scanned product pages will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}>
          {items.map((e) => (
            <View key={e.id} style={[styles.card, Shadow.soft, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={styles.cardHead}>
                <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
                  {e.name || 'Someone'}
                </Text>
                <Text style={[styles.date, { color: c.textMuted }]}>{fmtDate(e.date)}</Text>
              </View>
              {e.product || e.ad ? (
                <Text style={[styles.about, { color: c.tint }]} numberOfLines={1}>
                  {e.product || e.ad}
                </Text>
              ) : null}
              {e.message ? <Text style={[styles.msg, { color: c.text }]}>{e.message}</Text> : null}
              <Pressable
                onPress={() => e.phone && Linking.openURL(`tel:${e.phone.replace(/\s+/g, '')}`)}
                style={styles.phoneRow}>
                <Ionicons name="call" size={15} color={Brand.emerald} />
                <Text style={[styles.phone, { color: Brand.emerald }]}>{e.phone || '—'}</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  retry: { marginTop: 14, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: 14 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '800', flex: 1 },
  date: { fontSize: 12, marginLeft: 8 },
  about: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  msg: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  phone: { fontSize: 14, fontWeight: '800' },
});
