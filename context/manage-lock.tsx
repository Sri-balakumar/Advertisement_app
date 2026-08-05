/**
 * PIN lock for the Manage screens, configured in Odoo → Signage Scan → App Lock.
 *
 * The terminals run as an admin user, so the app's canManage gate hides nothing
 * from whoever is holding the device. This lock sits in front of Manage for
 * everyone, admins included — that is the point of it.
 *
 * This provider only holds the *configuration*: which sections need a PIN and
 * how long an unlocked screen may sit idle. Whether a screen is currently
 * unlocked is deliberately NOT kept here — it lives in each LockGate and dies
 * with it, so every visit to Manage asks again.
 *
 * It is a gate on the UI, not on the server: the session still carries whatever
 * rights the signed-in Odoo user has. It stops someone tapping into Manage at
 * the counter, which is what it is for.
 */
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/context/auth';
import {
  DEFAULT_AUTO_LOCK_SECONDS,
  getManageLock,
  LockSection,
  ManageLock,
  NO_LOCK,
} from '@/services/odoo';

/** Never lock faster than this, however the server is configured — a couple of
 *  seconds would make Manage unusable. Mirrors AUTO_LOCK_MIN in the module. */
const AUTO_LOCK_MIN_SECONDS = 5;

type Ctx = {
  config: ManageLock;
  /** True when this section is configured to need a PIN. */
  requiresPin: (section: LockSection) => boolean;
  /** Idle seconds before an unlocked screen re-locks itself. */
  autoLockSeconds: number;
  refresh: () => void;
};

const ManageLockContext = createContext<Ctx>({
  config: NO_LOCK,
  requiresPin: () => false,
  autoLockSeconds: DEFAULT_AUTO_LOCK_SECONDS,
  refresh: () => {},
});

export function ManageLockProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const base = user?.base_url || '';
  const [config, setConfig] = useState<ManageLock>(NO_LOCK);

  const refresh = useCallback(() => {
    if (!base) {
      setConfig(NO_LOCK);
      return;
    }
    // A server that can't be reached must not lock anyone out of Manage — the
    // screens are useless offline anyway, so failing open costs nothing.
    getManageLock(base)
      .then((cfg) => {
        console.log(
          `[lock] config: mode=${cfg.mode} pin_set=${cfg.pin_set} ` +
            `autoLock=${cfg.auto_lock_seconds}s locked=` +
            Object.entries(cfg.locked)
              .filter(([, v]) => v)
              .map(([k]) => k)
              .join(',') || '(none)',
        );
        setConfig(cfg);
      })
      .catch((e) => {
        console.log('[lock] config fetch FAILED —', e?.message || e);
        setConfig(NO_LOCK);
      });
  }, [base]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Pick up a PIN set or cleared in Odoo without needing an app restart.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const requiresPin = useCallback(
    (section: LockSection) => {
      if (!config.pin_set || config.mode === 'off') return false;
      return !!config.locked[section];
    },
    [config],
  );

  const autoLockSeconds = Math.max(
    AUTO_LOCK_MIN_SECONDS,
    config.auto_lock_seconds || DEFAULT_AUTO_LOCK_SECONDS,
  );

  return (
    <ManageLockContext.Provider value={{ config, requiresPin, autoLockSeconds, refresh }}>
      {children}
    </ManageLockContext.Provider>
  );
}

export const useManageLock = () => useContext(ManageLockContext);
