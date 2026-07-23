import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Header, Loading, Screen, useC } from '@/components/ui';
import { Brand, Colors, Radius } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { BannerSave, getBannerDetail, saveBanner } from '@/services/odoo';

type Media = 'image' | 'video';
type Dur = 'auto' | 'custom';

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function BannerFormScreen() {
  const c = useC();
  const router = useRouter();
  const { user } = useAuth();
  const base = user?.base_url || '';
  const params = useLocalSearchParams<{ id?: string }>();
  const editing = !!params.id;
  const bannerId = Number(params.id || 0);

  const [loading, setLoading] = useState(editing);
  const [name, setName] = useState('');
  const [media, setMedia] = useState<Media>('image');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageB64, setImageB64] = useState<string | null>(null);
  const [videoName, setVideoName] = useState('');
  const [videoB64, setVideoB64] = useState<string | null>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [dur, setDur] = useState<Dur>('auto');
  const [seconds, setSeconds] = useState('6');
  const [sequence, setSequence] = useState('10');
  const [active, setActive] = useState(true);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [pick, setPick] = useState<null | 'start' | 'end'>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!editing || !base) return;
    try {
      const b = await getBannerDetail(base, bannerId);
      setName(b.name);
      setMedia(b.media_type);
      setImageUri(b.image || null);
      setHasVideo(b.has_video);
      setVideoName(b.video_filename);
      setDur(b.duration_mode);
      setSeconds(String(b.scroll_seconds || 6));
      setSequence(String(b.sequence || 10));
      setActive(b.active);
      setDateStart(b.date_start);
      setDateEnd(b.date_end);
    } catch (e: any) {
      setError(e?.message || 'Could not load the banner.');
    } finally {
      setLoading(false);
    }
  }, [editing, base, bannerId]);

  useEffect(() => {
    load();
  }, [load]);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to choose an image.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.7,
    });
    if (res.canceled) return;
    const a = res.assets[0];
    setImageB64(a.base64 || null);
    setImageUri(a.uri);
  };

  const pickVideo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to choose a video.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
    if (res.canceled) return;
    const a = res.assets[0];
    try {
      const b64 = await new File(a.uri).base64();
      setVideoB64(b64);
      setVideoName(a.fileName || `banner-video-${Date.now()}.mp4`);
      setHasVideo(true);
    } catch {
      Alert.alert('Error', 'Could not read that video file. Try an MP4.');
    }
  };

  const save = async () => {
    if (!name.trim()) {
      setError('Please enter a banner name.');
      return;
    }
    if (media === 'image' && !imageB64 && !imageUri) {
      setError('Please choose an image.');
      return;
    }
    if (media === 'video' && !videoB64 && !hasVideo) {
      setError('Please choose a video.');
      return;
    }
    setSaving(true);
    setError('');
    const payload: BannerSave = {
      name: name.trim(),
      media_type: media,
      duration_mode: dur,
      active,
    };
    if (editing) payload.banner_id = bannerId;
    if (imageB64) payload.image = imageB64;
    if (media === 'video' && videoB64) {
      payload.video = videoB64;
      payload.video_filename = videoName;
    }
    if (dur === 'custom') payload.scroll_seconds = Number(seconds) || 6;
    if (sequence) payload.sequence = Number(sequence) || 10;
    payload.date_start = dateStart || undefined;
    payload.date_end = dateEnd || undefined;
    try {
      await saveBanner(base, payload);
      router.back();
    } catch (e: any) {
      setError(e?.message || 'Could not save the banner.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={editing ? 'Edit banner' : 'New banner'} onBack={() => router.back()} gradient={['#2563eb', '#22d3ee']} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 130 }} keyboardShouldPersistTaps="handled">
        {/* Name */}
        <Text style={[styles.label, { color: c.textMuted }]}>NAME</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Banner name"
          placeholderTextColor={c.textMuted}
          style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
        />

        {/* Media type */}
        <Text style={[styles.label, { color: c.textMuted }]}>MEDIA TYPE</Text>
        <View style={[styles.segment, { backgroundColor: c.card, borderColor: c.border }]}>
          {(['image', 'video'] as Media[]).map((m) => {
            const on = media === m;
            return (
              <Pressable key={m} onPress={() => setMedia(m)} style={[styles.segItem, on && { backgroundColor: c.tint }]}>
                <Ionicons name={m === 'video' ? 'videocam' : 'image'} size={16} color={on ? '#fff' : c.textMuted} />
                <Text style={[styles.segText, { color: on ? '#fff' : c.text }]}>{m === 'video' ? 'Video' : 'Image'}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Media picker */}
        {media === 'image' ? (
          <Pressable onPress={pickImage} style={[styles.uploader, { backgroundColor: c.card, borderColor: c.border }]}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
            ) : (
              <View style={styles.uploaderEmpty}>
                <Ionicons name="cloud-upload-outline" size={30} color={c.textMuted} />
                <Text style={{ color: c.textMuted, marginTop: 6 }}>Choose an image</Text>
              </View>
            )}
            {imageUri ? <Text style={[styles.changeHint, { color: c.tint }]}>Tap to change</Text> : null}
          </Pressable>
        ) : (
          <Pressable onPress={pickVideo} style={[styles.uploader, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.uploaderEmpty}>
              <Ionicons name={hasVideo ? 'checkmark-circle' : 'videocam-outline'} size={30} color={hasVideo ? Brand.emerald : c.textMuted} />
              <Text style={{ color: c.text, marginTop: 6, fontWeight: '700' }} numberOfLines={1}>
                {hasVideo ? videoName || 'Video selected' : 'Choose a video (MP4/WebM)'}
              </Text>
              <Text style={[styles.changeHint, { color: c.tint }]}>{hasVideo ? 'Tap to replace' : ''}</Text>
            </View>
          </Pressable>
        )}

        {/* Timing */}
        <Text style={[styles.label, { color: c.textMuted }]}>TIME ON SCREEN</Text>
        <View style={[styles.segment, { backgroundColor: c.card, borderColor: c.border }]}>
          {(['auto', 'custom'] as Dur[]).map((d) => {
            const on = dur === d;
            return (
              <Pressable key={d} onPress={() => setDur(d)} style={[styles.segItem, on && { backgroundColor: c.tint }]}>
                <Text style={[styles.segText, { color: on ? '#fff' : c.text }]}>{d === 'auto' ? 'Auto' : 'Custom'}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.help, { color: c.textMuted }]}>
          {dur === 'auto'
            ? 'Images use the default time; a video plays its full length.'
            : 'Stays exactly the seconds below (a longer video is cut off).'}
        </Text>
        {media === 'video' && dur === 'custom' ? (
          <View style={styles.warnBox}>
            <Ionicons name="warning" size={16} color={Brand.rose} />
            <Text style={styles.warnText}>
              For a video, use <Text style={{ fontWeight: '900' }}>Auto</Text> — with Custom the video
              gets cut off at the set seconds and won’t finish playing.
            </Text>
          </View>
        ) : null}
        {dur === 'custom' ? (
          <Row2 c={c} label="Seconds">
            <TextInput
              value={seconds}
              onChangeText={setSeconds}
              keyboardType="number-pad"
              style={[styles.smallInput, { color: c.text, borderColor: c.border }]}
            />
          </Row2>
        ) : null}

        {/* Order + active */}
        <Row2 c={c} label="Sequence (order)">
          <TextInput
            value={sequence}
            onChangeText={setSequence}
            keyboardType="number-pad"
            style={[styles.smallInput, { color: c.text, borderColor: c.border }]}
          />
        </Row2>
        <Row2 c={c} label="Active">
          <Switch value={active} onValueChange={setActive} trackColor={{ true: Brand.indigo }} />
        </Row2>

        {/* Schedule */}
        <Text style={[styles.label, { color: c.textMuted }]}>SCHEDULE (OPTIONAL)</Text>
        <View style={[styles.group, { backgroundColor: c.card, borderColor: c.border }]}>
          <DateRow c={c} label="Start date" value={dateStart} onPick={() => setPick('start')} onClear={() => setDateStart('')} />
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          <DateRow c={c} label="End date" value={dateEnd} onPick={() => setPick('end')} onClear={() => setDateEnd('')} />
        </View>

        {pick ? (
          <DateTimePicker
            value={
              pick === 'start'
                ? dateStart
                  ? new Date(dateStart)
                  : new Date()
                : dateEnd
                  ? new Date(dateEnd)
                  : new Date()
            }
            mode="date"
            onChange={(e, d) => {
              const which = pick;
              setPick(null);
              if (e.type === 'set' && d) {
                if (which === 'start') setDateStart(fmt(d));
                else setDateEnd(fmt(d));
              }
            }}
          />
        ) : null}

        {error ? <Text style={[styles.err, { color: Brand.rose }]}>{error}</Text> : null}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={[styles.saveBar, { backgroundColor: c.card, borderTopColor: c.border }]}>
        <Pressable onPress={save} disabled={saving} style={[styles.saveBtn, { backgroundColor: Brand.indigo }]}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="save-outline" size={18} color="#fff" />
              <Text style={styles.saveText}>{editing ? 'Save changes' : 'Create banner'}</Text>
            </>
          )}
        </Pressable>
      </SafeAreaView>
    </Screen>
  );
}

function Row2({ c, label, children }: { c: (typeof Colors)['light']; label: string; children: ReactNode }) {
  return (
    <View style={[styles.row2, { borderColor: c.border, backgroundColor: c.card }]}>
      <Text style={[styles.row2Label, { color: c.text }]}>{label}</Text>
      {children}
    </View>
  );
}

function DateRow({
  c,
  label,
  value,
  onPick,
  onClear,
}: {
  c: (typeof Colors)['light'];
  label: string;
  value: string;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <Pressable onPress={onPick} style={styles.dateRow}>
      <Text style={[styles.row2Label, { color: c.text }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ color: value ? c.text : c.textMuted, fontWeight: '600' }}>{value || 'Any'}</Text>
        {value ? (
          <Pressable onPress={onClear} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={c.textMuted} />
          </Pressable>
        ) : (
          <Ionicons name="calendar-outline" size={18} color={c.textMuted} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 10 },
  iconBtn: { padding: 2 },
  h1: { flex: 1, fontSize: 22, fontWeight: '900' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: 18, marginBottom: 8, marginLeft: 4 },
  input: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 14, height: 48, fontSize: 15 },
  segment: { flexDirection: 'row', borderRadius: Radius.md, borderWidth: 1, padding: 4, gap: 4 },
  segItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: Radius.sm },
  segText: { fontSize: 14, fontWeight: '800' },
  uploader: { marginTop: 12, borderRadius: Radius.lg, borderWidth: 1, borderStyle: 'dashed', padding: 14, alignItems: 'center' },
  uploaderEmpty: { alignItems: 'center', paddingVertical: 16 },
  preview: { width: '100%', height: 170, borderRadius: 10, backgroundColor: '#0b0b12' },
  changeHint: { fontSize: 12.5, fontWeight: '800', marginTop: 8 },
  help: { fontSize: 12.5, marginTop: 8, marginLeft: 4, lineHeight: 17 },
  warnBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 10,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Brand.rose,
    backgroundColor: 'rgba(244,63,94,0.08)',
  },
  warnText: { flex: 1, color: Brand.rose, fontSize: 12.5, fontWeight: '700', lineHeight: 17 },
  group: { borderRadius: Radius.md, borderWidth: 1, overflow: 'hidden' },
  row2: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12, marginTop: 12 },
  row2Label: { fontSize: 15, fontWeight: '700' },
  smallInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 40, minWidth: 90, textAlign: 'right', fontSize: 15 },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 14 },
  divider: { height: 1, marginLeft: 14 },
  err: { marginTop: 16, textAlign: 'center', fontWeight: '600' },
  saveBar: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 10 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: Radius.md },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
