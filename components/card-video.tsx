import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

// Videos downloaded through the authenticated session (multi-DB safe), cached
// on disk + in memory so a re-render / revisit doesn't refetch.
const cache = new Map<number, string>();

async function fetchLocalVideo(id: number, url: string): Promise<string> {
  const cached = cache.get(id);
  if (cached) return cached;
  const file = new File(Paths.cache, `signage-video-${id}.mp4`);
  if (file.exists) {
    cache.set(id, file.uri);
    return file.uri;
  }
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  file.write(bytes);
  cache.set(id, file.uri);
  return file.uri;
}

function Player({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
  });
  return (
    <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls />
  );
}

/** A tappable video that shows the first frame and plays with native controls
 *  (matches the module's inline card player). Downloads once, then caches. */
export function CardVideo({ id, uri }: { id: number; uri: string }) {
  const [local, setLocal] = useState<string | null>(() => cache.get(id) ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (local) return;
    let alive = true;
    fetchLocalVideo(id, uri)
      .then((u) => alive && setLocal(u))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [id, uri, local]);

  if (failed) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Ionicons name="videocam-off-outline" size={30} color="#9aa0ac" />
      </View>
    );
  }
  if (!local) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }
  return <Player uri={local} />;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
