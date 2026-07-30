/**
 * Shared "clean & minimal" UI kit — one header, one card, one set of states,
 * so every screen looks like part of the same official app.
 */
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radius, Type } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useC() {
  const scheme = useColorScheme() ?? 'light';
  return Colors[scheme];
}

export function Screen({ children }: { children: ReactNode }) {
  const c = useC();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.background }}>
      {children}
    </SafeAreaView>
  );
}

export function Header({
  title,
  subtitle,
  onBack,
  right,
  gradient,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  /** Optional gradient bar background (e.g. ['#2563eb','#22d3ee']). */
  gradient?: readonly [string, string];
}) {
  const c = useC();
  const onGrad = !!gradient;
  const titleColor = onGrad ? '#fff' : c.text;
  const subColor = onGrad ? 'rgba(255,255,255,0.9)' : c.textMuted;

  const inner = (
    <View
      style={[
        styles.header,
        onGrad
          ? styles.headerGrad
          : { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={10}
          style={[
            styles.hBack,
            { backgroundColor: onGrad ? 'rgba(255,255,255,0.2)' : c.card, borderColor: c.border },
          ]}>
          <Ionicons name="chevron-back" size={22} color={titleColor} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[Type.h1, { color: titleColor }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[Type.caption, { color: subColor, marginTop: 2 }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );

  if (onGrad) {
    return (
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.headerGradWrap}>
        {inner}
      </LinearGradient>
    );
  }
  return inner;
}

export function HeaderIcon({
  name,
  onPress,
  color,
}: {
  name: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  color?: string;
}) {
  const c = useC();
  return (
    <Pressable onPress={onPress} hitSlop={10} style={styles.hIcon}>
      <Ionicons name={name} size={20} color={color || c.textMuted} />
    </Pressable>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  const c = useC();
  return <Text style={[Type.section, styles.section, { color: c.textMuted }]}>{children}</Text>;
}

export function Card({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useC();
  if (!onPress) {
    return <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }, style]}>{children}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: c.card, borderColor: c.border },
        style,
        pressed && styles.pressed,
      ]}>
      {children}
    </Pressable>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const c = useC();
  return <View style={{ height: StyleSheet.hairlineWidth, marginLeft: inset, backgroundColor: c.border }} />;
}

export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const c = useC();
  return <View style={[{ backgroundColor: c.border, borderRadius: 10, opacity: 0.55 }, style]} />;
}

export function Loading() {
  const c = useC();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={c.tint} size="large" />
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const c = useC();
  return (
    <View style={styles.center}>
      <View style={[styles.emptyIcon, { backgroundColor: c.card, borderColor: c.border }]}>
        <Ionicons name={icon} size={30} color={c.textMuted} />
      </View>
      <Text style={[Type.title, { color: c.text, marginTop: 14 }]}>{title}</Text>
      {text ? (
        <Text style={[Type.body, { color: c.textMuted, textAlign: 'center', marginTop: 6 }]}>{text}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [styles.action, { backgroundColor: c.tint }, pressed && styles.pressed]}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hBack: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerGrad: { borderBottomWidth: 0 },
  headerGradWrap: { borderBottomLeftRadius: 22, borderBottomRightRadius: 22 },
  hIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: 22, marginBottom: 8, marginLeft: 4 },
  card: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth },
  pressed: { opacity: 0.7, transform: [{ scale: 0.985 }] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: { marginTop: 16, paddingHorizontal: 22, paddingVertical: 12, borderRadius: Radius.md },
});
