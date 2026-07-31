/**
 * App-side scan preferences (persisted in AsyncStorage; no Odoo involvement).
 *
 *  - scan mode:     'usb'    = keyboard-wedge USB scanner, camera stays OFF
 *                             (default — what the POS terminals use)
 *                   'camera' = camera window on Home, tap to enlarge (phones)
 *  - detail seconds: how long a scanned product's detail stays on screen.
 *
 * The mode is chosen by the operator and never inferred. An earlier 'auto'
 * mode tried to detect whether a camera existed; every implementation of that
 * guess was wrong on some device, so the choice is now explicit.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ScanMode = 'usb' | 'camera';

export const DEFAULT_SCAN_MODE: ScanMode = 'usb';
export const DEFAULT_DETAIL_SECONDS = 8;
export const DETAIL_SECONDS_OPTS = [5, 8, 15, 30] as const;

const MODE_KEY = 'scan_mode';
const SECONDS_KEY = 'scan_detail_seconds';

export async function getScanMode(): Promise<ScanMode> {
  try {
    // Anything that isn't an explicit 'camera' — including the retired 'auto'
    // stored on existing devices — falls back to the USB scanner.
    return (await AsyncStorage.getItem(MODE_KEY)) === 'camera' ? 'camera' : 'usb';
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
