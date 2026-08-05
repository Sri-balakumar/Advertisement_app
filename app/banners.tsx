import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Card, EmptyState, Header, HeaderIcon, Screen, Skeleton, useC } from '@/components/ui';
import { Brand, Radius, Type } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { CardVideo } from '@/components/card-video';
import { getManageBanners, ManageBanner } from '@/services/odoo';
import { LockGate } from '@/components/lock-gate';

function toReachable(url: string | false, base: string): string | false {
  if (!url || !base) return url;
  const path = url.replace(/^https?:\/\/[^/]+/i, '');
  return path.startsWith('/') ? base.replace(/\/+$/, '') + path : url;
}

function Badge({ text, bg }: { text: string; bg: string }) {
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{text}</Text>
    </View>
  );
}

function BannersList() {
  const c = useC();
  // Live width so the two-up grid stays correct on a rotated tablet or a wide
  // POS panel, instead of the size captured when the module first loaded.
  const { width: winW } = useWindowDimensions();
  const CARD_W = (winW - 44) / 2;
  const router = useRouter();
  const { user } = useAuth();

  const [banners, setBanners] = useState<ManageBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user?.base_url) {
      setLoading(false);
      return;
    }
    setError('');
    try {
      setBanners(await getManageBanners(user.base_url));
    } catch (e: any) {
      setError(e?.message || 'Could not load banners.');
    } finally {
      setLoading(false);
    }
  }, [user?.base_url]);

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

  const renderItem = ({ item }: { item: ManageBanner }) => (
    <Card
      onPress={() => router.push({ pathname: '/banner-form', params: { id: String(item.id) } })}
      style={{ width: CARD_W, padding: 10 }}>
      <View style={styles.thumbWrap}>
        {item.media_type === 'video' && item.video ? (
          <CardVideo id={item.id} uri={toReachable(item.video, user?.base_url || '') as string} />
        ) : item.thumb ? (
          <Image source={{ uri: item.thumb }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: c.background }]}>
            <Ionicons name={item.media_type === 'video' ? 'videocam' : 'image'} size={26} color={c.textMuted} />
          </View>
        )}
      </View>
      <Text style={[Type.label, { color: c.text, marginTop: 8 }]} numberOfLines={1}>
        {item.name || `Banner #${item.id}`}
      </Text>
      <View style={styles.badges}>
        <Badge text={item.media_type === 'video' ? 'Video' : 'Image'} bg={item.media_type === 'video' ? '#1f2937' : '#4f46e5'} />
        {!item.active ? (
          <Badge text="Off" bg="#ef4444" />
        ) : item.is_live ? (
          <Badge text="Live" bg="#10b981" />
        ) : (
          <Badge text="Scheduled" bg="#6b7280" />
        )}
      </View>
    </Card>
  );

  return (
    <Screen>
      <Header
        title="Banners"
        onBack={() => router.back()}
        gradient={['#2563eb', '#22d3ee']}
        right={<HeaderIcon name="refresh" onPress={load} color="#fff" />}
      />

      {loading ? (
        <View style={styles.skelWrap}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={{ width: CARD_W }}>
              <Skeleton style={{ width: '100%', aspectRatio: 16 / 10, borderRadius: Radius.md }} />
              <Skeleton style={{ width: '72%', height: 12, marginTop: 10, borderRadius: 6 }} />
              <Skeleton style={{ width: '46%', height: 10, marginTop: 8, borderRadius: 6 }} />
            </View>
          ))}
        </View>
      ) : error ? (
        <EmptyState icon="cloud-offline-outline" title="Couldn’t load" text={error} actionLabel="Retry" onAction={load} />
      ) : banners.length === 0 ? (
        <EmptyState icon="images-outline" title="No banners yet" text="Tap the ＋ button to add your first banner." />
      ) : (
        <FlatList
          data={banners}
          keyExtractor={(b) => String(b.id)}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 96, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.tint} colors={[c.tint]} />}
        />
      )}

      <Pressable onPress={() => router.push('/banner-form')} style={styles.fab}>
        <LinearGradient colors={Brand.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabInner}>
          <Ionicons name="add" size={30} color="#fff" />
        </LinearGradient>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  skelWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 16 },
  thumbWrap: { width: '100%', aspectRatio: 16 / 10, borderRadius: Radius.md, overflow: 'hidden', backgroundColor: '#0b0b12' },
  thumb: { width: '100%', height: '100%' },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
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

// Locked when the matching option is ticked in Odoo -> Signage Scan -> App Lock.
// Wrapping rather than checking inside means the screen's data isn't fetched
// until the PIN is accepted.
export default function BannersScreen() {
  return (
    <LockGate section="banners" title="Banners">
      <BannersList />
    </LockGate>
  );
}
