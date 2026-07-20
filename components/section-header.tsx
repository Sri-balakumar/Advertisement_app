import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export function SectionHeader({
  title,
  actionLabel = 'See all',
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const c = Colors[useColorScheme() ?? 'light'];
  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      {onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={[styles.action, { color: c.tint }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: { fontSize: 19, fontWeight: '800', letterSpacing: 0.2 },
  action: { fontSize: 14, fontWeight: '600' },
});
