import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Colors, Radius } from '@/constants/theme';
import { PRODUCTS } from '@/data/mock';

export default function ScanScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const [code, setCode] = useState('');

  const go = () => {
    const id = code.trim().toLowerCase();
    const found = PRODUCTS.find((p) => p.id === id) ?? PRODUCTS[0];
    router.push({ pathname: '/product/[id]', params: { id: found.id } });
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.background }}>
      <Text style={[styles.h1, { color: c.text }]}>Scan</Text>

      <View style={styles.center}>
        <LinearGradient colors={Brand.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.frame}>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
          <Ionicons name="qr-code-outline" size={92} color="rgba(255,255,255,0.95)" />
        </LinearGradient>

        <Text style={[styles.title, { color: c.text }]}>Scan a 369 banner</Text>
        <Text style={[styles.sub, { color: c.textMuted }]}>
          Point your camera at any 369 Advertisement QR code to open the product and its offer.
        </Text>

        <Pressable onPress={() => {}} style={styles.cta}>
          <LinearGradient colors={Brand.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaInner}>
            <Ionicons name="camera" size={18} color="#fff" />
            <Text style={styles.ctaText}>Open camera scanner</Text>
          </LinearGradient>
        </Pressable>

        <View style={styles.orRow}>
          <View style={[styles.line, { backgroundColor: c.border }]} />
          <Text style={[styles.or, { color: c.textMuted }]}>or enter code</Text>
          <View style={[styles.line, { backgroundColor: c.border }]} />
        </View>

        <View style={[styles.inputRow, { backgroundColor: c.card, borderColor: c.border }]}>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="e.g. summer-sale"
            placeholderTextColor={c.textMuted}
            autoCapitalize="none"
            style={[styles.input, { color: c.text }]}
            onSubmitEditing={go}
          />
          <Pressable onPress={go} style={styles.goBtn}>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const CORNER = 26;
const styles = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '900', paddingHorizontal: 20, paddingTop: 6 },
  center: { flex: 1, alignItems: 'center', paddingHorizontal: 28, paddingTop: 10 },
  frame: {
    width: 220,
    height: 220,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 28,
  },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#fff' },
  tl: { top: 16, left: 16, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  tr: { top: 16, right: 16, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  bl: { bottom: 16, left: 16, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  br: { bottom: 16, right: 16, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  title: { fontSize: 20, fontWeight: '800' },
  sub: { fontSize: 14, textAlign: 'center', lineHeight: 21, marginTop: 8 },
  cta: { width: '100%', marginTop: 24 },
  ctaInner: {
    height: 54,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 22, width: '100%' },
  line: { flex: 1, height: 1 },
  or: { fontSize: 12, fontWeight: '600' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 54,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingLeft: 16,
    paddingRight: 6,
  },
  input: { flex: 1, fontSize: 15 },
  goBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
