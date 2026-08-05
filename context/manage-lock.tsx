/**
 * PIN lock for the Manage screens, configured in Odoo → Signage Scan → App Lock.
 *
 * The terminals run as an admin user, so the app's canManage gate hides nothing
 * from whoever is holding the device. This lock sits in front of Manage for
 * everyone, admins included — that is the point of it.
 *
 * Unlocks are remembered per *domain*, not per screen:
 *
 *   pin_mode = 'all'     every section shares the domain 'manage', so one PIN at
 *                        the Manage door opens everything inside it
 *   pin_mode = 'custom'  each section is its own domain, so the screens ticked in
 *                        Odoo unlock independently
 *
 * That is what stops "Whole Manage section" asking again on every sub-screen,
 * while still challenging Profile → Scan mode, which reaches Scanner & Display
 * without passing the hub.
 *
 * It is a gate on the UI, not on the server: the session still carries whatever
 * rights the signed-in Odoo user has. It stops someone tapping into Manage at
 * the counter, which is what it is for.
 */
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
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
  /** True when this section is governed by the lock at all. */
  requiresPin: (section: LockSection) => boolean;
  /** True when this section's domain has already been unlocked. */
  isUnlocked: (section: LockSection) => boolean;
  unlock: (section: LockSection) => void;
  /** Any touch on an unlocked Manage screen; restarts the idle countdown. */
  touch: () => void;
  /** Drop every unlock — used when the user leaves the Manage area. */
  lockAll: () => void;
  refresh: () => void;
};

const ManageLockContext = createContext<Ctx>({
  config: NO_LOCK,
  requiresPin: () => false,
  isUnlocked: () => false,
  unlock: () => {},
  touch: () => {},
  lockAll: () => {},
  refresh: () => {},
});

export function ManageLockProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const base = user?.base_url || '';
  const [config, setConfig] = useState<ManageLock>(NO_LOCK);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anyUnlocked = useRef(false);

  useEffect(() => {
    anyUnlocked.current = unlocked.size > 0;
  }, [unlocked]);

  const refresh = useCallback(() => {
    if (!base) {
      setConfig(NO_LOCK);
      return;
    }
    // A server that can't be reached must not lock anyone out of Manage — the
    // screens are useless offline anyway, so failing open costs nothing.
    getManageLock(base)
      .then((cfg) => {
        const on = Object.entries(cfg.locked)
          .filter(([, v]) => v)
          .map(([k]) => k)
          .join(',');
        console.log(
          `[lock] config: mode=${cfg.mode} pin_set=${cfg.pin_set} ` +
            `autoLock=${cfg.auto_lock_seconds}s locked=${on || '(none)'}`,
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

  const autoLockSeconds = Math.max(
    AUTO_LOCK_MIN_SECONDS,
    config.auto_lock_seconds || DEFAULT_AUTO_LOCK_SECONDS,
  );

  const clearIdle = () => {
    if (idle.current) {
      clearTimeout(idle.current);
      idle.current = null;
    }
  };

  const lockAll = useCallback(() => {
    clearIdle();
    setUnlocked((prev) => (prev.size ? new Set() : prev));
  }, []);

  /** Restart the idle countdown. Shared across screens, so moving around inside
   *  Manage keeps the unlock alive; putting the device down does not. */
  const armIdle = useCallback(() => {
    clearIdle();
    idle.current = setTimeout(() => {
      idle.current = null;
      console.log(`[lock] idle ${autoLockSeconds}s — re-locking`);
      setUnlocked(new Set());
    }, autoLockSeconds * 1000);
  }, [autoLockSeconds]);

  // Backgrounding must re-lock, and coming back is a good moment to notice a PIN
  // that was set or cleared in Odoo meanwhile.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') lockAll();
      else refresh();
    });
    return () => sub.remove();
  }, [lockAll, refresh]);

  useEffect(() => clearIdle, []);

  /** 'all' puts every section in one domain; 'custom' keeps them separate. */
  const domainOf = useCallback(
    (section: LockSection) => (config.mode === 'all' ? 'manage' : section),
    [config.mode],
  );

  const requiresPin = useCallback(
    (section: LockSection) => {
      if (!config.pin_set || config.mode === 'off') return false;
      return !!config.locked[section];
    },
    [config],
  );

  const isUnlocked = useCallback(
    (section: LockSection) => unlocked.has(domainOf(section)),
    [unlocked, domainOf],
  );

  const unlock = useCallback(
    (section: LockSection) => {
      const key = domainOf(section);
      setUnlocked((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      armIdle();
    },
    [domainOf, armIdle],
  );

  const touch = useCallback(() => {
    if (anyUnlocked.current) armIdle();
  }, [armIdle]);

  return (
    <ManageLockContext.Provider
      value={{ config, requiresPin, isUnlocked, unlock, touch, lockAll, refresh }}>
      {children}
    </ManageLockContext.Provider>
  );
}

export const useManageLock = () => useContext(ManageLockContext);
