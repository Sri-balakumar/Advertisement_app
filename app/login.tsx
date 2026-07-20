import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ComponentProps, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientButton } from '@/components/gradient-button';
import { Brand, Colors, Radius, Shadow } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { authenticate, listDatabases } from '@/services/odoo';

export default function LoginScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const { signIn } = useAuth();

  const [baseUrl, setBaseUrl] = useState('');
  const [db, setDb] = useState('');
  const [dbs, setDbs] = useState<string[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Debounced database discovery as the user types the server URL.
  useEffect(() => {
    const u = baseUrl.trim();
    if (u.length < 4) {
      setDbs([]);
      return;
    }
    setDbLoading(true);
    const t = setTimeout(async () => {
      try {
        const list = await listDatabases(u);
        setDbs(list);
        if (list.length === 1) setDb(list[0]);
      } catch {
        setDbs([]);
      } finally {
        setDbLoading(false);
      }
    }, 700);
    return () => clearTimeout(t);
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

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}>
          {/* Gradient header */}
          <LinearGradient colors={Brand.splash} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
            <SafeAreaView edges={['top']}>
              <View style={styles.brandBadge}>
                <Text style={styles.brandBadgeText}>369</Text>
              </View>
              <Text style={styles.h1}>Welcome back</Text>
              <Text style={styles.h2}>Sign in to your Odoo account</Text>
            </SafeAreaView>
          </LinearGradient>

          {/* Card */}
          <View style={[styles.card, Shadow.card, { backgroundColor: c.card }]}>
            <Field
              c={c}
              icon="server-outline"
              label="Server URL"
              value={baseUrl}
              onChangeText={setBaseUrl}
              placeholder="https://your-server.com"
              keyboardType="url"
              autoCapitalize="none"
            />

            <Field
              c={c}
              icon="server"
              label="Database"
              value={db}
              onChangeText={setDb}
              placeholder={dbLoading ? 'Loading databases…' : 'Database name'}
              autoCapitalize="none"
            />
            {dbs.length > 0 ? (
              <View style={styles.chips}>
                {dbs.map((name) => {
                  const active = name === db;
                  return (
                    <Pressable
                      key={name}
                      onPress={() => setDb(name)}
                      style={[
                        styles.chip,
                        { borderColor: active ? c.tint : c.border, backgroundColor: active ? c.tint : 'transparent' },
                      ]}>
                      <Text style={{ color: active ? '#fff' : c.textMuted, fontSize: 12, fontWeight: '700' }}>
                        {name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <Field
              c={c}
              icon="person-outline"
              label="Username or Email"
              value={username}
              onChangeText={setUsername}
              placeholder="you@example.com"
              autoCapitalize="none"
            />

            <Field
              c={c}
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
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <GradientButton
              label={loading ? 'Signing in…' : 'Sign in'}
              icon="log-in-outline"
              loading={loading}
              onPress={onSubmit}
              style={{ marginTop: 18 }}
            />

            <Text style={[styles.powered, { color: c.textMuted }]}>Powered by 369ai · v1.0.0</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({
  c,
  icon,
  label,
  rightIcon,
  onRightIconPress,
  ...input
}: {
  c: (typeof Colors)['light'];
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
} & ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={[styles.label, { color: c.textMuted }]}>{label}</Text>
      <View style={[styles.inputRow, { backgroundColor: c.background, borderColor: c.border }]}>
        <Ionicons name={icon} size={18} color={c.textMuted} />
        <TextInput
          placeholderTextColor={c.textMuted}
          style={[styles.input, { color: c.text }]}
          autoCorrect={false}
          {...input}
        />
        {rightIcon ? (
          <Pressable onPress={onRightIconPress} hitSlop={8}>
            <Ionicons name={rightIcon} size={18} color={c.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  brandBadge: {
    width: 66,
    height: 66,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  brandBadgeText: { color: '#fff', fontSize: 26, fontWeight: '900' },
  h1: { color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 18 },
  h2: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 4 },
  card: {
    marginHorizontal: 18,
    marginTop: -22,
    borderRadius: Radius.xl,
    padding: 20,
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    backgroundColor: 'rgba(244,63,94,0.1)',
    padding: 10,
    borderRadius: Radius.sm,
  },
  errorText: { color: '#e11d48', fontSize: 13, flex: 1 },
  powered: { textAlign: 'center', fontSize: 12, marginTop: 18 },
});
