/**
 * App-side scan preferences (persisted in AsyncStorage; no Odoo involvement).
 *
 *  - scan mode:     'auto'   = use a USB scanner if one is attached, else the
 *                             mobile camera (default — self-detecting)
 *                   'usb'    = keyboard-wedge USB scanner only, camera stays OFF
 *                   'camera' = small always-on corner camera window (phone)
 *  - detail seconds: how long a scanned product's detail stays on screen.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ScanMode = 'auto' | 'usb' | 'camera';

export const DEFAULT_SCAN_MODE: ScanMode = 'auto';
export const DEFAULT_DETAIL_SECONDS = 8;
export const DETAIL_SECONDS_OPTS = [5, 8, 15, 30] as const;

const MODE_KEY = 'scan_mode';
const SECONDS_KEY = 'scan_detail_seconds';

export async function getScanMode(): Promise<ScanMode> {
  try {
    const v = await AsyncStorage.getItem(MODE_KEY);
    return v === 'usb' ? 'usb' : v === 'camera' ? 'camera' : 'auto';
  } catch {
    return DEFAULT_SCAN_MODE;
  }
}

export async function setScanMode(mode: ScanMode): Promise<void> {
  try {
    await AsyncStorage.setItem(MODE_KEY, mode);
  } catch {
    // ignore — non-persisted this session
  }
}

export async function getDetailSeconds(): Promise<number> {
  try {
    const n = Number(await AsyncStorage.getItem(SECONDS_KEY));
    return n > 0 ? n : DEFAULT_DETAIL_SECONDS;
  } catch {
    return DEFAULT_DETAIL_SECONDS;
  }
}

export async function setDetailSeconds(seconds: number): Promise<void> {
  try {
    await AsyncStorage.setItem(SECONDS_KEY, String(seconds));
  } catch {
    // ignore
  }
}
