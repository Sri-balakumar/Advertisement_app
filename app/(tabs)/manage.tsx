import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Colors, Radius, Shadow } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AdListItem, listAds } from '@/services/odoo';

function Badge({ text, bg }: { text: string; bg: string }) {
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{text}</Text>
    </View>
  );
}

export default function ManageScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const { user } = useAuth();
  const [ads, setAds] = useState<AdListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user?.base_url) {
      setLoading(false);
      return;
    }
    setError('');
    try {
      setAds(await listAds(user.base_url));
    } catch (e: any) {
      setError(e?.message || 'Could not load ads.');
    } finally {
      setLoading(false);
    }
  }, [user?.base_url]);

  // Reload whenever the tab regains focus (so edits/adds show up).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const renderItem = ({ item }: { item: AdListItem }) => (
    <Pressable
      onPress={() => router.push({ pathname: '/ad-form', params: { id: String(item.id) } })}
      style={[styles.card, Shadow.soft, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.thumbWrap}>
        {item.thumb ? (
          <Image source={{ uri: item.thumb }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]}>
            <Ionicons name={item.media_type === 'video' ? 'videocam' : 'image'} size={22} color="#9aa0ac" />
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.cardName, { color: c.text }]} numberOfLines={1}>
          {item.name || `Ad #${item.id}`}
        </Text>
        <View style={styles.badges}>
          {item.media_type === 'video' ? (
            <Badge text="Video" bg="#1f2937" />
          ) : (
            <Badge text="Image" bg="#4f46e5" />
          )}
          <Badge text={item.has_qr ? 'Full-screen' : `QR: ${item.qr_source}`} bg="#7c3aed" />
          {item.is_live ? (
            <Badge text="Live" bg="#10b981" />
          ) : item.active ? (
            <Badge text="Scheduled" bg="#6b7280" />
          ) : (
            <Badge text="Archived" bg="#9ca3af" />
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
    </Pressable>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.background }}>
      <View style={styles.head}>
        <Text style={[styles.h1, { color: c.text }]}>Manage Ads</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <Pressable onPress={() => router.push('/enquiries')} hitSlop={8}>
            <Ionicons name="chatbubbles-outline" size={20} color={c.tint} />
          </Pressable>
          <Pressable onPress={() => router.push('/insights')} hitSlop={8}>
            <Ionicons name="stats-chart-outline" size={20} color={c.tint} />
          </Pressable>
          <Pressable onPress={load} hitSlop={8}>
            <Ionicons name="refresh" size={20} color={c.textMuted} />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.tint} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={c.textMuted} />
          <Text style={{ color: c.textMuted, marginTop: 8, textAlign: 'center' }}>{error}</Text>
          <Pressable onPress={load} style={[styles.retry, { backgroundColor: c.tint }]}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
          </Pressable>
        </View>
      ) : ads.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="albums-outline" size={48} color={c.textMuted} />
          <Text style={{ color: c.text, fontWeight: '800', fontSize: 16, marginTop: 8 }}>No ads yet</Text>
          <Text style={{ color: c.textMuted, marginTop: 4 }}>Tap ＋ to create your first ad.</Text>
        </View>
      ) : (
        <FlatList
          data={ads}
          keyExtractor={(a) => String(a.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 110, gap: 12 }}
        />
      )}

      {/* Add-new FAB */}
      <Pressable onPress={() => router.push('/ad-form')} style={styles.fab}>
        <LinearGradient colors={Brand.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabInner}>
          <Ionicons name="add" size={30} color="#fff" />
        </LinearGradient>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 8,
  },
  h1: { fontSize: 26, fontWeight: '900' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  retry: { marginTop: 14, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  thumbWrap: { width: 68, height: 68, borderRadius: 12, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef0f3' },
  cardName: { fontSize: 15, fontWeight: '800' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
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
