import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { Brand, Radius } from '@/constants/theme';

type Props = {
  label: string;
  onPress?: () => void;
  colors?: readonly [string, string];
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  style?: ViewStyle;
};

export function GradientButton({
  label,
  onPress,
  colors = Brand.gradient,
  icon,
  loading,
  style,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.btn}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            {icon ? <Ionicons name={icon} size={18} color="#fff" /> : null}
            <Text style={styles.label}>{label}</Text>
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 54,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
});
