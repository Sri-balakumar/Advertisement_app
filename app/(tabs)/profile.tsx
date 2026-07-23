import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Colors, Radius, Shadow } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { ThemePref, useThemePreference } from '@/context/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const THEME_OPTS: { key: ThemePref; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { key: 'light', label: 'Light', icon: 'sunny-outline' },
  { key: 'dark', label: 'Dark', icon: 'moon-outline' },
];

type C = (typeof Colors)['light'];

export default function ProfileScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const { user, canManage, signOut } = useAuth();
  const { pref, setPref } = useThemePreference();

  const displayName = user?.name || user?.username || 'Guest';
  const subtitle = user ? `${user.username ?? user.name ?? ''} · ${user.odoo_db}` : 'Not signed in';
  const initials =
    displayName
      .split(' ')
      .map((w) => w.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U';

  const logout = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Header card */}
        <LinearGradient colors={Brand.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.head}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email}>{subtitle}</Text>
        </LinearGradient>

        {/* Appearance */}
        <Text style={[styles.sectionLabel, { color: c.textMuted }]}>APPEARANCE</Text>
        <View style={[styles.segment, { backgroundColor: c.card, borderColor: c.border }]}>
          {THEME_OPTS.map((o) => {
            const active = pref === o.key;
            return (
              <Pressable
                key={o.key}
                onPress={() => setPref(o.key)}
                style={[styles.segItem, active && { backgroundColor: c.tint }]}>
                <Ionicons name={o.icon} size={16} color={active ? '#fff' : c.textMuted} />
                <Text style={[styles.segText, { color: active ? '#fff' : c.text }]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Connection */}
        <Text style={[styles.sectionLabel, { color: c.textMuted }]}>CONNECTION</Text>
        <View style={[styles.group, Shadow.soft, { backgroundColor: c.card, borderColor: c.border }]}>
          <InfoRow c={c} icon="cube-outline" tint={Brand.violet} label="Database" value={user?.odoo_db || '—'} />
          <Divider c={c} />
          <InfoRow
            c={c}
            icon="shield-checkmark-outline"
            tint={canManage ? Brand.emerald : Brand.amber}
            label="Role"
            value={canManage ? 'Manager' : 'Staff'}
          />
        </View>

        {/* Actions — grouped settings-list */}
        <Text style={[styles.sectionLabel, { color: c.textMuted }]}>GENERAL</Text>
        <View style={[styles.group, Shadow.soft, { backgroundColor: c.card, borderColor: c.border }]}>
          {canManage ? (
            <>
              <SettingRow
                c={c}
                icon="grid-outline"
                tint={Brand.indigo}
                label="Manage"
                onPress={() => router.push('/(tabs)/manage')}
              />
              <Divider c={c} />
            </>
          ) : null}
          <SettingRow
            c={c}
            icon="play-circle-outline"
            tint={Brand.violet}
            label="Replay intro"
            onPress={() => router.push('/onboarding')}
          />
          <Divider c={c} />
          <SettingRow
            c={c}
            icon="log-out-outline"
            tint={Brand.rose}
            label="Log out"
            labelColor={Brand.rose}
            onPress={logout}
            hideChevron
          />
        </View>

        {/* About */}
        <Text style={[styles.sectionLabel, { color: c.textMuted }]}>ABOUT</Text>
        <View style={[styles.group, Shadow.soft, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={styles.about}>
            <Text style={[styles.aboutTitle, { color: c.text }]}>369 Advertisement</Text>
            <Text style={[styles.aboutText, { color: c.textMuted }]}>
              In-store signage display + barcode price-checker. Built by Alphalize.
            </Text>
          </View>
        </View>

        <Text style={[styles.version, { color: c.textMuted }]}>369 Advertisement · v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingRow({
  c,
  icon,
  tint,
  label,
  labelColor,
  onPress,
  hideChevron,
}: {
  c: C;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  label: string;
  labelColor?: string;
  onPress: () => void;
  hideChevron?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: tint + '1a' }]}>
        <Ionicons name={icon} size={19} color={tint} />
      </View>
      <Text style={[styles.rowLabel, { color: labelColor || c.text }]}>{label}</Text>
      {hideChevron ? null : <Ionicons name="chevron-forward" size={18} color={c.textMuted} />}
    </Pressable>
  );
}

function InfoRow({
  c,
  icon,
  tint,
  label,
  value,
}: {
  c: C;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: tint + '1a' }]}>
        <Ionicons name={icon} size={19} color={tint} />
      </View>
      <Text style={[styles.rowLabel, { color: c.text }]}>{label}</Text>
      <Text style={{ color: c.textMuted, fontWeight: '600', maxWidth: '55%' }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function Divider({ c }: { c: C }) {
  return <View style={[styles.divider, { backgroundColor: c.border }]} />;
}

const styles = StyleSheet.create({
  head: {
    margin: 20,
    borderRadius: Radius.xl,
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 26, fontWeight: '900' },
  name: { color: '#fff', fontSize: 21, fontWeight: '800', marginTop: 12 },
  email: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 },
  sectionLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: 18, marginBottom: 8, marginLeft: 24 },
  segment: {
    flexDirection: 'row',
    marginHorizontal: 20,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  segItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.sm,
  },
  segText: { fontSize: 13.5, fontWeight: '700' },
  group: { marginHorizontal: 20, borderRadius: Radius.md, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  rowIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 15.5, fontWeight: '700' },
  divider: { height: 1, marginLeft: 62 },
  about: { padding: 16 },
  aboutTitle: { fontSize: 15.5, fontWeight: '800' },
  aboutText: { fontSize: 13, marginTop: 5, lineHeight: 19 },
  version: { textAlign: 'center', fontSize: 12, marginTop: 24 },
});
