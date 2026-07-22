import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Brand, Colors, Radius, Shadow } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppSettings, getAppSettings, saveAppSettings } from '@/services/odoo';

export default function AddressScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const { user, canManage } = useAuth();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [address, setAddress] = useState('');
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
        setAddress(s.address);
      } catch (e: any) {
        if (alive) setErr(e?.message || 'Could not load the address.');
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

  const save = async () => {
    if (!user?.base_url || !settings) return;
    setSaving(true);
    setErr('');
    setOk(false);
    try {
      await saveAppSettings(user.base_url, { ...settings, address });
      setSettings({ ...settings, address });
      setOk(true);
    } catch (e: any) {
      setErr(e?.message || 'Could not save the address.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader
        title="Address"
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
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled">
        {loading ? (
          <ActivityIndicator color={c.tint} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={[styles.card, Shadow.soft, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={styles.headRow}>
                <View style={[styles.iconWrap, { backgroundColor: scheme === 'dark' ? '#20202b' : '#eef0ff' }]}>
                  <Ionicons name="business-outline" size={19} color={c.tint} />
                </View>
                <Text style={[styles.cardTitle, { color: c.text }]}>Company address</Text>
              </View>

              {canManage ? (
                <TextInput
                  value={address}
                  onChangeText={setAddress}
                  multiline
                  placeholder="Company address"
                  placeholderTextColor={c.textMuted}
                  style={[styles.input, { color: c.text, borderColor: c.border }]}
                />
              ) : (
                <Text style={[styles.addressText, { color: c.text }]}>{address || '—'}</Text>
              )}
            </View>

            {canManage ? (
              <Text style={[styles.hint, { color: c.textMuted }]}>
                Only admins can edit. Changes are saved on the server and shown to everyone.
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
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: 16 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 12,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  addressText: { fontSize: 16, lineHeight: 26 },
  hint: { fontSize: 12.5, marginTop: 12, lineHeight: 18 },
  status: { fontSize: 14, fontWeight: '700', marginTop: 16, textAlign: 'center' },
});
