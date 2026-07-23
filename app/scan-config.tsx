import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ReactNode, useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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

import { EmptyState, Header, Loading, Screen, useC } from '@/components/ui';
import { Brand, Colors, Radius, Shadow } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import {
  getGlobalScanFields,
  getProductFields,
  getScanProductConfig,
  ProductField,
  saveScanProductConfig,
  ScanConfigField,
  setGlobalScanFields,
} from '@/services/odoo';

type C = (typeof Colors)['light'];

export default function ScanConfigScreen() {
  const c = useC();
  const router = useRouter();
  const { user } = useAuth();
  const base = user?.base_url || '';
  const params = useLocalSearchParams<{ id?: string; name?: string; global?: string; globalActive?: string }>();
  const isGlobal = params.global === '1';
  // Global-mode flag passed straight from the Scan Fields screen (authoritative,
  // never stale) — used to decide the confirmation prompt below.
  const navGlobalActive = params.globalActive === '1';
  const tmplId = Number(params.id);

  const [name, setName] = useState(params.name || '');
  const [barcode, setBarcode] = useState('');
  const [image, setImage] = useState<string | false>(false);
  const [enabled, setEnabled] = useState(true);
  const [showImage, setShowImage] = useState(true);
  const [fields, setFields] = useState<ScanConfigField[]>([]);

  const [catalog, setCatalog] = useState<ProductField[]>([]);
  // Start from the nav param so the prompt works immediately, before any fetch.
  const [globalOn, setGlobalOn] = useState(navGlobalActive);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickQuery, setPickQuery] = useState('');

  const load = useCallback(async () => {
    if (!base || (!isGlobal && !tmplId)) {
      setLoading(false);
      return;
    }
    setError('');
    try {
      if (isGlobal) {
        // Global fields editor: one shared list, no product / master switches.
        const [glob, cat] = await Promise.all([
          getGlobalScanFields(base),
          getProductFields(base).catch(() => [] as ProductField[]),
        ]);
        setName('Global Fields');
        setFields(glob.fields);
        setCatalog(cat);
        setGlobalOn(false); // this IS the global editor — no per-product warning
        return;
      }
      const [cfg, cat, glob] = await Promise.all([
        getScanProductConfig(base, tmplId),
        getProductFields(base).catch(() => [] as ProductField[]),
        getGlobalScanFields(base).catch(() => ({ mode: false, fields: [] })),
      ]);
      setName(cfg.name);
      setBarcode(cfg.barcode);
      setImage(cfg.image);
      setEnabled(cfg.signage_enabled);
      setShowImage(cfg.signage_show_image);
      setFields(cfg.fields);
      setCatalog(cat);
      // Prompt if EITHER the nav param or the server says global mode is on.
      setGlobalOn(!!glob.mode || navGlobalActive);
    } catch (e: any) {
      setError(e?.message || (isGlobal ? 'Could not load global fields.' : 'Could not load the product.'));
    } finally {
      setLoading(false);
    }
  }, [base, tmplId, isGlobal, navGlobalActive]);

  // Reload on focus (not just mount) so the global-mode flag is always fresh —
  // e.g. after turning Global on and then opening / returning to a product.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const dirty = () => setSaved(false);

  // Confirmation modal (works on every platform, unlike Alert on web). Holds the
  // action to run if the user confirms turning a field on while Global is on.
  const [confirmAction, setConfirmAction] = useState<null | (() => void)>(null);

  // When global fields mode is on, per-product field changes won't show on scan
  // until it's turned off — so warn before turning a field on for this product.
  const confirmIfGlobal = (onConfirm: () => void) => {
    setConfirmAction(() => onConfirm);
  };

  const applyFieldShow = (fieldId: number, v: boolean) => {
    setFields((p) => p.map((f) => (f.field_id === fieldId ? { ...f, show: v } : f)));
    dirty();
  };
  const setFieldShow = (fieldId: number, v: boolean) => {
    if (v && globalOn) {
      confirmIfGlobal(() => applyFieldShow(fieldId, v));
      return;
    }
    applyFieldShow(fieldId, v);
  };
  const removeField = (fieldId: number) => {
    setFields((p) => p.filter((f) => f.field_id !== fieldId));
    dirty();
  };
  const move = (i: number, dir: -1 | 1) => {
    setFields((p) => {
      const j = i + dir;
      if (j < 0 || j >= p.length) return p;
      const next = [...p];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    dirty();
  };
  const applyAddField = (f: ProductField) => {
    setFields((p) =>
      p.some((x) => x.field_id === f.field_id)
        ? p
        : [...p, { line_id: 0, field_id: f.field_id, name: f.name, label: f.label, show: true }],
    );
    dirty();
  };
  const addField = (f: ProductField) => {
    if (globalOn) {
      confirmIfGlobal(() => applyAddField(f));
      return;
    }
    applyAddField(f);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      if (isGlobal) {
        await setGlobalScanFields(base, {
          mode: true,
          fields: fields.map((f) => ({ field_id: f.field_id, show: f.show })),
        });
      } else {
        await saveScanProductConfig(base, {
          tmpl_id: tmplId,
          signage_enabled: enabled,
          signage_show_image: showImage,
          fields: fields.map((f) => ({ field_id: f.field_id, show: f.show })),
        });
      }
      setSaved(true);
    } catch (e: any) {
      setError(e?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const available = catalog.filter(
    (a) =>
      !fields.some((f) => f.field_id === a.field_id) &&
      (a.label.toLowerCase().includes(pickQuery.toLowerCase()) ||
        a.name.toLowerCase().includes(pickQuery.toLowerCase())),
  );

  return (
    <Screen>
      <Header title={isGlobal ? 'Global Fields' : name || 'Scan Config'} onBack={() => router.back()} gradient={['#2563eb', '#22d3ee']} />

      {loading ? (
        <Loading />
      ) : error && fields.length === 0 && !name ? (
        <EmptyState icon="cloud-offline-outline" title="Couldn’t load" text={error} actionLabel="Retry" onAction={load} />
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 130 }}>
            {isGlobal ? (
              <Text style={[styles.pMeta, { color: c.textMuted, marginBottom: 4 }]}>
                These fields show for every product while “Same fields for all” is on.
              </Text>
            ) : (
              <>
                {globalOn ? (
                  <View style={[styles.globalNote, { backgroundColor: Brand.amber + '22', borderColor: Brand.amber }]}>
                    <Ionicons name="information-circle" size={16} color={Brand.amber} />
                    <Text style={[styles.globalNoteText, { color: c.text }]}>
                      Global fields are ON — these per-product fields won’t show until Global is turned off.
                    </Text>
                  </View>
                ) : null}
                {/* Product header */}
                <View style={[styles.pCard, Shadow.soft, { backgroundColor: c.card, borderColor: c.border }]}>
                  {image ? (
                    <Image source={{ uri: image }} style={styles.pImg} resizeMode="contain" />
                  ) : (
                    <View style={[styles.pImg, styles.pImgEmpty]}>
                      <Ionicons name="cube-outline" size={30} color="#9aa0ac" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pName, { color: c.text }]} numberOfLines={2}>
                      {name}
                    </Text>
                    <Text style={[styles.pMeta, { color: c.textMuted }]}>
                      {barcode ? barcode : 'No barcode'}
                    </Text>
                  </View>
                </View>

                {/* Master switches */}
                <View style={[styles.group, { backgroundColor: c.card, borderColor: c.border }]}>
                  <Row c={c}>
                    <RowText c={c} label="Show on scan" sub="Off = scanning shows nothing" />
                    <Switch value={enabled} onValueChange={(v) => { setEnabled(v); dirty(); }} trackColor={{ true: Brand.indigo }} />
                  </Row>
                  <Divider c={c} />
                  <Row c={c}>
                    <RowText c={c} label="Show product image" />
                    <Switch value={showImage} onValueChange={(v) => { setShowImage(v); dirty(); }} trackColor={{ true: Brand.indigo }} />
                  </Row>
                </View>
              </>
            )}

            {/* Fields */}
            <View style={styles.sectionHead}>
              <Text style={[styles.sectionLabel, { color: c.textMuted }]}>FIELDS SHOWN ON SCAN</Text>
              <Pressable
                onPress={() => { setPickQuery(''); setPickerOpen(true); }}
                style={[styles.addBtn, { borderColor: c.tint }]}>
                <Ionicons name="add" size={16} color={c.tint} />
                <Text style={[styles.addBtnText, { color: c.tint }]}>Add field</Text>
              </Pressable>
            </View>

            <View style={[styles.group, { backgroundColor: c.card, borderColor: c.border }]}>
              {fields.length === 0 ? (
                <Text style={{ color: c.textMuted, padding: 16, textAlign: 'center' }}>
                  No fields yet. Tap “Add field” to choose what shows on scan.
                </Text>
              ) : (
                fields.map((f, i) => (
                  <View key={f.field_id}>
                    {i > 0 ? <Divider c={c} inset={54} /> : null}
                    <View style={styles.fieldRow}>
                      <View style={[styles.handle, { backgroundColor: c.background }]}>
                        <Pressable onPress={() => move(i, -1)} disabled={i === 0} hitSlop={8} style={styles.handleBtn}>
                          <Ionicons name="chevron-up" size={15} color={i === 0 ? c.border : c.textMuted} />
                        </Pressable>
                        <Pressable onPress={() => move(i, 1)} disabled={i === fields.length - 1} hitSlop={8} style={styles.handleBtn}>
                          <Ionicons name="chevron-down" size={15} color={i === fields.length - 1 ? c.border : c.textMuted} />
                        </Pressable>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.fLabel, { color: f.show ? c.text : c.textMuted }]} numberOfLines={1}>
                          {f.label}
                        </Text>
                        <Text style={[styles.fName, { color: c.textMuted }]} numberOfLines={1}>{f.name}</Text>
                      </View>
                      <Switch value={f.show} onValueChange={(v) => setFieldShow(f.field_id, v)} trackColor={{ true: Brand.indigo }} />
                      <Pressable onPress={() => removeField(f.field_id)} hitSlop={8} style={styles.trash}>
                        <Ionicons name="close" size={16} color={c.textMuted} />
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </View>

            {error ? <Text style={[styles.err, { color: Brand.rose }]}>{error}</Text> : null}
          </ScrollView>

          {/* Save bar */}
          <SafeAreaView edges={['bottom']} style={[styles.saveBar, { backgroundColor: c.card, borderTopColor: c.border }]}>
            <Pressable onPress={save} disabled={saving} style={[styles.saveBtn, { backgroundColor: saved ? Brand.emerald : Brand.indigo }]}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name={saved ? 'checkmark' : 'save-outline'} size={18} color="#fff" />
                  <Text style={styles.saveText}>{saved ? 'Saved' : 'Save'}</Text>
                </>
              )}
            </Pressable>
          </SafeAreaView>
        </>
      )}

      {/* Global-mode confirmation (works on all platforms, unlike Alert on web) */}
      <Modal visible={!!confirmAction} animationType="fade" transparent onRequestClose={() => setConfirmAction(null)}>
        <View style={styles.modalWrap}>
          <View style={[styles.confirmCard, { backgroundColor: c.background }]}>
            <View style={styles.confirmHead}>
              <Ionicons name="albums" size={22} color={Brand.amber} />
              <Text style={[styles.modalTitle, { color: c.text }]}>Global fields are on</Text>
            </View>
            <Text style={[styles.confirmBody, { color: c.textMuted }]}>
              Every product currently shows the same global fields. This product&apos;s own fields won&apos;t
              appear on scan until Global mode is turned off. Turn it on anyway?
            </Text>
            <View style={styles.confirmBtns}>
              <Pressable
                onPress={() => setConfirmAction(null)}
                style={[styles.confirmBtn, { borderColor: c.border }]}>
                <Text style={{ color: c.text, fontWeight: '800' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const fn = confirmAction;
                  setConfirmAction(null);
                  fn?.();
                }}
                style={[styles.confirmBtn, { backgroundColor: Brand.indigo, borderColor: Brand.indigo }]}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>Turn on anyway</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Field picker modal (centered popup) */}
      <Modal visible={pickerOpen} animationType="fade" transparent onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalWrap}>
          <View style={[styles.modalCard, { backgroundColor: c.background }]}>
            <View style={styles.modalHead}>
              <Text style={[styles.modalTitle, { color: c.text }]}>Add a field</Text>
              <Pressable onPress={() => setPickerOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color={c.text} />
              </Pressable>
            </View>
            <View style={[styles.search, { backgroundColor: c.card, borderColor: c.border }]}>
              <Ionicons name="search" size={18} color={c.textMuted} />
              <TextInput
                value={pickQuery}
                onChangeText={setPickQuery}
                placeholder="Search fields"
                placeholderTextColor={c.textMuted}
                style={[styles.searchInput, { color: c.text }]}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
            <FlatList
              data={available}
              keyExtractor={(f) => String(f.field_id)}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={{ color: c.textMuted, textAlign: 'center', padding: 24 }}>
                  {catalog.length === 0 ? 'No fields available.' : 'All fields already added.'}
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => { addField(item); setPickerOpen(false); }}
                  style={[styles.pickRow, { borderBottomColor: c.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fLabel, { color: c.text }]}>{item.label}</Text>
                    <Text style={[styles.fName, { color: c.textMuted }]}>
                      {item.name} · {item.ttype}
                    </Text>
                  </View>
                  <Ionicons name="add-circle" size={22} color={c.tint} />
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function Row({ c, children, dim }: { c: C; children: ReactNode; dim?: boolean }) {
  return <View style={[styles.row, dim && { opacity: 0.5 }]}>{children}</View>;
}
function RowText({ c, label, sub }: { c: C; label: string; sub?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.rowLabel, { color: c.text }]}>{label}</Text>
      {sub ? <Text style={[styles.rowSub, { color: c.textMuted }]}>{sub}</Text> : null}
    </View>
  );
}
function Divider({ c, inset = 14 }: { c: C; inset?: number }) {
  return <View style={[styles.divider, { backgroundColor: c.border, marginLeft: inset }]} />;
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 10 },
  iconBtn: { padding: 2 },
  h1: { flex: 1, fontSize: 22, fontWeight: '900' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  retry: { marginTop: 14, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  pCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: Radius.lg, borderWidth: 1 },
  pImg: { width: 64, height: 64, borderRadius: 12, backgroundColor: '#f4f5f7' },
  pImgEmpty: { alignItems: 'center', justifyContent: 'center' },
  pName: { fontSize: 17, fontWeight: '800' },
  pMeta: { fontSize: 13, marginTop: 3 },
  globalNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: 12,
  },
  globalNoteText: { flex: 1, fontSize: 12.5, fontWeight: '600', lineHeight: 17 },
  confirmCard: { width: '100%', maxWidth: 400, borderRadius: 22, padding: 18 },
  confirmHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  confirmBody: { fontSize: 14, lineHeight: 20 },
  confirmBtns: { flexDirection: 'row', gap: 10, marginTop: 18 },
  confirmBtn: {
    flex: 1,
    height: 46,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  group: { borderRadius: Radius.md, borderWidth: 1, marginTop: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  rowLabel: { fontSize: 15, fontWeight: '700' },
  rowSub: { fontSize: 12, marginTop: 2 },
  divider: { height: 1, marginLeft: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 6, marginLeft: 4 },
  sectionLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  addBtnText: { fontSize: 13, fontWeight: '800' },
  fieldRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 12 },
  handle: { width: 30, borderRadius: 9, paddingVertical: 3, alignItems: 'center' },
  handleBtn: { paddingVertical: 1 },
  fLabel: { fontSize: 15.5, fontWeight: '800' },
  fName: { fontSize: 11.5, marginTop: 2, textTransform: 'lowercase' },
  trash: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  err: { marginTop: 16, textAlign: 'center', fontWeight: '600' },
  saveBar: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 10 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: Radius.md },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  // modal (centered popup)
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 440, maxHeight: '80%', borderRadius: 22, padding: 16 },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '900' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 44, borderRadius: Radius.md, borderWidth: 1, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 15 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
});
