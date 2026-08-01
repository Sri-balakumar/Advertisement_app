import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { File, Paths } from 'expo-file-system';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Easing,
  FlatList,
  Image,
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputSubmitEditingEventData,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTabBar } from '@/context/tabbar';
import { getSignageBanners, lookupProduct, ProductLookup, SignageBanner } from '@/services/odoo';
import { DEFAULT_SCAN_MODE, getScanMode, ScanMode } from '@/services/scanSettings';

const DEFAULT_SECONDS = 6;
const CONTROLS_HIDE_MS = 3500;

/** Rewrite an Odoo path (/signage/video …) onto the host the app logged into. */
function toReachable(url: string | false, base: string): string | false {
  if (!url || !base) return url;
  const path = url.replace(/^https?:\/\/[^/]+/i, '');
  return path.startsWith('/') ? base.replace(/\/+$/, '') + path : url;
}

// Banner videos downloaded once per session (multi-DB safe — see fetchLocalVideo).
const videoCache = new Map<number, string>();

async function fetchLocalVideo(id: number, url: string): Promise<string> {
  const cached = videoCache.get(id);
  if (cached) return cached;
  const file = new File(Paths.cache, `signage-video-${id}.mp4`);
  if (file.exists) file.delete();
  // Stream straight to disk. The previous version buffered the whole clip in
  // memory via arrayBuffer(), which a POS terminal sharing ~4 GB with the rest
  // of Android can fail to allocate — that made playback work only sometimes.
  await File.downloadFileAsync(url, file);
  videoCache.set(id, file.uri);
  return file.uri;
}

function LocalVideo({
  uri,
  active,
  loop = true,
  onEnded,
}: {
  uri: string;
  active: boolean;
  loop?: boolean;
  onEnded?: () => void;
}) {
  // Read inside the status listener without re-subscribing on every toggle.
  const activeRef = useRef(active);
  activeRef.current = active;

  const player = useVideoPlayer(uri, (p) => {
    p.loop = loop;
    p.muted = true;
  });
  useEffect(() => {
    player.loop = loop;
  }, [loop, player]);
  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);
  // A play() issued before the source finishes loading is dropped, which left
  // the banner frozen on a black frame. Re-issue it the moment the player
  // reports it is ready — on a slow POS that is often after `active` flipped.
  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay' && activeRef.current) player.play();
    });
    return () => sub.remove();
  }, [player]);
  // Advance the carousel when this video finishes (Auto timing).
  useEffect(() => {
    if (!onEnded) return;
    const sub = player.addListener('playToEnd', onEnded);
    return () => sub.remove();
  }, [player, onEnded]);
  return <VideoView player={player} style={styles.image} contentFit="contain" nativeControls={false} />;
}

function BannerVideo({
  id,
  uri,
  active,
  loop = true,
  onEnded,
}: {
  id: number;
  uri: string;
  active: boolean;
  loop?: boolean;
  onEnded?: () => void;
}) {
  const [localUri, setLocalUri] = useState<string | null>(() => videoCache.get(id) ?? null);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (localUri) return;
    let alive = true;
    let retry: ReturnType<typeof setTimeout> | null = null;
    fetchLocalVideo(id, uri)
      .then((u) => alive && setLocalUri(u))
      .catch(() => {
        if (!alive) return;
        // A dropped Wi-Fi frame on a shop counter shouldn't kill the banner for
        // the rest of the session — back off and try again a couple of times.
        if (attempt < 2) retry = setTimeout(() => alive && setAttempt((a) => a + 1), 2000);
        else setFailed(true);
      });
    return () => {
      alive = false;
      if (retry) clearTimeout(retry);
    };
  }, [id, uri, localUri, attempt]);
  if (failed) {
    return (
      <View style={[styles.image, styles.center]}>
        <Ionicons name="videocam-off-outline" size={54} color="#4b4b57" />
      </View>
    );
  }
  if (!localUri) {
    return (
      <View style={[styles.image, styles.center]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }
  return <LocalVideo uri={localUri} active={active} loop={loop} onEnded={onEnded} />;
}

const BARCODE_TYPES = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'code93',
  'itf14',
  'codabar',
  'qr',
] as const;

export default function SignageScreen() {
  const { user } = useAuth();
  const base = user?.base_url || '';
  const isFocused = useIsFocused();
  // Live, so banner paging stays correct on a rotating tablet and on a fixed
  // 1920x1080 landscape POS panel alike.
  const { width: W, height: H } = useWindowDimensions();
  const { setHidden } = useTabBar();
  const insets = useSafeAreaInsets();
  // Sit above the floating tab bar (bottom inset + bar height + gap).
  const barLift = (insets.bottom > 0 ? insets.bottom : 10) + 62 + 14;

  const [banners, setBanners] = useState<SignageBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [index, setIndex] = useState(0);
  const [slideH, setSlideH] = useState(0);
  const listRef = useRef<FlatList<SignageBanner>>(null);

  const [result, setResult] = useState<ProductLookup | null>(null);
  const [notFound, setNotFound] = useState('');
  const [looking, setLooking] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  // Scan mode (device-local, operator's choice); detail display time comes
  // from the server per lookup.
  const [scanMode, setScanMode] = useState<ScanMode>(DEFAULT_SCAN_MODE);
  const [appActive, setAppActive] = useState(true);

  const usbRef = useRef<TextInput>(null);
  const [usbValue, setUsbValue] = useState('');
  // Mirrors the input synchronously — state alone lags behind a fast scanner.
  const usbBuffer = useRef('');
  const lastScan = useRef<{ code: string; t: number }>({ code: '', t: 0 });

  // Banner player controls (tap to reveal, auto-hide, pause).
  const [paused, setPaused] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uiOpacity = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const [camModal, setCamModal] = useState(false);

  const scanBusy = !!result || !!notFound || looking;
  const usbEnabled = scanMode === 'usb';
  const wantCamera = scanMode === 'camera';
  // `base` keeps the camera from binding during the logged-out cold start,
  // when this screen mounts only to be routed away a moment later.
  const cameraLive = wantCamera && !!base && isFocused && appActive && !!permission?.granted;

  const load = useCallback(async () => {
    if (!base) {
      setLoading(false);
      return;
    }
    setError('');
    try {
      setBanners(await getSignageBanners(base));
      setIndex(0);
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    } catch (e: any) {
      // Surface a real error so a wrong URL / dropped Wi-Fi doesn't masquerade
      // as "No banners yet". Keep any banners already on screen (only blank when
      // there was nothing loaded yet).
      setError(e?.message || 'Cannot reach the server.');
    } finally {
      setLoading(false);
    }
  }, [base]);

  // On focus: reload banners + the latest scan settings from Profile.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      load();
      getScanMode().then((m) => alive && setScanMode(m));
      return () => {
        alive = false;
      };
    }, [load]),
  );

  // Pause the camera when the app goes to the background (battery).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);

  // Record a camera failure without acting on it. Disabling the camera
  // automatically is what previously left devices stuck with no way back —
  // the operator's choice in Scan Settings is now the only thing that decides.
  const onCameraMountError = useCallback((e?: { message?: string }) => {
    console.warn('[camera] mount failed:', e?.message ?? e);
    setCamModal(false);
  }, []);

  // Ask for camera permission for Camera mode, and for Auto (camera fallback).
  // Only in Camera mode, so a POS set to USB never sees a prompt.
  useEffect(() => {
    if (scanMode !== 'camera' || permission?.granted) return;
    (async () => {
      const res = await requestPermission();
      if (!res.granted && res.canAskAgain === false) {
        Alert.alert(
          'Camera permission needed',
          'Enable camera access for 369 in Settings to scan barcodes with the camera.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
      }
    })();
  }, [scanMode, permission?.granted, requestPermission]);

  // A video on Auto (no custom seconds) plays its full length, then the video's
  // own end drives the advance — not a fixed timer.
  const drivesAdvance = (b?: SignageBanner) =>
    !!b && b.media_type === 'video' && !b.scroll_seconds && banners.length >= 2;

  const advanceNext = () => {
    if (banners.length < 2) return;
    const next = (index + 1) % banners.length;
    listRef.current?.scrollToOffset({ offset: next * W, animated: true });
    setIndex(next);
  };

  const onVideoEnded = () => {
    if (scanBusy || paused) return;
    advanceNext();
  };

  // Auto-advance banners — paused while a scan overlay is open or the user paused.
  useEffect(() => {
    if (scanBusy || paused || banners.length < 2 || slideH === 0) return;
    const b = banners[index];
    // Auto videos advance on their own end (onVideoEnded). Keep a long safety cap
    // so a broken/loopless clip that never fires 'playToEnd' can't freeze the show.
    const ms = drivesAdvance(b)
      ? 60000
      : Math.max(2, Number(b?.scroll_seconds) || DEFAULT_SECONDS) * 1000;
    const t = setTimeout(advanceNext, ms);
    return () => clearTimeout(t);
  }, [index, banners, slideH, scanBusy, paused]);

  // Keep the hidden input focused so a USB barcode scanner (keyboard-wedge)
  // types into it — only in USB mode, and not while an overlay is up.
  // On a camera-less POS this input is the ONLY way to scan, so it is also
  // refocused on blur and whenever the app returns to the foreground.
  const refocusUsb = useCallback(() => {
    if (!usbEnabled || scanBusy) return;
    usbRef.current?.focus();
  }, [usbEnabled, scanBusy]);

  useEffect(() => {
    if (!usbEnabled || scanBusy) return;
    const t = setTimeout(refocusUsb, 350);
    return () => clearTimeout(t);
  }, [usbEnabled, scanBusy, banners.length, appActive, refocusUsb]);

  // Auto-dismiss the product detail after the shared (server) display time.
  useEffect(() => {
    if (!result) return;
    const secs = Math.max(2, result.detail_seconds || 8);
    const t = setTimeout(() => {
      setResult(null);
      lastScan.current = { code: '', t: 0 };
    }, secs * 1000);
    return () => clearTimeout(t);
  }, [result]);

  // Auto-dismiss the not-found message.
  useEffect(() => {
    if (!notFound) return;
    const t = setTimeout(() => {
      setNotFound('');
      lastScan.current = { code: '', t: 0 };
    }, 3000);
    return () => clearTimeout(t);
  }, [notFound]);

  const doLookup = async (code: string) => {
    // Scanners often append CR/LF or a tab, and some prepend control bytes —
    // strip anything non-printable so the server sees the bare barcode.
    const c = code.replace(/[\u0000-\u001F\u007F]/g, '').trim();
    // Ignore new scans while a result / not-found popup is up — the user must
    // close it (X) or wait for the timeout before the next scan works.
    if (!c || looking || result || notFound) return;
    setLooking(true);
    setNotFound('');
    setResult(null);
    try {
      const r = await lookupProduct(base, c);
      if (r.found) setResult(r);
      else setNotFound(c);
    } catch {
      setNotFound(c);
    } finally {
      setLooking(false);
    }
  };

  // A USB/HID scanner types the whole barcode in a few milliseconds and then
  // sends Enter. React batches those onChangeText updates, so `usbValue` state
  // can still be missing the last characters by the time Enter arrives —
  // which sent a truncated code to the server and looked like "not found".
  // The native event carries the authoritative text; the ref is a fallback.
  const onUsbSubmit = (e?: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
    const code = e?.nativeEvent?.text || usbBuffer.current || usbValue;
    usbBuffer.current = '';
    setUsbValue('');
    doLookup(code);
  };

  // Camera keeps scanning continuously; the same code within 2.5s is ignored so
  // one barcode in view doesn't fire the lookup on every frame.
  const onBarcode = ({ data }: { data: string }) => {
    if (scanBusy) return; // a popup is up → don't scan until it's closed / times out
    const now = Date.now();
    if (data === lastScan.current.code && now - lastScan.current.t < 2500) return;
    lastScan.current = { code: data, t: now };
    doLookup(data);
  };

  const dismiss = () => {
    setResult(null);
    setNotFound('');
    lastScan.current = { code: '', t: 0 };
  };

  // ---- Banner player controls ------------------------------------------
  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS);
  }, []);

  // On entering Home, briefly show the nav + controls, then go full-screen.
  useEffect(() => {
    if (isFocused) revealControls();
  }, [isFocused, revealControls]);

  // Auto-hide the bottom tab bar while Home is focused (full-screen signage);
  // tapping reveals the controls → shows it again; leaving Home restores it.
  useEffect(() => {
    // Only go full-screen (hide the tab bar) when there are banners to show.
    // With no banners the screen is empty, so keep the tab bar visible so the
    // user can still reach Profile → Logout.
    setHidden(isFocused && !controlsVisible && banners.length > 0);
  }, [isFocused, controlsVisible, banners.length, setHidden]);
  useEffect(() => () => setHidden(false), [setHidden]);

  // Fade the top bar / scan bar / controls together with the reveal state.
  useEffect(() => {
    Animated.timing(uiOpacity, {
      toValue: controlsVisible ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [controlsVisible, uiOpacity]);

  // Pop the scanned-product / not-found popup in; close the enlarged camera.
  useEffect(() => {
    if (result || notFound) {
      setCamModal(false);
      pop.setValue(0);
      Animated.spring(pop, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }).start();
    }
  }, [result, notFound, pop]);

  const popScale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });

  const toggleControls = () => {
    if (controlsVisible) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setControlsVisible(false);
    } else {
      revealControls();
    }
  };

  const go = (dir: number) => {
    if (!banners.length) return;
    const next = (index + dir + banners.length) % banners.length;
    listRef.current?.scrollToOffset({ offset: next * W, animated: true });
    setIndex(next);
    revealControls();
  };

  const goTo = (i: number) => {
    listRef.current?.scrollToOffset({ offset: i * W, animated: true });
    setIndex(i);
    revealControls();
  };

  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const onRefresh = () => {
    spin.setValue(0);
    Animated.timing(spin, { toValue: 1, duration: 600, easing: Easing.linear, useNativeDriver: true }).start();
    load();
    revealControls();
  };

  const togglePause = () => {
    setPaused((p) => !p);
    revealControls();
  };

  // TV remote support: any key reveals the controls; the play/pause key toggles.
  useEffect(() => {
    if (!Platform.isTV) return;
    // Accessed defensively — TVEventHandler only exists on TV builds.
    const RN = require('react-native');
    const TVEventHandler = RN.TVEventHandler;
    if (!TVEventHandler) return;
    const handler = new TVEventHandler();
    handler.enable(null, (_cmp: unknown, evt: { eventType?: string } | undefined) => {
      if (!evt) return;
      revealControls();
      if (evt.eventType === 'playPause') setPaused((p) => !p);
    });
    return () => {
      try {
        handler.disable();
      } catch {
        // ignore
      }
    };
  }, [revealControls]);

  const renderBanner = ({ item, index: i }: { item: SignageBanner; index: number }) => {
    const isVideo = item.media_type === 'video' && !!item.video;
    return (
      <View style={{ width: W, height: slideH, backgroundColor: '#0b0b12' }}>
        {isVideo ? (
          <BannerVideo
            id={item.id}
            uri={toReachable(item.video as string, base) as string}
            active={i === index && !scanBusy && !paused}
            loop={!drivesAdvance(item)}
            onEnded={i === index && drivesAdvance(item) ? onVideoEnded : undefined}
          />
        ) : item.image ? (
          <Image source={{ uri: item.image }} style={styles.image} resizeMode="contain" />
        ) : (
          <View style={[styles.image, styles.center]}>
            <Ionicons name="image-outline" size={64} color="#2a2a35" />
          </View>
        )}
        {/* Transparent tap layer on top — reveals the player controls even over a
            video, whose native surface would otherwise swallow the touch. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={toggleControls} />
      </View>
    );
  };

  return (
    <View style={styles.root} onLayout={(e) => setSlideH(e.nativeEvent.layout.height)}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.dim}>Loading…</Text>
        </View>
      ) : error && banners.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={54} color="#4b4b57" />
          <Text style={styles.stateTitle}>Can’t reach server</Text>
          <Text style={styles.dim}>{error}</Text>
          <Pressable style={styles.retry} onPress={load}>
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : banners.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="tv-outline" size={54} color="#4b4b57" />
          <Text style={styles.stateTitle}>No banners yet</Text>
          <Text style={styles.dim}>Add banners from Manage → Banners, then refresh.</Text>
          <Pressable style={styles.retry} onPress={load}>
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={styles.retryText}>Refresh</Text>
          </Pressable>
        </View>
      ) : slideH > 0 ? (
        <FlatList
          ref={listRef}
          data={banners}
          keyExtractor={(b) => String(b.id)}
          renderItem={renderBanner}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) =>
            setIndex(Math.round(e.nativeEvent.contentOffset.x / W))
          }
          getItemLayout={(_, i) => ({ length: W, offset: W * i, index: i })}
        />
      ) : null}

      {/* Hidden USB / keyboard-wedge scanner input (no soft keyboard). */}
      {usbEnabled ? (
        <TextInput
          ref={usbRef}
          value={usbValue}
          onChangeText={(t) => {
            usbBuffer.current = t;
            setUsbValue(t);
          }}
          onSubmitEditing={onUsbSubmit}
          onBlur={() => setTimeout(refocusUsb, 120)}
          submitBehavior="submit"
          showSoftInputOnFocus={false}
          autoCorrect={false}
          autoCapitalize="none"
          caretHidden
          style={styles.hiddenInput}
        />
      ) : null}

      {/* Top bar — dots always visible; count + reload fade with the reveal state */}
      {!loading && banners.length > 0 ? (
        <SafeAreaView edges={['top']} pointerEvents="box-none" style={styles.topBar}>
          <Animated.View style={{ opacity: uiOpacity }} pointerEvents="none">
            <View style={styles.pill}>
              <View style={styles.liveDot} />
              <Text style={styles.pillText}>
                {banners.length} {banners.length === 1 ? 'banner' : 'banners'}
              </Text>
            </View>
          </Animated.View>
          <View style={styles.dots}>
            {banners.map((b, i) => (
              <Pressable key={b.id} onPress={() => goTo(i)} hitSlop={8}>
                <View style={[styles.dot, i === index && styles.dotActive]} />
              </Pressable>
            ))}
          </View>
          <Animated.View style={{ opacity: uiOpacity }} pointerEvents={controlsVisible ? 'auto' : 'none'}>
            <Pressable onPress={onRefresh} style={styles.refresh} hitSlop={10}>
              <Animated.View style={{ transform: [{ rotate: spinDeg }] }}>
                <Ionicons name="refresh" size={18} color="#fff" />
              </Animated.View>
            </Pressable>
          </Animated.View>
        </SafeAreaView>
      ) : null}

      {/* Bottom scan bar (Camera mode) — hidden until tapped (like the controls);
          the camera keeps scanning underneath even while hidden (opacity 0). */}
      {cameraLive ? (
        <Animated.View
          pointerEvents={controlsVisible ? 'box-none' : 'none'}
          style={[styles.scanBarWrap, { bottom: barLift, opacity: uiOpacity }]}>
          <Pressable style={styles.scanBar} onPress={() => { setCamModal(true); revealControls(); }}>
            <View style={styles.viewfinder}>
              <CameraView
                style={StyleSheet.absoluteFill}
                onBarcodeScanned={onBarcode}
                onMountError={onCameraMountError}
                barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
              />
              <View style={styles.viewfinderExpand}>
                <Ionicons name="expand" size={12} color="#fff" />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.scanBarTitle}>Point a barcode at the camera</Text>
              <Text style={styles.scanBarHint}>Tap to enlarge</Text>
            </View>
            <View style={styles.scanDot} />
          </Pressable>
        </Animated.View>
      ) : null}

      {/* Banner player controls — fade in/out with the reveal state */}
      {!loading && banners.length > 0 ? (
        <Animated.View
          pointerEvents={controlsVisible ? 'box-none' : 'none'}
          style={[styles.controls, { bottom: barLift + (cameraLive ? 88 : 0), opacity: uiOpacity }]}>
          <View style={styles.ctrlRow}>
              <Pressable focusable onPress={() => go(-1)} style={styles.ctrlBtn} hitSlop={8}>
                <Ionicons name="play-skip-back" size={24} color="#fff" />
              </Pressable>
              <Pressable
                focusable
                hasTVPreferredFocus
                onPress={togglePause}
                style={[styles.ctrlBtn, styles.ctrlBtnMain]}
                hitSlop={8}>
                <Ionicons name={paused ? 'play' : 'pause'} size={28} color="#fff" />
              </Pressable>
            <Pressable focusable onPress={() => go(1)} style={styles.ctrlBtn} hitSlop={8}>
              <Ionicons name="play-skip-forward" size={24} color="#fff" />
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      {/* Looking up */}
      {looking ? (
        <View style={styles.overlay}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={[styles.dim, { marginTop: 10 }]}>Looking up…</Text>
        </View>
      ) : null}

      {/* Product detail */}
      {result
        ? (() => {
            // Drop fields with no value so empty rows (e.g. blank Sales Description)
            // never show. Price is always present, so it stays the head value.
            const detailRows = result.rows.filter((r) => String(r.value ?? '').trim() !== '');
            return (
              <Pressable style={styles.overlay} onPress={dismiss}>
                <Animated.View style={[styles.popWrap, { opacity: pop, transform: [{ scale: popScale }] }]}>
                  <Pressable style={[styles.detailCard, { maxHeight: H * 0.82 }]} onPress={() => {}}>
                    <View style={styles.detailImgWrap}>
                      {result.image ? (
                        <Image source={{ uri: result.image }} style={styles.detailImg} resizeMode="contain" />
                      ) : (
                        <View style={[styles.detailImg, styles.detailImgEmpty]}>
                          <Ionicons name="cube-outline" size={44} color="#c3c7d0" />
                        </View>
                      )}
                      <View style={styles.foundBadge}>
                        <Ionicons name="checkmark" size={15} color="#fff" />
                      </View>
                    </View>
                    <Text style={styles.detailName}>{result.name}</Text>
                    {detailRows.length ? (
                      <>
                        <Text style={styles.detailHeadValue} numberOfLines={1}>
                          {detailRows[0].value}
                        </Text>
                        <Text style={styles.detailHeadLabel}>{detailRows[0].label}</Text>
                        {detailRows.length > 1 ? (
                          <ScrollView
                            style={styles.rowsScroll}
                            contentContainerStyle={styles.rows}
                            showsVerticalScrollIndicator
                            keyboardShouldPersistTaps="handled"
                          >
                            {detailRows.slice(1).map((r, i) => (
                              <View key={`${r.label}-${i}`} style={styles.detailRow}>
                                <Text style={styles.detailLabel}>{r.label}</Text>
                                <Text style={styles.detailValue}>{r.value}</Text>
                              </View>
                            ))}
                          </ScrollView>
                        ) : null}
                      </>
                    ) : null}
                    <Pressable onPress={dismiss} style={styles.detailClose}>
                      <Text style={styles.detailCloseText}>Close</Text>
                    </Pressable>
                  </Pressable>
                </Animated.View>
              </Pressable>
            );
          })()
        : null}

      {/* Not found */}
      {notFound ? (
        <Pressable style={styles.overlay} onPress={dismiss}>
          <Animated.View style={[styles.popWrap, { opacity: pop, transform: [{ scale: popScale }] }]}>
          <View style={styles.detailCard}>
            <Ionicons name="alert-circle-outline" size={52} color={Brand.rose} />
            <Text style={styles.detailName}>Not found</Text>
            <Text style={[styles.dim, { marginTop: 6 }]}>
              No product for “{notFound}”, or it’s turned off for scan.
            </Text>
            <Pressable onPress={dismiss} style={styles.detailClose}>
              <Text style={styles.detailCloseText}>Try again</Text>
            </Pressable>
          </View>
          </Animated.View>
        </Pressable>
      ) : null}

      {/* Enlarged camera (tap the scan bar viewfinder) */}
      <Modal visible={camModal} transparent animationType="fade" onRequestClose={() => setCamModal(false)}>
        <Pressable style={styles.camModalWrap} onPress={() => setCamModal(false)}>
          <View style={styles.camModalCard}>
            {camModal ? (
              <CameraView
                style={StyleSheet.absoluteFill}
                onBarcodeScanned={onBarcode}
                onMountError={onCameraMountError}
                barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
              />
            ) : null}
            <View style={styles.camScanOverlay} pointerEvents="none">
              <View style={styles.camScanFrame} />
              <Text style={styles.camScanHint}>Point camera at the barcode</Text>
            </View>
            <Pressable style={styles.camModalClose} onPress={() => setCamModal(false)} hitSlop={10}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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
  hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0, top: -100 },
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
  dots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
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
  // Bottom scan bar (Camera mode) — sits above the floating tab bar.
  scanBarWrap: { position: 'absolute', left: 0, right: 0 },
  scanBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 14,
    padding: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  viewfinder: {
    width: 52,
    height: 52,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: '#000',
  },
  viewfinderExpand: {
    position: 'absolute',
    right: 3,
    top: 3,
    width: 18,
    height: 18,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBarTitle: { color: '#fff', fontWeight: '800', fontSize: 14 },
  scanBarHint: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2, fontWeight: '700' },
  scanDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#22c55e', marginRight: 6 },
  popWrap: { width: '100%', alignItems: 'center' },
  // Enlarged camera modal
  camModalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  // Landscape (wide) window — matches a horizontal barcode.
  // Square keeps the phone's portrait camera preview undistorted (16:9 stretched it).
  camModalCard: { width: '86%', maxWidth: 360, aspectRatio: 1, borderRadius: 22, overflow: 'hidden', backgroundColor: '#000' },
  camScanOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  camScanFrame: {
    width: '80%',
    aspectRatio: 280 / 150,
    borderWidth: 2.5,
    borderColor: '#FF9800',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  camScanHint: {
    marginTop: 16,
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    overflow: 'hidden',
  },
  camModalClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Banner player controls
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 10,
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  modeChipText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  ctrlRow: { flexDirection: 'row', alignItems: 'center', gap: 22 },
  ctrlBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlBtnMain: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Brand.indigo,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  detailCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 26,
    padding: 24,
    alignItems: 'center',
  },
  detailImgWrap: { marginBottom: 14 },
  detailImg: { width: 150, height: 150, borderRadius: 20, backgroundColor: '#f4f5f7', borderWidth: 1, borderColor: '#eef0f4' },
  detailImgEmpty: { alignItems: 'center', justifyContent: 'center' },
  foundBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  detailName: { fontSize: 20, fontWeight: '900', color: '#111827', textAlign: 'center' },
  detailHeadValue: { fontSize: 30, fontWeight: '900', color: Brand.indigo, textAlign: 'center', marginTop: 10 },
  detailHeadLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9aa0ac',
    textAlign: 'center',
    marginTop: 2,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  rowsScroll: { alignSelf: 'stretch', flexShrink: 1, marginTop: 16 },
  rows: { alignSelf: 'stretch' },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f1f4',
    gap: 14,
  },
  detailLabel: { fontSize: 14, color: '#6b7280', fontWeight: '600' },
  detailValue: { fontSize: 15, color: '#111827', fontWeight: '800', flexShrink: 1, textAlign: 'right' },
  detailClose: {
    marginTop: 18,
    alignSelf: 'stretch',
    backgroundColor: Brand.indigo,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  detailCloseText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
