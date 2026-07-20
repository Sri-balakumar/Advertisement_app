import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Colors, Radius, Shadow } from '@/constants/theme';
import { useAuth } from '@/context/auth';

type Item = { icon: keyof typeof Ionicons.glyphMap; label: string };

const MENU: Item[] = [
  { icon: 'bag-handle-outline', label: 'My Orders' },
  { icon: 'heart-outline', label: 'Wishlist' },
  { icon: 'location-outline', label: 'Addresses' },
  { icon: 'card-outline', label: 'Payment Methods' },
  { icon: 'notifications-outline', label: 'Notifications' },
  { icon: 'help-circle-outline', label: 'Help & Support' },
  { icon: 'information-circle-outline', label: 'About 369' },
];

const STATS = [
  { label: 'Orders', value: '12' },
  { label: 'Wishlist', value: '8' },
  { label: 'Coupons', value: '5' },
];

export default function ProfileScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const { user, signOut } = useAuth();

  const displayName = user?.name || user?.username || 'Guest';
  const subtitle = user ? `${user.username ?? user.name ?? ''} · ${user.odoo_db}` : 'Not signed in';
  const initials =
    displayName
      .split(' ')
      .map((w) => w.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U';

  const replayIntro = () => router.push('/onboarding');

  const logout = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        {/* Header card */}
        <LinearGradient colors={Brand.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.head}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email}>{subtitle}</Text>

          <View style={styles.statsRow}>
            {STATS.map((s, i) => (
              <View key={s.label} style={styles.statItem}>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
                {i < STATS.length - 1 ? <View style={styles.statDivider} /> : null}
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* Menu */}
        <View style={[styles.menu, Shadow.soft, { backgroundColor: c.card, borderColor: c.border }]}>
          {MENU.map((m, i) => (
            <Pressable
              key={m.label}
              style={[styles.row, i < MENU.length - 1 && { borderBottomColor: c.border, borderBottomWidth: 1 }]}>
              <View style={[styles.rowIcon, { backgroundColor: scheme === 'dark' ? '#20202b' : '#eef0ff' }]}>
                <Ionicons name={m.icon} size={19} color={c.tint} />
              </View>
              <Text style={[styles.rowLabel, { color: c.text }]}>{m.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
            </Pressable>
          ))}
        </View>

        <Pressable onPress={replayIntro} style={[styles.ghost, { borderColor: c.border }]}>
          <Ionicons name="play-circle-outline" size={18} color={c.tint} />
          <Text style={[styles.ghostText, { color: c.tint }]}>Replay intro</Text>
        </Pressable>

        <Pressable onPress={logout} style={[styles.ghost, { borderColor: c.border }]}>
          <Ionicons name="log-out-outline" size={18} color={Brand.rose} />
          <Text style={[styles.ghostText, { color: Brand.rose }]}>Log out</Text>
        </Pressable>

        <Text style={[styles.version, { color: c.textMuted }]}>369 Advertisement · v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
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
  statsRow: {
    flexDirection: 'row',
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: Radius.lg,
    paddingVertical: 12,
    alignSelf: 'stretch',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 18, fontWeight: '900' },
  statLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  statDivider: {
    position: 'absolute',
    right: 0,
    top: 6,
    bottom: 6,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  menu: {
    marginHorizontal: 20,
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  ghost: {
    marginHorizontal: 20,
    marginTop: 14,
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ghostText: { fontSize: 15, fontWeight: '700' },
  version: { textAlign: 'center', fontSize: 12, marginTop: 20 },
});
