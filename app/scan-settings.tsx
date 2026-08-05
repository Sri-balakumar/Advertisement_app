import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, Divider, Header, Screen, SectionLabel, useC } from '@/components/ui';
import { Brand, Radius, Type } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { getDetailConfig, setDetailConfig } from '@/services/odoo';
import { DEFAULT_SCAN_MODE, getScanMode, ScanMode, setScanMode } from '@/services/scanSettings';
import { LockGate } from '@/components/lock-gate';

const MODES: { key: ScanMode; label: string; sub: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'usb', label: 'USB scanner', sub: 'For POS terminals with a barcode scanner. The camera stays off.', icon: 'hardware-chip-outline' },
  { key: 'camera', label: 'Mobile camera', sub: 'For phones and tablets. A camera window scans on the Home screen.', icon: 'camera-outline' },
];

function ScanSettingsForm() {
  const c = useC();
  const router = useRouter();
  const { user } = useAuth();
  const base = user?.base_url || '';

  const [mode, setMode] = useState<ScanMode>(DEFAULT_SCAN_MODE);
  const [value, setValue] = useState('8');
  const [unit, setUnit] = useState<'sec' | 'min'>('sec');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getScanMode().then(setMode);
    if (base) {
      getDetailConfig(base)
        .then((d) => {
          setValue(String(d.value));
          setUnit(d.unit);
        })
        .catch(() => {});
    }
  }, [base]);

  const pickMode = (m: ScanMode) => {
    setMode(m);
    setScanMode(m);
  };

  const persist = (v: string, u: 'sec' | 'min') => {
    const n = Math.max(1, Number(v) || 1);
    setDetailConfig(base, n, u).catch(() => {});
  };
  const onChangeValue = (t: string) => {
    const clean = t.replace(/[^0-9]/g, '');
    setValue(clean);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(clean, unit), 500);
  };
  const pickUnit = (u: 'sec' | 'min') => {
    setUnit(u);
    persist(value, u);
  };

  const seconds = (Math.max(1, Number(value) || 1)) * (unit === 'min' ? 60 : 1);

  return (
    <Screen>
      <Header title="Scanner & Display" onBack={() => router.back()} gradient={['#2563eb', '#22d3ee']} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <SectionLabel>SCAN METHOD</SectionLabel>
        <Card>
          {MODES.map((m, i) => {
            const active = mode === m.key;
            return (
              <Pressable key={m.key} onPress={() => pickMode(m.key)}>
                {i > 0 ? <Divider inset={14} /> : null}
                <View style={styles.modeRow}>
                  <View style={[styles.modeIcon, { backgroundColor: active ? Brand.indigo : c.background }]}>
                    <Ionicons name={m.icon} size={20} color={active ? '#fff' : c.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[Type.title, { color: c.text }]}>{m.label}</Text>
                    <Text style={[Type.caption, { color: c.textMuted, marginTop: 3 }]}>{m.sub}</Text>
                  </View>
                  <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={22} color={active ? Brand.indigo : c.border} />
                </View>
              </Pressable>
            );
          })}
        </Card>

        <SectionLabel>DETAIL DISPLAY TIME</SectionLabel>
        <Card>
          <View style={styles.detailRow}>
            <Text style={[Type.title, { color: c.text }]}>Show for</Text>
            <View style={styles.detailInput}>
              <TextInput
                value={value}
                onChangeText={onChangeValue}
                keyboardType="number-pad"
                maxLength={4}
                style={[styles.num, { color: c.text, borderColor: c.border, backgroundColor: c.background }]}
              />
              <View style={[styles.unitSeg, { borderColor: c.border }]}>
                {(['sec', 'min'] as const).map((u) => {
                  const on = unit === u;
                  return (
                    <Pressable key={u} onPress={() => pickUnit(u)} style={[styles.unitItem, on && { backgroundColor: c.tint }]}>
                      <Text style={{ fontWeight: '800', fontSize: 13, color: on ? '#fff' : c.text }}>
                        {u === 'sec' ? 'Sec' : 'Min'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </Card>
        <Text style={[Type.caption, { color: c.textMuted, marginTop: 10, marginLeft: 4 }]}>
          = {seconds} second{seconds === 1 ? '' : 's'} on screen after a scan. Applies to all display
          devices.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  modeIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  detailInput: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  num: {
    width: 64,
    height: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
  },
  unitSeg: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, overflow: 'hidden' },
  unitItem: { paddingHorizontal: 14, paddingVertical: 10 },
});

// Locked when the matching option is ticked in Odoo -> Signage Scan -> App Lock.
// Wrapping rather than checking inside means the screen's data isn't fetched
// until the PIN is accepted.
export default function ScanSettingsScreen() {
  return (
    <LockGate section="scan_settings" title="Scanner & Display">
      <ScanSettingsForm />
    </LockGate>
  );
}
