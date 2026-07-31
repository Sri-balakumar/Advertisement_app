import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

/**
 * Rendered by expo-router when a route below it throws.
 *
 * On a shop-floor POS there is nobody to plug in a laptop, so a blank screen or
 * a silent restart is unrecoverable. Showing the message plus a retry keeps the
 * terminal usable and gives staff something to read out over the phone.
 *
 * Note this catches JS errors only — a native crash still takes the process
 * down, which is what the camera guards in the signage screen are for.
 */
export function RouteError({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <View style={styles.root}>
      <Ionicons name="warning-outline" size={44} color="#f59e0b" />
      <Text style={styles.title}>Something went wrong</Text>
      <ScrollView style={styles.msgBox} contentContainerStyle={styles.msgInner}>
        <Text style={styles.msg}>{error?.message || 'Unknown error'}</Text>
      </ScrollView>
      <Pressable style={styles.btn} onPress={() => retry()}>
        <Ionicons name="refresh" size={18} color="#fff" />
        <Text style={styles.btnText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: '#EBF1FC',
  },
  title: { fontSize: 20, fontWeight: '800', color: '#1e2a5a', marginTop: 14 },
  msgBox: { maxHeight: 200, marginTop: 12, alignSelf: 'stretch' },
  msgInner: { paddingHorizontal: 8 },
  msg: { fontSize: 13, color: '#475569', textAlign: 'center', lineHeight: 19 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 22,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: '#4f46e5',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
