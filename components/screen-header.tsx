import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Shared back-header for the routed Profile sub-screens (Address / Support /
 * About). `right` is an optional action slot (e.g. a Save button for admins).
 */
export function ScreenHeader({ title, right }: { title: string; right?: ReactNode }) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  return (
    <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.background }]}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.side}>
        <Ionicons name="chevron-back" size={26} color={c.text} />
      </Pressable>
      <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, styles.rightSide]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  side: { minWidth: 44, height: 40, alignItems: 'center', justifyContent: 'center' },
  rightSide: { alignItems: 'flex-end', paddingRight: 6 },
  title: { flex: 1, fontSize: 18, fontWeight: '800', textAlign: 'center' },
});
