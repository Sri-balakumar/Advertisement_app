import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, useColorScheme } from 'react-native';

import { Category } from '@/data/mock';
import { Colors } from '@/constants/theme';

export function CategoryPill({ category, onPress }: { category: Category; onPress?: () => void }) {
  const c = Colors[useColorScheme() ?? 'light'];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, { opacity: pressed ? 0.85 : 1 }]}>
      <LinearGradient
        colors={category.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.circle}>
        <Ionicons name={category.icon as keyof typeof Ionicons.glyphMap} size={24} color="#fff" />
      </LinearGradient>
      <Text style={[styles.label, { color: c.textMuted }]} numberOfLines={1}>
        {category.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', width: 72 },
  circle: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  label: { fontSize: 12, fontWeight: '600' },
});
