import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Header, Loading, Screen, useC } from '@/components/ui';
import { Brand, Colors, Radius } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import {
  createProduct,
  CustomField,
  deleteProduct,
  getCategories,
  getProductBasics,
  getRelationRecords,
  getUoms,
  ProductCategory,
  ProductInput,
  ProductUom,
  saveProductBasics,
} from '@/services/odoo';

type C = (typeof Colors)['light'];

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'itf14', 'codabar', 'qr'] as const;

export default function ProductFormScreen() {
  const c = useC();
  const router = useRouter();
  const { user } = useAuth();
  const base = user?.base_url || '';
  const params = useLocalSearchParams<{ id?: string }>();
  const editing = !!params.id;
  const tmplId = Number(params.id || 0);

  const [loading, setLoading] = useState(editing);
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [description, setDescription] = useState('');
  const [categId, setCategId] = useState<number | null>(null);
  const [categName, setCategName] = useState('');
  const [internalRef, setInternalRef] = useState('');
  const [uomId, setUomId] = useState<number | null>(null);
  const [uomName, setUomName] = useState('');
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageB64, setImageB64] = useState<string | null>(null);

  const [cats, setCats] = useState<ProductCategory[]>([]);
  const [catOpen, setCatOpen] = useState(false);
  const [catQuery, setCatQuery] = useState('');
  const [uoms, setUoms] = useState<ProductUom[]>([]);
  const [uomOpen, setUomOpen] = useState(false);
  const [uomQuery, setUomQuery] = useState('');
  // Dynamic custom-field pickers (selection / many2one / date)
  const [custPick, setCustPick] = useState<CustomField | null>(null);
  const [custPickList, setCustPickList] = useState<{ id: string; name: string }[]>([]);
  const [custPickQuery, setCustPickQuery] = useState('');
  const [datePick, setDatePick] = useState<CustomField | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!base) return;
    getCategories(base).then(setCats).catch(() => {});
    getUoms(base).then(setUoms).catch(() => {});
    if (!editing) return;
    try {
      const p = await getProductBasics(base, tmplId);
      setName(p.name);
      setBarcode(p.barcode);
      setPrice(p.list_price ? String(p.list_price) : '');
      setCost(p.standard_price ? String(p.standard_price) : '');
      setDescription(p.description_sale);
      setCategId(p.categ_id || null);
      setCategName(p.categ_name);
      setInternalRef(p.default_code);
      setUomId(p.uom_id || null);
      setUomName(p.uom_name);
      setCustomFields(p.custom_fields);
      setImageUri(p.image || null);
    } catch (e: any) {
      setError(e?.message || 'Could not load the product.');
    } finally {
      setLoading(false);
    }
  }, [base, editing, tmplId]);

  useEffect(() => {
    load();
  }, [load]);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to choose a product image.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (res.canceled) return;
    const a = res.assets[0];
    setImageB64(a.base64 || null);
    setImageUri(a.uri);
  };

  const openScan = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Camera permission needed', 'Enable camera access to scan a barcode.');
        return;
      }
    }
    setScanOpen(true);
  };
  const onScan = ({ data }: { data: string }) => {
    setBarcode(String(data || '').trim());
    setScanOpen(false);
  };

  const save = async () => {
    if (!name.trim()) {
      setError('Please enter a product name.');
      return;
    }
    setSaving(true);
    setError('');
    const payload: ProductInput = { name: name.trim(), barcode: barcode.trim() };
    if (price.trim()) payload.list_price = Number(price) || 0;
    if (cost.trim()) payload.standard_price = Number(cost) || 0;
    if (categId) payload.categ_id = categId;
    if (uomId) payload.uom_id = uomId;
    payload.default_code = internalRef.trim();
    payload.description_sale = description.trim();
    if (imageB64) payload.image = imageB64;
    if (customFields.length) {
      const custom: Record<string, string | number | boolean> = {};
      customFields.forEach((f) => {
        custom[f.name] = f.value;
      });
      payload.custom = custom;
    }
    try {
      if (editing) await saveProductBasics(base, tmplId, payload);
      else await createProduct(base, payload);
      router.back();
    } catch (e: any) {
      setError(e?.message || 'Could not save the product.');
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    Alert.alert('Delete product', `Delete “${name || 'this product'}”? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          setError('');
          try {
            await deleteProduct(base, tmplId);
            router.back();
          } catch (e: any) {
            setError(e?.message || 'Could not delete the product.');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const setCF = (nameKey: string, patch: Partial<CustomField>) =>
    setCustomFields((prev) => prev.map((x) => (x.name === nameKey ? { ...x, ...patch } : x)));

  const openCustPicker = (field: CustomField) => {
    setCustPickQuery('');
    setCustPickList(
      field.ttype === 'selection' ? (field.options || []).map(([k, lbl]) => ({ id: k, name: lbl })) : [],
    );
    setCustPick(field);
  };

  useEffect(() => {
    if (!custPick || custPick.ttype !== 'many2one' || !custPick.relation) return;
    let alive = true;
    getRelationRecords(base, custPick.relation, custPickQuery)
      .then((recs) => alive && setCustPickList(recs.map((r) => ({ id: String(r.id), name: r.name }))))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [custPick, custPickQuery, base]);

  const selectCust = (item: { id: string; name: string }) => {
    if (!custPick) return;
    if (custPick.ttype === 'many2one') setCF(custPick.name, { value: Number(item.id), value_label: item.name });
    else setCF(custPick.name, { value: item.id });
    setCustPick(null);
  };

  const catList = cats.filter((k) => k.name.toLowerCase().includes(catQuery.toLowerCase()));

  if (loading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header
        title={editing ? 'Edit product' : 'New product'}
        onBack={() => router.back()}
        gradient={['#2563eb', '#22d3ee']}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          {/* Image */}
          <Pressable onPress={pickImage} style={styles.imagePicker}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.productImage} resizeMode="cover" />
            ) : (
              <View style={[styles.imagePlaceholder, { backgroundColor: c.card, borderColor: c.border }]}>
                <Ionicons name="camera-outline" size={30} color={c.textMuted} />
                <Text style={[styles.imagePlaceholderText, { color: c.textMuted }]}>Add Image</Text>
              </View>
            )}
          </Pressable>

          {/* Form card */}
          <View style={[styles.formCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Field c={c} label="Product Name *" value={name} onChangeText={setName} placeholder="Enter product name" />

            <PickerField
              c={c}
              label="Category"
              value={categName}
              placeholder="Select a category"
              onPress={() => { setCatQuery(''); setCatOpen(true); }}
            />

            <Field c={c} label="Sales Price" value={price} onChangeText={setPrice} placeholder="0.00" keyboardType="decimal-pad" />
            <Field c={c} label="Cost" value={cost} onChangeText={setCost} placeholder="0.00" keyboardType="decimal-pad" />

            <PickerField
              c={c}
              label="Unit of Measure"
              value={uomName}
              placeholder="Select unit"
              onPress={() => { setUomQuery(''); setUomOpen(true); }}
            />

            <Field
              c={c}
              label="Barcode"
              value={barcode}
              onChangeText={setBarcode}
              placeholder="Scan or type"
              onScanPress={openScan}
            />

            <Field c={c} label="Internal Reference" value={internalRef} onChangeText={setInternalRef} placeholder="e.g. PROD-001" />

            <Field
              c={c}
              label="Sales Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Shown on scan if enabled"
              multiline
              last
            />
          </View>

          {/* Dynamic custom fields — anything extra added to products in Odoo */}
          {customFields.length ? (
            <>
              <Text style={[styles.sectionTitle, { color: c.textMuted }]}>ADDITIONAL DETAILS</Text>
              <View style={[styles.formCard, { backgroundColor: c.card, borderColor: c.border }]}>
                {customFields.map((f, i) => (
                  <CustomFieldRow
                    key={f.name}
                    c={c}
                    field={f}
                    last={i === customFields.length - 1}
                    onChange={(v) =>
                      setCustomFields((prev) => prev.map((x) => (x.name === f.name ? { ...x, value: v } : x)))
                    }
                    onPick={openCustPicker}
                    onDate={setDatePick}
                  />
                ))}
              </View>
            </>
          ) : null}

          {error ? <Text style={[styles.err, { color: Brand.rose }]}>{error}</Text> : null}

          <Pressable onPress={save} disabled={saving} style={[styles.saveBtn, { backgroundColor: Brand.indigo }, saving && { opacity: 0.6 }]}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.saveBtnText}>{editing ? 'Save Changes' : 'Create Product'}</Text>
              </>
            )}
          </Pressable>

          {editing ? (
            <Pressable
              onPress={remove}
              disabled={deleting || saving}
              style={[styles.deleteBtn, { borderColor: Brand.rose }, deleting && { opacity: 0.6 }]}>
              {deleting ? (
                <ActivityIndicator color={Brand.rose} />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={18} color={Brand.rose} />
                  <Text style={[styles.deleteBtnText, { color: Brand.rose }]}>Delete Product</Text>
                </>
              )}
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Category picker */}
      <Modal visible={catOpen} animationType="fade" transparent onRequestClose={() => setCatOpen(false)}>
        <View style={styles.modalWrap}>
          <View style={[styles.modalCard, { backgroundColor: c.background }]}>
            <View style={styles.modalHead}>
              <Text style={[styles.modalTitle, { color: c.text }]}>Category</Text>
              <Pressable onPress={() => setCatOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color={c.text} />
              </Pressable>
            </View>
            <View style={[styles.search, { backgroundColor: c.card, borderColor: c.border }]}>
              <Ionicons name="search" size={18} color={c.textMuted} />
              <TextInput
                value={catQuery}
                onChangeText={setCatQuery}
                placeholder="Search categories"
                placeholderTextColor={c.textMuted}
                style={{ flex: 1, fontSize: 15, color: c.text }}
                autoCorrect={false}
              />
            </View>
            <FlatList
              data={catList}
              keyExtractor={(k) => String(k.id)}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={{ color: c.textMuted, textAlign: 'center', padding: 24 }}>No categories.</Text>}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => { setCategId(item.id); setCategName(item.name); setCatOpen(false); }}
                  style={[styles.catRow, { borderBottomColor: c.border }]}>
                  <Text style={{ color: c.text, fontSize: 15, flex: 1 }}>{item.name}</Text>
                  {categId === item.id ? <Ionicons name="checkmark" size={20} color={c.tint} /> : null}
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Unit of measure picker */}
      <Modal visible={uomOpen} animationType="fade" transparent onRequestClose={() => setUomOpen(false)}>
        <View style={styles.modalWrap}>
          <View style={[styles.modalCard, { backgroundColor: c.background }]}>
            <View style={styles.modalHead}>
              <Text style={[styles.modalTitle, { color: c.text }]}>Unit of measure</Text>
              <Pressable onPress={() => setUomOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color={c.text} />
              </Pressable>
            </View>
            <View style={[styles.search, { backgroundColor: c.card, borderColor: c.border }]}>
              <Ionicons name="search" size={18} color={c.textMuted} />
              <TextInput
                value={uomQuery}
                onChangeText={setUomQuery}
                placeholder="Search units"
                placeholderTextColor={c.textMuted}
                style={{ flex: 1, fontSize: 15, color: c.text }}
                autoCorrect={false}
              />
            </View>
            <FlatList
              data={uoms.filter((u) => u.name.toLowerCase().includes(uomQuery.toLowerCase()))}
              keyExtractor={(u) => String(u.id)}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={{ color: c.textMuted, textAlign: 'center', padding: 24 }}>No units.</Text>}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => { setUomId(item.id); setUomName(item.name); setUomOpen(false); }}
                  style={[styles.catRow, { borderBottomColor: c.border }]}>
                  <Text style={{ color: c.text, fontSize: 15, flex: 1 }}>{item.name}</Text>
                  {uomId === item.id ? <Ionicons name="checkmark" size={20} color={c.tint} /> : null}
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Custom field picker (selection / many2one) */}
      <Modal visible={!!custPick} animationType="fade" transparent onRequestClose={() => setCustPick(null)}>
        <View style={styles.modalWrap}>
          <View style={[styles.modalCard, { backgroundColor: c.background }]}>
            <View style={styles.modalHead}>
              <Text style={[styles.modalTitle, { color: c.text }]}>{custPick?.label}</Text>
              <Pressable onPress={() => setCustPick(null)} hitSlop={10}>
                <Ionicons name="close" size={24} color={c.text} />
              </Pressable>
            </View>
            <View style={[styles.search, { backgroundColor: c.card, borderColor: c.border }]}>
              <Ionicons name="search" size={18} color={c.textMuted} />
              <TextInput
                value={custPickQuery}
                onChangeText={setCustPickQuery}
                placeholder="Search"
                placeholderTextColor={c.textMuted}
                style={{ flex: 1, fontSize: 15, color: c.text }}
                autoCorrect={false}
              />
            </View>
            <FlatList
              data={
                custPick?.ttype === 'selection'
                  ? custPickList.filter((o) => o.name.toLowerCase().includes(custPickQuery.toLowerCase()))
                  : custPickList
              }
              keyExtractor={(o) => o.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={{ color: c.textMuted, textAlign: 'center', padding: 24 }}>No options.</Text>}
              renderItem={({ item }) => {
                const selected =
                  custPick?.ttype === 'many2one' ? Number(item.id) === custPick?.value : item.id === custPick?.value;
                return (
                  <Pressable onPress={() => selectCust(item)} style={[styles.catRow, { borderBottomColor: c.border }]}>
                    <Text style={{ color: c.text, fontSize: 15, flex: 1 }}>{item.name}</Text>
                    {selected ? <Ionicons name="checkmark" size={20} color={c.tint} /> : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Custom date field picker */}
      {datePick ? (
        <DateTimePicker
          value={datePick.value ? new Date(String(datePick.value)) : new Date()}
          mode="date"
          onChange={(e, d) => {
            const field = datePick;
            setDatePick(null);
            if (e.type === 'set' && d && field) {
              const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              setCF(field.name, { value: s });
            }
          }}
        />
      ) : null}

      {/* Barcode scan */}
      <Modal visible={scanOpen} transparent animationType="fade" onRequestClose={() => setScanOpen(false)}>
        <Pressable style={styles.scanWrap} onPress={() => setScanOpen(false)}>
          <View style={styles.scanCard}>
            {scanOpen ? (
              <CameraView
                style={StyleSheet.absoluteFill}
                onBarcodeScanned={onScan}
                barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
              />
            ) : null}
            <View style={styles.scanFrame} pointerEvents="none" />
            <Text style={styles.scanHint}>Point camera at the barcode</Text>
            <Pressable style={styles.scanClose} onPress={() => setScanOpen(false)} hitSlop={10}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function Field({
  c,
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  onScanPress,
  last,
}: {
  c: C;
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
  multiline?: boolean;
  onScanPress?: () => void;
  last?: boolean;
}) {
  const input = (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={c.textMuted}
      keyboardType={keyboardType || 'default'}
      multiline={!!multiline}
      autoCapitalize={label === 'Barcode' ? 'characters' : 'sentences'}
      autoCorrect={false}
      style={[
        styles.fieldInput,
        { backgroundColor: c.background, borderColor: c.border, color: c.text },
        multiline && styles.fieldMultiline,
        onScanPress && { flex: 1 },
      ]}
    />
  );
  return (
    <View style={[styles.fieldGroup, last && { marginBottom: 0 }]}>
      <Text style={[styles.fieldLabel, { color: c.textMuted }]}>{label}</Text>
      {onScanPress ? (
        <View style={styles.scanRow}>
          {input}
          <Pressable onPress={onScanPress} style={[styles.fieldScanBtn, { backgroundColor: Brand.indigo }]} hitSlop={8}>
            <Ionicons name="barcode-outline" size={20} color="#fff" />
          </Pressable>
        </View>
      ) : (
        input
      )}
    </View>
  );
}

function CustomFieldRow({
  c,
  field,
  onChange,
  onPick,
  onDate,
  last,
}: {
  c: C;
  field: CustomField;
  onChange: (v: string | number | boolean) => void;
  onPick: (f: CustomField) => void;
  onDate: (f: CustomField) => void;
  last?: boolean;
}) {
  if (field.ttype === 'boolean') {
    return (
      <View style={[styles.boolRow, last && { marginBottom: 0 }]}>
        <Text style={[styles.fieldLabel, { color: c.textMuted, marginBottom: 0, flex: 1 }]}>{field.label}</Text>
        <Switch value={!!field.value} onValueChange={onChange} trackColor={{ true: Brand.indigo }} />
      </View>
    );
  }
  if (field.ttype === 'selection' || field.ttype === 'many2one') {
    const display =
      field.ttype === 'many2one'
        ? field.value_label || ''
        : field.options?.find(([k]) => k === field.value)?.[1] || (field.value ? String(field.value) : '');
    return <PickerField c={c} label={field.label} value={display} placeholder="Select" onPress={() => onPick(field)} />;
  }
  if (field.ttype === 'date' || field.ttype === 'datetime') {
    return (
      <PickerField
        c={c}
        label={field.label}
        value={String(field.value || '').slice(0, 10)}
        placeholder="Select date"
        onPress={() => onDate(field)}
      />
    );
  }
  const numeric = field.ttype === 'float' || field.ttype === 'monetary' || field.ttype === 'integer';
  return (
    <Field
      c={c}
      label={field.label}
      value={String(field.value ?? '')}
      onChangeText={onChange}
      placeholder={field.label}
      keyboardType={numeric ? 'decimal-pad' : 'default'}
      multiline={field.ttype === 'text'}
      last={last}
    />
  );
}

function PickerField({
  c,
  label,
  value,
  placeholder,
  onPress,
}: {
  c: C;
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: c.textMuted }]}>{label}</Text>
      <Pressable onPress={onPress} style={[styles.pickerBtn, { backgroundColor: c.background, borderColor: c.border }]}>
        <Text style={{ flex: 1, fontSize: 15, color: value ? c.text : c.textMuted }} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color={c.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  formContent: { padding: 16, paddingBottom: 60 },
  imagePicker: { alignItems: 'center', marginVertical: 8 },
  productImage: { width: 132, height: 132, borderRadius: 16, backgroundColor: '#eee' },
  imagePlaceholder: {
    width: 132,
    height: 132,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: { fontSize: 12, marginTop: 4, fontWeight: '700' },
  formCard: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: 14, marginTop: 12 },
  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: 20, marginLeft: 4 },
  boolRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, marginBottom: 14 },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '800', marginBottom: 6, marginLeft: 2 },
  fieldInput: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 15,
  },
  fieldMultiline: { height: 84, paddingTop: 12, textAlignVertical: 'top' },
  scanRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fieldScanBtn: { width: 46, height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    height: 46,
  },
  err: { marginTop: 14, textAlign: 'center', fontWeight: '600' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: Radius.md,
    height: 54,
    marginTop: 20,
    shadowColor: '#4f46e5',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: Radius.md,
    height: 50,
    marginTop: 12,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  deleteBtnText: { fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  // category modal
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 440, maxHeight: '80%', borderRadius: 22, padding: 16 },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '900' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 44, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  catRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  // barcode scan modal
  scanWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  scanCard: { width: '86%', maxWidth: 360, aspectRatio: 1, borderRadius: 22, overflow: 'hidden', backgroundColor: '#000' },
  scanFrame: { position: 'absolute', left: '10%', right: '10%', top: '34%', bottom: '34%', borderWidth: 2.5, borderColor: '#FF9800', borderRadius: 12 },
  scanHint: { position: 'absolute', bottom: 14, left: 0, right: 0, textAlign: 'center', color: '#fff', fontWeight: '800', fontSize: 13 },
  scanClose: { position: 'absolute', top: 10, right: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
});
