import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { AppContact, AppSettings, getAppSettings, saveAppSettings } from '@/services/odoo';
import { Brand, Colors, Radius, Shadow } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function SupportScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const { user, canManage } = useAuth();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [emails, setEmails] = useState<AppContact[]>([]);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.base_url) {
        setLoading(false);
        return;
      }
      try {
        const s = await getAppSettings(user.base_url);
        if (!alive) return;
        setSettings(s);
        setEmails(s.emails.length ? s.emails : [{ label: '', email: '' }]);
        setPhone(s.phone);
      } catch (e: any) {
        if (alive) setErr(e?.message || 'Could not load contacts.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.base_url]);

  useEffect(() => {
    if (!ok) return;
    const t = setTimeout(() => setOk(false), 2500);
    return () => clearTimeout(t);
  }, [ok]);

  const setField = (i: number, key: keyof AppContact, val: string) =>
    setEmails((prev) => prev.map((e, idx) => (idx === i ? { ...e, [key]: val } : e)));
  const addEmail = () => setEmails((prev) => [...prev, { label: '', email: '' }]);
  const removeEmail = (i: number) => setEmails((prev) => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!user?.base_url || !settings) return;
    const clean = emails.filter((e) => e.label.trim() || e.email.trim());
    setSaving(true);
    setErr('');
    setOk(false);
    try {
      await saveAppSettings(user.base_url, { ...settings, phone, emails: clean });
      setSettings({ ...settings, phone, emails: clean });
      setEmails(clean.length ? clean : [{ label: '', email: '' }]);
      setOk(true);
    } catch (e: any) {
      setErr(e?.message || 'Could not save contacts.');
    } finally {
      setSaving(false);
    }
  };

  const openMail = (e: string) => e && Linking.openURL(`mailto:${e}`);
  const openTel = (p: string) => p && Linking.openURL(`tel:${p.replace(/\s+/g, '')}`);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader
        title="Help & Support"
        right={
          canManage ? (
            <Pressable onPress={save} disabled={saving} hitSlop={8}>
              <Text style={[styles.saveAction, { color: c.tint, opacity: saving ? 0.5 : 1 }]}>
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
          ) : undefined
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled">
        {loading ? (
          <ActivityIndicator color={c.tint} style={{ marginTop: 40 }} />
        ) : (
          <>
            <Text style={[styles.sectionLabel, { color: c.textMuted }]}>CONTACT EMAILS</Text>

            {canManage ? (
              <>
                {emails.map((e, i) => (
                  <View
                    key={i}
                    style={[styles.editCard, Shadow.soft, { backgroundColor: c.card, borderColor: c.border }]}>
                    <View style={styles.editHead}>
                      <Text style={[styles.editIndex, { color: c.textMuted }]}>Contact {i + 1}</Text>
                      {emails.length > 1 ? (
                        <Pressable onPress={() => removeEmail(i)} hitSlop={8}>
                          <Ionicons name="trash-outline" size={18} color={Brand.rose} />
                        </Pressable>
                      ) : null}
                    </View>
                    <TextInput
                      value={e.label}
                      onChangeText={(v) => setField(i, 'label', v)}
                      placeholder="Label (e.g. HR, Sales)"
                      placeholderTextColor={c.textMuted}
                      style={[styles.input, { color: c.text, borderColor: c.border }]}
                    />
                    <TextInput
                      value={e.email}
                      onChangeText={(v) => setField(i, 'email', v)}
                      placeholder="name@alphalize.com"
                      placeholderTextColor={c.textMuted}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      style={[styles.input, { color: c.text, borderColor: c.border, marginTop: 8 }]}
                    />
                  </View>
                ))}
                <Pressable onPress={addEmail} style={[styles.addBtn, { borderColor: c.tint }]}>
                  <Ionicons name="add" size={18} color={c.tint} />
                  <Text style={[styles.addText, { color: c.tint }]}>Add email</Text>
                </Pressable>
              </>
            ) : (
              <View style={[styles.card, Shadow.soft, { backgroundColor: c.card, borderColor: c.border }]}>
                {emails.filter((e) => e.email || e.label).length === 0 ? (
                  <Text style={{ color: c.textMuted, padding: 4 }}>No contacts yet.</Text>
                ) : (
                  emails
                    .filter((e) => e.email || e.label)
                    .map((e, i, arr) => (
                      <Pressable
                        key={i}
                        onPress={() => openMail(e.email)}
                        style={[styles.row, i < arr.length - 1 && { borderBottomColor: c.border, borderBottomWidth: 1 }]}>
                        <View style={[styles.iconWrap, { backgroundColor: scheme === 'dark' ? '#20202b' : '#eef0ff' }]}>
                          <Ionicons name="mail-outline" size={18} color={c.tint} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.rowLabel, { color: c.text }]}>{e.label || 'Contact'}</Text>
                          <Text style={[styles.rowSub, { color: c.textMuted }]}>{e.email}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
                      </Pressable>
                    ))
                )}
              </View>
            )}

            <Text style={[styles.sectionLabel, { color: c.textMuted, marginTop: 22 }]}>PHONE</Text>
            {canManage ? (
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="+91 70252 05503"
                placeholderTextColor={c.textMuted}
                keyboardType="phone-pad"
                style={[styles.input, styles.phoneInput, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
              />
            ) : (
              <Pressable
                onPress={() => openTel(phone)}
                style={[styles.card, styles.row, Shadow.soft, { backgroundColor: c.card, borderColor: c.border }]}>
                <View style={[styles.iconWrap, { backgroundColor: scheme === 'dark' ? '#20202b' : '#eef0ff' }]}>
                  <Ionicons name="call-outline" size={18} color={c.tint} />
                </View>
                <Text style={[styles.rowLabel, { flex: 1, color: c.text }]}>{phone || '—'}</Text>
                {phone ? <Ionicons name="chevron-forward" size={18} color={c.textMuted} /> : null}
              </Pressable>
            )}

            {canManage ? (
              <Text style={[styles.hint, { color: c.textMuted }]}>
                Add as many contacts as you need. Saved on the server for everyone.
              </Text>
            ) : null}

            {err ? <Text style={[styles.status, { color: Brand.rose }]}>{err}</Text> : null}
            {ok ? <Text style={[styles.status, { color: Brand.emerald }]}>Saved ✓</Text> : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  saveAction: { fontSize: 15, fontWeight: '800' },
  sectionLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  card: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  editCard: { borderRadius: Radius.lg, borderWidth: 1, padding: 14, marginBottom: 12 },
  editHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  editIndex: { fontSize: 12, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
  },
  phoneInput: { },
  addBtn: {
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addText: { fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 15, fontWeight: '700' },
  rowSub: { fontSize: 13, marginTop: 2 },
  hint: { fontSize: 12.5, marginTop: 14, lineHeight: 18 },
  status: { fontSize: 14, fontWeight: '700', marginTop: 16, textAlign: 'center' },
});
