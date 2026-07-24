import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ComponentProps, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientButton } from '@/components/gradient-button';
import { Brand, Colors, Radius, Shadow } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useThemePreference } from '@/context/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { authenticate, listDatabases } from '@/services/odoo';

export default function LoginScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const { signIn } = useAuth();
  const { setPref } = useThemePreference();
  const toggleTheme = () => setPref(scheme === 'dark' ? 'light' : 'dark');

  const [baseUrl, setBaseUrl] = useState('');
  const [db, setDb] = useState('');
  const [dbs, setDbs] = useState<string[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState('');
  const [dbModalVisible, setDbModalVisible] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Debounced database discovery as the user types the server URL. A `cancelled`
  // flag makes sure a superseded (slow, out-of-order) response can't overwrite a
  // newer result and hide the dropdown — the "sometimes not showing" bug.
  useEffect(() => {
    const u = baseUrl.trim();
    if (u.length < 4) {
      setDbs([]);
      setDbError('');
      setDbLoading(false);
      return;
    }
    let cancelled = false;
    setDbLoading(true);
    setDbError('');
    const t = setTimeout(async () => {
      try {
        const list = await listDatabases(u);
        if (cancelled) return;
        setDbs(list);
        if (list.length === 0) {
          setDbError('No databases found on this server. Check the URL.');
        } else if (list.length === 1) {
          setDb(list[0]);
        }
      } catch (e: any) {
        if (cancelled) return;
        setDbs([]);
        setDbError(e?.message || 'Cannot reach the server. Check the URL and your network.');
      } finally {
        if (!cancelled) setDbLoading(false);
      }
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [baseUrl]);

  const onSubmit = async () => {
    setError('');
    if (!baseUrl.trim() || !db.trim() || !username.trim() || !password) {
      setError('Please fill in the server, database, username and password.');
      return;
    }
    setLoading(true);
    try {
      const user = await authenticate(baseUrl, db.trim(), username.trim(), password);
      await signIn(user);
      router.replace('/');
    } catch (e: any) {
      setError(e?.message || 'Login failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  const inputBg = scheme === 'dark' ? '#0f0f18' : '#f4f5f7';

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
          {/* Top row: theme toggle */}
          <View style={styles.topRow}>
            <Pressable
              onPress={toggleTheme}
              hitSlop={8}
              style={[styles.themeToggle, { backgroundColor: c.card, borderColor: c.border }]}
              accessibilityRole="button"
              accessibilityLabel={scheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              <Ionicons name={scheme === 'dark' ? 'sunny-outline' : 'moon-outline'} size={20} color={c.tint} />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}>
            {/* Brand mark — logo on a white chip so it reads in both themes */}
            <View style={[styles.logoChip, Shadow.card]}>
              <Image
                source={require('../assets/images/logo-369-ad.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            <Text style={[styles.h1, { color: c.text }]}>Welcome back</Text>
            <Text style={[styles.h2, { color: c.textMuted }]}>Sign in to your account</Text>

            {/* Card */}
            <View style={[styles.card, Shadow.soft, { backgroundColor: c.card, borderColor: c.border }]}>
              <Field
                c={c}
                inputBg={inputBg}
                icon="server-outline"
                label="Server URL"
                value={baseUrl}
                onChangeText={setBaseUrl}
                placeholder="https://your-server.com"
                keyboardType="url"
                autoCapitalize="none"
              />

              {/* Database: dropdown when the server lists DBs, else manual entry */}
              {dbs.length > 0 ? (
                <View style={{ marginTop: 14 }}>
                  <Text style={[styles.label, { color: c.textMuted }]}>Database</Text>
                  <Pressable
                    onPress={() => setDbModalVisible(true)}
                    style={[styles.inputRow, { backgroundColor: inputBg, borderColor: c.border }]}>
                    <Ionicons name="server" size={18} color={c.textMuted} />
                    <Text style={[styles.input, { color: db ? c.text : c.textMuted }]} numberOfLines={1}>
                      {db || 'Select a database'}
                    </Text>
                    <View style={[styles.dbCount, { backgroundColor: scheme === 'dark' ? 'rgba(155,140,255,0.2)' : 'rgba(79,70,229,0.12)' }]}>
                      <Text style={[styles.dbCountText, { color: c.tint }]}>{dbs.length}</Text>
                    </View>
                    <Ionicons name="chevron-down" size={18} color={c.textMuted} />
                  </Pressable>
                </View>
              ) : (
                <Field
                  c={c}
                  inputBg={inputBg}
                  icon="server"
                  label="Database"
                  value={db}
                  onChangeText={setDb}
                  placeholder={dbLoading ? 'Loading databases…' : 'Database name'}
                  autoCapitalize="none"
                  loading={dbLoading}
                />
              )}

              {dbError && !dbLoading ? (
                <View style={styles.dbErrorRow}>
                  <Ionicons name="alert-circle" size={14} color={Brand.rose} />
                  <Text style={styles.dbErrorText}>{dbError}</Text>
                </View>
              ) : null}

              <Field
                c={c}
                inputBg={inputBg}
                icon="person-outline"
                label="Username or Email"
                value={username}
                onChangeText={setUsername}
                placeholder="you@example.com"
                autoCapitalize="none"
              />

              <Field
                c={c}
                inputBg={inputBg}
                icon="lock-closed-outline"
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry={!showPw}
                rightIcon={showPw ? 'eye-off-outline' : 'eye-outline'}
                onRightIconPress={() => setShowPw((s) => !s)}
              />

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color={Brand.rose} />
                  <Text style={[styles.errorText, { color: Brand.rose }]}>{error}</Text>
                </View>
              ) : null}

              <GradientButton
                label={loading ? 'Signing in…' : 'Sign in'}
                icon="log-in-outline"
                loading={loading}
                onPress={onSubmit}
                style={{ marginTop: 20 }}
              />
            </View>

            <Text style={[styles.powered, { color: c.textMuted }]}>Powered by 369ai · v1.0.0</Text>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>

      {/* Scrollable database picker */}
      <Modal
        visible={dbModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDbModalVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setDbModalVisible(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: c.card }]} onPress={() => {}}>
            <View style={styles.modalHead}>
              <Text style={[styles.modalTitle, { color: c.text }]}>Select database</Text>
              <Text style={[styles.modalSub, { color: c.textMuted }]}>{dbs.length} available</Text>
            </View>
            <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
              {dbs.map((name) => {
                const active = name === db;
                return (
                  <Pressable
                    key={name}
                    onPress={() => {
                      setDb(name);
                      setDbModalVisible(false);
                    }}
                    style={[styles.dbRow, { borderBottomColor: c.border }]}>
                    <Ionicons name="server-outline" size={18} color={active ? c.tint : c.textMuted} />
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 15,
                        fontWeight: active ? '800' : '500',
                        color: active ? c.tint : c.text,
                      }}
                      numberOfLines={1}>
                      {name}
                    </Text>
                    {active ? <Ionicons name="checkmark" size={18} color={c.tint} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Field({
  c,
  inputBg,
  icon,
  label,
  rightIcon,
  onRightIconPress,
  loading,
  ...input
}: {
  c: (typeof Colors)['light'];
  inputBg: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  loading?: boolean;
} & ComponentProps<typeof TextInput>) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={[styles.label, { color: c.textMuted }]}>{label}</Text>
      <View
        style={[
          styles.inputRow,
          { backgroundColor: inputBg, borderColor: focused ? c.tint : c.border },
          focused && { borderWidth: 1.5 },
        ]}>
        <Ionicons name={icon} size={18} color={focused ? c.tint : c.textMuted} />
        <TextInput
          placeholderTextColor={c.textMuted}
          style={[styles.input, { color: c.text }]}
          autoCorrect={false}
          {...input}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
        />
        {loading ? (
          <ActivityIndicator size="small" color={c.tint} />
        ) : rightIcon ? (
          <Pressable onPress={onRightIconPress} hitSlop={8}>
            <Ionicons name={rightIcon} size={18} color={c.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  themeToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  logoChip: {
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: Radius.lg,
    paddingHorizontal: 22,
    paddingVertical: 16,
    marginBottom: 26,
  },
  logo: { width: 210, height: 96 },
  h1: { fontSize: 28, fontWeight: '900', textAlign: 'center', letterSpacing: 0.2 },
  h2: { fontSize: 14, textAlign: 'center', marginTop: 6 },
  card: {
    marginTop: 26,
    borderRadius: Radius.xl,
    padding: 20,
    borderWidth: 1,
  },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6, letterSpacing: 0.2 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  input: { flex: 1, fontSize: 15 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    backgroundColor: 'rgba(244,63,94,0.1)',
    padding: 10,
    borderRadius: Radius.sm,
  },
  errorText: { fontSize: 13, flex: 1 },
  powered: { textAlign: 'center', fontSize: 12, marginTop: 22 },
  dbCount: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  dbCountText: { fontSize: 11, fontWeight: '800' },
  dbErrorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginLeft: 2 },
  dbErrorText: { color: Brand.rose, fontSize: 12.5, flex: 1, fontWeight: '600' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 28,
  },
  modalCard: { borderRadius: 18, overflow: 'hidden', paddingBottom: 6 },
  modalHead: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 8 },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  modalSub: { fontSize: 12, marginTop: 2 },
  dbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
});
