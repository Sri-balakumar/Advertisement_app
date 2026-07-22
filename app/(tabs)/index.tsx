import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { AdItem, fetchCarousel } from '@/services/odoo';

const W = Dimensions.get('window').width;
const DEFAULT_SECONDS = 4;

/**
 * Rewrite an Odoo URL (/ad/video, /ad/p …) to the host the app logged into,
 * so it stays reachable even if the server's base URL is localhost. External
 * links (a full different origin) are left untouched via the path check.
 */
function toReachable(url: string | false, base: string): string | false {
  if (!url || !base) return url;
  const path = url.replace(/^https?:\/\/[^/]+/i, '');
  return path.startsWith('/') ? base.replace(/\/+$/, '') + path : url;
}

/** One video slide (expo-video). Plays only while it is the active slide. */
function VideoSlide({ uri, active }: { uri: string; active: boolean }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });
  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);
  return (
    <VideoView
      player={player}
      style={styles.image}
      contentFit="contain"
      nativeControls={false}
      allowsFullscreen={false}
      allowsPictureInPicture={false}
    />
  );
}

export default function CarouselScreen() {
  const { user } = useAuth();
  const [ads, setAds] = useState<AdItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [slideH, setSlideH] = useState(0);
  const listRef = useRef<FlatList<AdItem>>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!user?.base_url) {
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      setError('');
      try {
        const list = await fetchCarousel(user.base_url);
        setAds(list);
        setIndex(0);
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
      } catch (e: any) {
        setError(e?.message || 'Could not load ads.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.base_url],
  );

  // Reload when the tab gains focus (so a just-added ad appears immediately).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Auto-advance using each ad's own duration (or the app default), looping.
  // Skipped while paused; any manual move resets the timer (index changes).
  useEffect(() => {
    if (paused || ads.length < 2 || slideH === 0) return;
    const secs = Number(ads[index]?.scroll_seconds) || DEFAULT_SECONDS;
    const t = setTimeout(() => {
      const next = (index + 1) % ads.length;
      listRef.current?.scrollToOffset({ offset: next * W, animated: true });
      setIndex(next);
    }, Math.max(2, secs) * 1000);
    return () => clearTimeout(t);
  }, [index, ads, slideH, paused]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setIndex(Math.round(e.nativeEvent.contentOffset.x / W));

  // Manual controls: wrap-around prev / next (scroll + sync index).
  const goTo = (next: number) => {
    listRef.current?.scrollToOffset({ offset: next * W, animated: true });
    setIndex(next);
  };
  const goNext = () => {
    if (ads.length) goTo((index + 1) % ads.length);
  };
  const goPrev = () => {
    if (ads.length) goTo((index - 1 + ads.length) % ads.length);
  };

  const renderItem = ({ item, index: i }: { item: AdItem; index: number }) => {
    const isVideo = item.media_type === 'video' && !!item.video;
    const showQr = !item.has_qr && !!item.qr;
    // Where a tap goes: link → its URL; product → the live-price page.
    const target =
      item.qr_source === 'link' && item.link_url
        ? item.link_url
        : item.qr_source === 'product' && item.landing_url
          ? toReachable(item.landing_url, user?.base_url || '')
          : false;
    const inner = (
      <View style={{ width: W, height: slideH, backgroundColor: '#0b0b12' }}>
        {isVideo ? (
          <VideoSlide
            uri={toReachable(item.video as string, user?.base_url || '') as string}
            active={i === index}
          />
        ) : item.image ? (
          <Image source={{ uri: item.image }} style={styles.image} resizeMode="contain" />
        ) : (
          <View style={[styles.image, styles.center]}>
            <Ionicons name="image-outline" size={64} color="#2a2a35" />
          </View>
        )}
        {showQr ? (
          <View style={styles.qrCard}>
            <Image source={{ uri: item.qr as string }} style={styles.qrImg} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={styles.qrTitle}>Scan to open</Text>
              <Text style={styles.qrName} numberOfLines={1}>
                {item.name}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    );
    return target ? (
      <Pressable onPress={() => Linking.openURL(target as string)}>{inner}</Pressable>
    ) : (
      inner
    );
  };

  return (
    <View style={styles.root} onLayout={(e) => setSlideH(e.nativeEvent.layout.height)}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.dim}>Loading ads…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={54} color="#4b4b57" />
          <Text style={styles.stateTitle}>Couldn’t load ads</Text>
          <Text style={styles.dim}>{error}</Text>
          <Pressable style={styles.retry} onPress={() => load()}>
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : ads.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="megaphone-outline" size={54} color="#4b4b57" />
          <Text style={styles.stateTitle}>No ads are live</Text>
          <Text style={styles.dim}>Add an ad in Odoo → Ad Carousel, then refresh.</Text>
          <Pressable style={styles.retry} onPress={() => load(true)}>
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={styles.retryText}>Refresh</Text>
          </Pressable>
        </View>
      ) : slideH > 0 ? (
        <FlatList
          ref={listRef}
          data={ads}
          keyExtractor={(a) => String(a.id)}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          getItemLayout={(_, i) => ({ length: W, offset: W * i, index: i })}
        />
      ) : null}

      {/* Top overlay: live count + refresh + page dots */}
      {!loading && !error && ads.length > 0 ? (
        <SafeAreaView edges={['top']} pointerEvents="box-none" style={styles.topBar}>
          <View style={styles.pill}>
            <View style={styles.liveDot} />
            <Text style={styles.pillText}>
              {ads.length} {ads.length === 1 ? 'ad' : 'ads'} live
            </Text>
          </View>
          <View style={styles.dots}>
            {ads.map((a, i) => (
              <View key={a.id} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
          <Pressable
            onPress={() => load(true)}
            style={styles.refresh}
            hitSlop={10}>
            <Ionicons
              name="refresh"
              size={18}
              color="#fff"
              style={refreshing ? { opacity: 0.5 } : undefined}
            />
          </Pressable>
        </SafeAreaView>
      ) : null}

      {/* Bottom overlay: manual  <   ⏸/▶   >  controls */}
      {!loading && !error && ads.length > 0 ? (
        <SafeAreaView edges={['bottom']} pointerEvents="box-none" style={styles.bottomBar}>
          <View style={styles.controls}>
            <Pressable onPress={goPrev} hitSlop={8} style={styles.ctrlBtn}>
              <Ionicons name="chevron-back" size={26} color="#fff" />
            </Pressable>
            <Pressable onPress={() => setPaused((p) => !p)} hitSlop={8} style={[styles.ctrlBtn, styles.ctrlMain]}>
              <Ionicons name={paused ? 'play' : 'pause'} size={24} color="#fff" />
            </Pressable>
            <Pressable onPress={goNext} hitSlop={8} style={styles.ctrlBtn}>
              <Ionicons name="chevron-forward" size={26} color="#fff" />
            </Pressable>
          </View>
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b12' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 30 },
  image: { width: '100%', height: '100%' },
  dim: { color: '#8a8a96', fontSize: 14, textAlign: 'center' },
  stateTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 6 },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: Brand.indigo,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
  },
  retryText: { color: '#fff', fontWeight: '700' },
  qrCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 104,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  qrImg: { width: 76, height: 76, borderRadius: 8, backgroundColor: '#fff' },
  qrTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  qrName: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  pillText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  dots: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { width: 18, backgroundColor: '#fff' },
  refresh: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingBottom: 14 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  ctrlBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  ctrlMain: { backgroundColor: 'rgba(255,255,255,0.18)' },
});
