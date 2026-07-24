import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, Header, Screen, SectionLabel, useC } from '@/components/ui';
import { Radius, Type } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { getSignageStats, SignageStats } from '@/services/odoo';

type Entry = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: '/products' | '/banners' | '/scan-fields' | '/scan-settings' | '/scan-history';
  tint: string;
};

const ENTRIES: Entry[] = [
  { title: 'Products', subtitle: 'Add & edit products (name, barcode, price, image)', icon: 'cube-outline', route: '/products', tint: '#f59e0b' },
  { title: 'Banners', subtitle: 'Image & video banners shown full-screen', icon: 'images-outline', route: '/banners', tint: '#4f46e5' },
  { title: 'Scan Fields', subtitle: 'Per-product: show on scan + which fields appear', icon: 'pricetags-outline', route: '/scan-fields', tint: '#0ea5e9' },
  { title: 'Scanner & Display', subtitle: 'Scan method (Auto / USB / camera) + detail time', icon: 'options-outline', route: '/scan-settings', tint: '#10b981' },
  { title: 'Scan History', subtitle: 'Recent scans & missing barcodes', icon: 'time-outline', route: '/scan-history', tint: '#8b5cf6' },
];

export default function ManageScreen() {
  const c = useC();
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<SignageStats | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      if (user?.base_url) {
        getSignageStats(user.base_url)
          .then((s) => alive && setStats(s))
          .catch(() => {});
      }
      return () => {
        alive = false;
      };
    }, [user?.base_url]),
  );

  const tiles = [
    { label: 'Banners', value: stats?.banners_total ?? 0, icon: 'images' as const, tint: '#4f46e5' },
    { label: 'Live now', value: stats?.banners_live ?? 0, icon: 'radio' as const, tint: '#10b981' },
    { label: 'On scan', value: stats?.products_on_scan ?? 0, icon: 'pricetag' as const, tint: '#0ea5e9' },
  ];

  return (
    <Screen>
      <Header title="Manage" subtitle="Signage banners & scan settings" gradient={['#2563eb', '#22d3ee']} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>
        <SectionLabel>OVERVIEW</SectionLabel>
        <View style={styles.tiles}>
          {tiles.map((t) => (
            <Card key={t.label} style={styles.tile}>
              <View style={[styles.tileIcon, { backgroundColor: t.tint + '15' }]}>
                <Ionicons name={t.icon} size={16} color={t.tint} />
              </View>
              <Text style={[Type.h2, { color: c.text }]}>{t.value}</Text>
              <Text style={[Type.caption, { color: c.textMuted }]}>{t.label}</Text>
            </Card>
          ))}
        </View>

        <Card style={styles.breakdown}>
          <View style={styles.bkItem}>
            <Ionicons name="image-outline" size={18} color={c.textMuted} />
            <Text style={[Type.body, { color: c.text }]}>
              <Text style={{ fontWeight: '800' }}>{stats?.banners_image ?? 0}</Text> Images
            </Text>
          </View>
          <View style={[styles.bkDivider, { backgroundColor: c.border }]} />
          <View style={styles.bkItem}>
            <Ionicons name="videocam-outline" size={18} color={c.textMuted} />
            <Text style={[Type.body, { color: c.text }]}>
              <Text style={{ fontWeight: '800' }}>{stats?.banners_video ?? 0}</Text> Videos
            </Text>
          </View>
        </Card>

        <SectionLabel>MANAGE</SectionLabel>
        <View style={{ gap: 12 }}>
          {ENTRIES.map((e) => (
            <Card key={e.route} onPress={() => router.push(e.route)} style={styles.row}>
              <View style={[styles.icon, { backgroundColor: e.tint + '15' }]}>
                <Ionicons name={e.icon} size={22} color={e.tint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[Type.title, { color: c.text }]}>{e.title}</Text>
                <Text style={[Type.caption, { color: c.textMuted, marginTop: 3 }]}>{e.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
            </Card>
          ))}
        </View>

        <Card style={styles.tip}>
          <Ionicons name="information-circle-outline" size={18} color={c.textMuted} />
          <Text style={[Type.caption, { color: c.textMuted, flex: 1, lineHeight: 17 }]}>
            Changes here apply to what the app shows on the Home screen and on barcode scan.
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, alignItems: 'flex-start', padding: 12, gap: 4 },
  tileIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  breakdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', padding: 14, marginTop: 12 },
  bkItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bkDivider: { width: StyleSheet.hairlineWidth, height: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  icon: { width: 46, height: 46, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, marginTop: 20 },
});
