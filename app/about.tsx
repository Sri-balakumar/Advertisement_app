import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { AppSettings, getAppSettings, saveAppSettings } from '@/services/odoo';
import { Brand, Colors, Radius } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function AboutScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const { user, canManage } = useAuth();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
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
        setTitle(s.about_title);
        setBody(s.about_body);
      } catch (e: any) {
        if (alive) setErr(e?.message || 'Could not load About.');
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
      await saveAppSettings(user.base_url, { ...settings, about_title: title, about_body: body });
      setSettings({ ...settings, about_title: title, about_body: body });
      setOk(true);
    } catch (e: any) {
      setErr(e?.message || 'Could not save About.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader
        title="About 369"
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
        contentContainerStyle={{ padding: 20, paddingBottom: 44 }}
        keyboardShouldPersistTaps="handled">
        {loading ? (
          <ActivityIndicator color={c.tint} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.logoWrap}>
              <Image
                source={require('../assets/images/logo-369-ad.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            {canManage ? (
              <>
                <Text style={[styles.fieldLabel, { color: c.textMuted }]}>HEADING</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Alphalize (369)"
                  placeholderTextColor={c.textMuted}
                  style={[styles.titleInput, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
                />
                <Text style={[styles.fieldLabel, { color: c.textMuted, marginTop: 16 }]}>ABOUT</Text>
                <TextInput
                  value={body}
                  onChangeText={setBody}
                  multiline
                  placeholder="Write about Alphalize (369)…"
                  placeholderTextColor={c.textMuted}
                  style={[styles.bodyInput, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
                />
                <Text style={[styles.hint, { color: c.textMuted }]}>
                  Only admins can edit. Saved on the server and shown to everyone.
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.heading, { color: c.text }]}>{title || 'Alphalize (369)'}</Text>
                <Text style={[styles.body, { color: c.text }]}>{body}</Text>
              </>
            )}

            {err ? <Text style={[styles.status, { color: Brand.rose }]}>{err}</Text> : null}
            {ok ? <Text style={[styles.status, { color: Brand.emerald }]}>Saved ✓</Text> : null}

            <Text style={[styles.version, { color: c.textMuted }]}>369 Advertisement · v1.0.0</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  saveAction: { fontSize: 15, fontWeight: '800' },
  logoWrap: { alignItems: 'center', marginBottom: 18 },
  logo: { width: 220, height: 103 },
  heading: { fontSize: 24, fontWeight: '900', marginBottom: 14, letterSpacing: 0.2 },
  body: { fontSize: 15.5, lineHeight: 26 },
  fieldLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  titleInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    fontWeight: '700',
  },
  bodyInput: {
    minHeight: 220,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 12,
    fontSize: 15,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  hint: { fontSize: 12.5, marginTop: 12, lineHeight: 18 },
  status: { fontSize: 14, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  version: { textAlign: 'center', fontSize: 12, marginTop: 28 },
});
