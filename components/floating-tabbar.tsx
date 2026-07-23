import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTabBar } from '@/context/tabbar';
import { useColorScheme } from '@/hooks/use-color-scheme';

const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  index: ['home', 'home-outline'],
  manage: ['grid', 'grid-outline'],
  profile: ['person', 'person-outline'],
};
const LABELS: Record<string, string> = { index: 'Home', manage: 'Manage', profile: 'Profile' };

/**
 * A content-width floating tab bar: the blue-gradient pill wraps tightly around
 * the tab items (no full-width stretch), centred and lifted off the bottom.
 */
export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { hidden } = useTabBar();
  const { canManage } = useAuth();

  if (hidden) return null;
  const dark = scheme === 'dark';
  const bottom = insets.bottom > 0 ? insets.bottom : 10;
  // Dark mode: lift the pill surface + brighten the items so they're clearly
  // visible against the near-black background.
  const surface = dark ? '#2a2a3d' : c.tabBar;
  const activeColor = dark ? '#c4b5fd' : c.tabIconSelected;
  const inactiveColor = dark ? '#b6b9c6' : c.tabIconDefault;
  const activeKey = state.routes[state.index]?.key;
  const routes = state.routes.filter((r) => r.name !== 'manage' || canManage);

  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      <LinearGradient
        colors={['#2563eb', '#22d3ee']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.grad}>
        <View style={[styles.bar, { backgroundColor: surface }]}>
          {routes.map((route) => {
            const focused = route.key === activeKey;
            const color = focused ? activeColor : inactiveColor;
            const icon = ICONS[route.name] ?? ['ellipse', 'ellipse-outline'];
            const onPress = () => {
              Haptics.selectionAsync().catch(() => {});
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            };
            return (
              <Pressable key={route.key} onPress={onPress} style={styles.item} hitSlop={6}>
                <Ionicons name={focused ? icon[0] : icon[1]} size={22} color={color} />
                <Text style={[styles.label, { color }]}>{LABELS[route.name] ?? route.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  grad: {
    borderRadius: 30,
    padding: 2,
    shadowColor: '#2563eb',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },
  bar: {
    flexDirection: 'row',
    borderRadius: 28,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  item: { alignItems: 'center', gap: 3, paddingHorizontal: 18, paddingVertical: 2 },
  label: { fontSize: 11, fontWeight: '700' },
});
