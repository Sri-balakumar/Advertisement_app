import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ComponentProps, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientButton } from '@/components/gradient-button';
import { Brand, Colors, Radius } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  createAd,
  getAdDetail,
  NewAd,
  OdooProduct,
  searchProducts,
  updateAd,
} from '@/services/odoo';

type Colorset = (typeof Colors)['light'];

async function uriToBase64(uri: string): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => {
      const s = String(reader.result);
      resolve(s.includes(',') ? s.split(',')[1] : s);
    };
    reader.readAsDataURL(blob);
  });
}

/** Rewrite an Odoo URL to the host the app logged into (reachable video URL). */
function toReachable(url: string | false, base: string): string | false {
  if (!url || !base) return url;
  const path = url.replace(/^https?:\/\/[^/]+/i, '');
  return path.startsWith('/') ? base.replace(/\/+$/, '') + path : url;
}

/** Inline video preview (muted, looping, tap to play). */
function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });
  return (
    <VideoView
      player={player}
      style={{ width: '100%', height: '100%' }}
      contentFit="contain"
      nativeControls
      allowsFullscreen={false}
      allowsPictureInPicture={false}
    />
  );
}

const toYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function Segmented<T extends string>({
  value,
  options,
  onChange,
  c,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  c: Colorset;
}) {
  return (
    <View style={[styles.seg, { borderColor: c.border, backgroundColor: c.background }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segItem, on && { backgroundColor: c.tint }]}>
            <Text style={{ color: on ? '#fff' : c.textMuted, fontWeight: '700', fontSize: 13 }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Label({ text, c }: { text: string; c: Colorset }) {
  return <Text style={[styles.label, { color: c.textMuted }]}>{text}</Text>;
}

export default function AdFormScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editId = id ? Number(id) : null;

  const [loading, setLoading] = useState(!!editId);
  const [name, setName] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [image, setImage] = useState<{ uri: string; base64: string } | null>(null);
  const [existingImage, setExistingImage] = useState<string | null>(null);
  const [video, setVideo] = useState<{ uri: string; name: string; base64: string } | null>(null);
  const [existingVideoName, setExistingVideoName] = useState('');
  const [existingVideoUrl, setExistingVideoUrl] = useState<string | null>(null);
  const [hasQr, setHasQr] = useState(false);
  const [qrSource, setQrSource] = useState<'link' | 'file' | 'product'>('link');
  const [linkUrl, setLinkUrl] = useState('');
  const [file, setFile] = useState<{ name: string; base64: string } | null>(null);
  const [existingFileName, setExistingFileName] = useState('');
  const [product, setProduct] = useState<OdooProduct | null>(null);
  const [productModal, setProductModal] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState<OdooProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [comparePrice, setComparePrice] = useState('');
  const [ctaPhone, setCtaPhone] = useState('');
  const [durationMode, setDurationMode] = useState<'auto' | 'custom'>('auto');
  const [seconds, setSeconds] = useState('4');
  const [sequence, setSequence] = useState('10');
  const [active, setActive] = useState(true);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  // Load an existing ad for editing.
  useEffect(() => {
    if (!editId || !user?.base_url) return;
    (async () => {
      try {
        const d = await getAdDetail(user.base_url, editId);
        setName(d.name);
        setMediaType(d.media_type);
        setExistingImage(typeof d.image === 'string' ? d.image : null);
        setExistingVideoName(d.video_filename);
        setExistingVideoUrl(
          typeof d.video === 'string' ? (toReachable(d.video, user.base_url) as string) : null,
        );
        setHasQr(d.has_qr);
        setQrSource(d.qr_source);
        setLinkUrl(d.link_url);
        setExistingFileName(d.qr_filename);
        if (d.product_id)
          setProduct({ id: d.product_id, name: d.product_name, price: 0, currency: '' });
        setComparePrice(d.compare_price ? String(d.compare_price) : '');
        setCtaPhone(d.cta_phone);
        setDurationMode(d.duration_mode);
        setSeconds(String(d.scroll_seconds || 4));
        setSequence(String(d.sequence ?? 10));
        setActive(d.active);
        setDateStart(d.date_start);
        setDateEnd(d.date_end);
      } catch (e: any) {
        setError(e?.message || 'Could not load the ad.');
      } finally {
        setLoading(false);
      }
    })();
  }, [editId, user?.base_url]);

  // Product search (debounced) while the picker is open.
  useEffect(() => {
    if (!productModal || !user?.base_url) return;
    setSearching(true);
    const t = setTimeout(async () => {
      setProductResults(await searchProducts(user.base_url, productQuery.trim()));
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [productQuery, productModal, user?.base_url]);

  // Auto-dismiss the success note.
  useEffect(() => {
    if (!ok) return;
    const t = setTimeout(() => setOk(''), 3000);
    return () => clearTimeout(t);
  }, [ok]);

  const pickImage = async () => {
    setError('');
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setError('Photo permission is needed.');
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: true,
    });
    if (!res.canceled && res.assets?.[0]?.base64)
      setImage({ uri: res.assets[0].uri, base64: res.assets[0].base64 });
  };

  const pickVideo = async () => {
    setError('');
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setError('Photo permission is needed.');
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
    if (res.canceled || !res.assets?.[0]) return;
    try {
      const b64 = await uriToBase64(res.assets[0].uri);
      if (b64.length > 11_000_000) return setError('Video is too large — keep it under ~8 MB.');
      setVideo({ uri: res.assets[0].uri, name: res.assets[0].fileName || 'video.mp4', base64: b64 });
    } catch (e: any) {
      setError(e?.message || 'Could not read the video.');
    }
  };

  const pickFile = async () => {
    setError('');
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    try {
      const b64 = await uriToBase64(res.assets[0].uri);
      if (b64.length > 11_000_000) return setError('File is too large — keep it under ~8 MB.');
      setFile({ name: res.assets[0].name || 'file', base64: b64 });
    } catch (e: any) {
      setError(e?.message || 'Could not read the file.');
    }
  };

  const submit = async () => {
    setError('');
    setOk('');
    if (!name.trim()) return setError('Enter an ad name.');
    if (mediaType === 'image' && !image && !existingImage) return setError('Upload an image.');
    if (mediaType === 'video' && !video && !existingVideoName) return setError('Upload a video.');
    if (!hasQr) {
      if (qrSource === 'link' && !linkUrl.trim()) return setError('Enter the link URL.');
      if (qrSource === 'file' && !file && !existingFileName) return setError('Upload a file.');
      if (qrSource === 'product' && !product) return setError('Choose a product.');
    }
    if (!user?.base_url) return setError('You are not signed in.');

    const payload: NewAd = {
      name: name.trim(),
      media_type: mediaType,
      image: image?.base64,
      video: mediaType === 'video' ? video?.base64 : undefined,
      video_filename: mediaType === 'video' ? video?.name : undefined,
      has_qr: hasQr,
      qr_source: qrSource,
      link_url: !hasQr && qrSource === 'link' ? linkUrl.trim() : undefined,
      qr_file: !hasQr && qrSource === 'file' ? file?.base64 : undefined,
      qr_filename: !hasQr && qrSource === 'file' ? file?.name : undefined,
      product_id: !hasQr && qrSource === 'product' ? product?.id : undefined,
      compare_price:
        !hasQr && qrSource === 'product' && comparePrice ? Number(comparePrice) : undefined,
      cta_phone: !hasQr && qrSource === 'product' && ctaPhone ? ctaPhone.trim() : undefined,
      duration_mode: durationMode,
      scroll_seconds: durationMode === 'custom' ? Number(seconds) || 4 : undefined,
      sequence: sequence ? Number(sequence) : undefined,
      active,
      date_start: dateStart || undefined,
      date_end: dateEnd || undefined,
    };

    setSaving(true);
    try {
      if (editId) {
        await updateAd(user.base_url, editId, payload);
        setOk('Saved!');
        setTimeout(() => router.back(), 700);
      } else {
        await createAd(user.base_url, payload);
        setOk('Ad published!');
        setTimeout(() => router.back(), 700);
      }
    } catch (e: any) {
      setError(e?.message || 'Could not save the ad.');
    } finally {
      setSaving(false);
    }
  };

  const input = (
    value: string,
    onChangeText: (t: string) => void,
    placeholder: string,
    extra: Partial<ComponentProps<typeof TextInput>> = {},
  ) => (
    <View style={[styles.inputRow, { backgroundColor: c.background, borderColor: c.border }]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        style={[styles.input, { color: c.text }]}
        {...extra}
      />
    </View>
  );

  const dateRow = (label: string, value: string, onPress: () => void, onClear: () => void) => (
    <Pressable onPress={onPress} style={[styles.inputRow, { backgroundColor: c.background, borderColor: c.border }]}>
      <Ionicons name="calendar-outline" size={18} color={c.textMuted} />
      <Text style={{ flex: 1, marginLeft: 10, color: value ? c.text : c.textMuted, fontSize: 15 }}>
        {value || label}
      </Text>
      {value ? (
        <Pressable onPress={onClear} hitSlop={8}>
          <Ionicons name="close-circle" size={18} color={c.textMuted} />
        </Pressable>
      ) : null}
    </Pressable>
  );

  const imgPreview = image?.uri || existingImage;
  const videoUri = video?.uri || existingVideoUrl;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <SafeAreaView edges={['top']} style={[styles.header, { borderBottomColor: c.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.text }]}>{editId ? 'Edit Ad' : 'New Ad'}</Text>
        <View style={{ width: 30 }} />
      </SafeAreaView>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={c.tint} size="large" />
        </View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
          <Label text="Media Type" c={c} />
          <Segmented
            value={mediaType}
            onChange={setMediaType}
            c={c}
            options={[
              { value: 'image', label: 'Image' },
              { value: 'video', label: 'Video' },
            ]}
          />
          {mediaType === 'image' ? (
            <Pressable onPress={pickImage} style={[styles.upload, { backgroundColor: c.card, borderColor: c.border }]}>
              {imgPreview ? (
                <Image source={{ uri: imgPreview }} style={styles.preview} resizeMode="cover" />
              ) : (
                <View style={styles.uploadEmpty}>
                  <Ionicons name="image-outline" size={34} color={c.textMuted} />
                  <Text style={[styles.uploadHint, { color: c.textMuted }]}>Tap to upload image</Text>
                </View>
              )}
            </Pressable>
          ) : videoUri ? (
            <View>
              <View style={[styles.upload, { backgroundColor: '#000', borderStyle: 'solid', borderColor: c.border }]}>
                <VideoPreview uri={videoUri} />
              </View>
              <Pressable onPress={pickVideo} style={[styles.changeBtn, { borderColor: c.border }]}>
                <Ionicons name="swap-horizontal" size={16} color={c.tint} />
                <Text style={{ color: c.tint, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
                  Change video{video?.name ? ` · ${video.name}` : existingVideoName ? ` · ${existingVideoName}` : ''}
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={pickVideo} style={[styles.filePick, { backgroundColor: c.card, borderColor: c.border }]}>
              <Ionicons name="videocam-outline" size={20} color={c.textMuted} />
              <Text style={[styles.filePickText, { color: c.textMuted }]}>Tap to upload video</Text>
            </Pressable>
          )}

          <Label text="Ad Name" c={c} />
          {input(name, setName, 'e.g. Summer Promo')}

          <View style={[styles.switchRow, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.switchTitle, { color: c.text }]}>Image or Video already has a QR</Text>
              <Text style={[styles.switchSub, { color: c.textMuted }]}>On = full-screen. Off = we add a QR below.</Text>
            </View>
            <Switch value={hasQr} onValueChange={setHasQr} trackColor={{ true: Brand.indigo }} />
          </View>

          {!hasQr ? (
            <>
              <Label text="QR Points To" c={c} />
              <Segmented
                value={qrSource}
                onChange={setQrSource}
                c={c}
                options={[
                  { value: 'link', label: 'Link' },
                  { value: 'file', label: 'File' },
                  { value: 'product', label: 'Product' },
                ]}
              />
              {qrSource === 'link' ? (
                <>
                  <Label text="Link" c={c} />
                  {input(linkUrl, setLinkUrl, 'https://example.com', {
                    autoCapitalize: 'none',
                    keyboardType: 'url',
                    autoCorrect: false,
                  })}
                </>
              ) : null}
              {qrSource === 'file' ? (
                <Pressable onPress={pickFile} style={[styles.filePick, { backgroundColor: c.card, borderColor: c.border, marginTop: 12 }]}>
                  <Ionicons name={file || existingFileName ? 'document-attach' : 'document-outline'} size={20} color={file || existingFileName ? Brand.emerald : c.textMuted} />
                  <Text style={[styles.filePickText, { color: file || existingFileName ? c.text : c.textMuted }]} numberOfLines={1}>
                    {file?.name || existingFileName || 'Tap to upload a file / document'}
                  </Text>
                </Pressable>
              ) : null}
              {qrSource === 'product' ? (
                <View style={{ marginTop: 12 }}>
                  <Pressable
                    onPress={() => {
                      setProductQuery('');
                      setProductResults([]);
                      setProductModal(true);
                    }}
                    style={[styles.inputRow, { backgroundColor: c.background, borderColor: c.border }]}>
                    <Ionicons name="pricetag-outline" size={18} color={c.textMuted} />
                    <Text style={{ flex: 1, marginLeft: 10, color: product ? c.text : c.textMuted, fontSize: 15 }} numberOfLines={1}>
                      {product ? product.name : 'Choose a product'}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={c.textMuted} />
                  </Pressable>
                  <Label text="Was price (optional)" c={c} />
                  {input(comparePrice, setComparePrice, 'e.g. 999', { keyboardType: 'numeric' })}
                  <Label text="Contact phone (WhatsApp / Call)" c={c} />
                  {input(ctaPhone, setCtaPhone, 'e.g. 919876543210', { keyboardType: 'phone-pad' })}
                </View>
              ) : null}
            </>
          ) : null}

          <Label text="Time on Screen" c={c} />
          <Segmented
            value={durationMode}
            onChange={setDurationMode}
            c={c}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'custom', label: 'Custom' },
            ]}
          />
          {durationMode === 'custom' ? (
            <>
              <Label text="Seconds on screen" c={c} />
              {input(seconds, setSeconds, '4', { keyboardType: 'numeric' })}
            </>
          ) : null}

          <Label text="Order (smaller shows first)" c={c} />
          {input(sequence, setSequence, '10', { keyboardType: 'numeric' })}

          <View style={[styles.switchRow, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.switchTitle, { color: c.text, flex: 1 }]}>Active</Text>
            <Switch value={active} onValueChange={setActive} trackColor={{ true: Brand.indigo }} />
          </View>

          <Label text="Start date (optional)" c={c} />
          {dateRow('Set start date', dateStart, () => setShowStart(true), () => setDateStart(''))}
          <Label text="End date (optional)" c={c} />
          {dateRow('Set end date', dateEnd, () => setShowEnd(true), () => setDateEnd(''))}

          {showStart ? (
            <DateTimePicker
              value={dateStart ? new Date(dateStart) : new Date()}
              mode="date"
              onChange={(e, d) => {
                setShowStart(false);
                if (e.type === 'set' && d) setDateStart(toYMD(d));
              }}
            />
          ) : null}
          {showEnd ? (
            <DateTimePicker
              value={dateEnd ? new Date(dateEnd) : new Date()}
              mode="date"
              onChange={(e, d) => {
                setShowEnd(false);
                if (e.type === 'set' && d) setDateEnd(toYMD(d));
              }}
            />
          ) : null}

          {error ? (
            <View style={styles.msgErr}>
              <Ionicons name="alert-circle" size={16} color="#e11d48" />
              <Text style={styles.msgErrText}>{error}</Text>
            </View>
          ) : null}
          {ok ? (
            <View style={styles.msgOk}>
              <Ionicons name="checkmark-circle" size={16} color="#166534" />
              <Text style={styles.msgOkText}>{ok}</Text>
            </View>
          ) : null}

          <GradientButton
            label={saving ? 'Saving…' : editId ? 'Save changes' : 'Publish ad'}
            icon="cloud-upload-outline"
            loading={saving}
            onPress={submit}
            style={{ marginTop: 20 }}
          />
        </ScrollView>
      )}

      {/* Product picker popup */}
      <Modal visible={productModal} transparent animationType="fade" onRequestClose={() => setProductModal(false)}>
        <Pressable style={styles.backdrop} onPress={() => setProductModal(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: c.card }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: c.text }]}>Choose product</Text>
            <View style={[styles.searchRow, { backgroundColor: c.background, borderColor: c.border }]}>
              <Ionicons name="search" size={18} color={c.textMuted} />
              <TextInput
                value={productQuery}
                onChangeText={setProductQuery}
                placeholder="Search products…"
                placeholderTextColor={c.textMuted}
                autoFocus
                autoCapitalize="none"
                style={[styles.input, { color: c.text, marginLeft: 8 }]}
              />
            </View>
            <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
              {searching ? (
                <View style={{ padding: 20 }}>
                  <ActivityIndicator color={c.tint} />
                </View>
              ) : productResults.length === 0 ? (
                <Text style={{ padding: 16, color: c.textMuted, fontSize: 13 }}>
                  {productQuery ? 'No products found.' : 'Type to search your products.'}
                </Text>
              ) : (
                productResults.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      setProduct(p);
                      setProductModal(false);
                    }}
                    style={[styles.resultRow, { borderBottomColor: c.border }]}>
                    <Text style={{ flex: 1, color: c.text }} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={{ color: c.textMuted }}>
                      {p.currency}
                      {p.price}
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  back: { width: 30 },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '700', marginTop: 16, marginBottom: 6 },
  seg: { flexDirection: 'row', borderWidth: 1, borderRadius: Radius.md, padding: 3, gap: 3 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: Radius.sm },
  upload: {
    height: 170,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  preview: { width: '100%', height: '100%' },
  uploadEmpty: { alignItems: 'center', gap: 8 },
  uploadHint: { fontSize: 13, fontWeight: '600' },
  filePick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginTop: 10,
  },
  filePickText: { flex: 1, fontSize: 14, fontWeight: '600' },
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  input: { flex: 1, fontSize: 15 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    padding: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  switchTitle: { fontSize: 14, fontWeight: '700' },
  switchSub: { fontSize: 12, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  modalCard: { borderRadius: 18, padding: 16, overflow: 'hidden' },
  modalTitle: { fontSize: 17, fontWeight: '800', marginBottom: 12 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  msgErr: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    backgroundColor: 'rgba(244,63,94,0.1)',
    padding: 10,
    borderRadius: 10,
  },
  msgErrText: { color: '#e11d48', fontSize: 13, flex: 1 },
  msgOk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    backgroundColor: 'rgba(22,163,74,0.12)',
    padding: 10,
    borderRadius: 10,
  },
  msgOkText: { color: '#166534', fontSize: 13, flex: 1 },
});
