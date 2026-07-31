import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

import { OdooUser, signageCanManage } from '@/services/odoo';

type AuthContextValue = {
  user: OdooUser | null;
  onboarded: boolean;
  /** True while we load the persisted session on cold start. */
  initializing: boolean;
  /** True when the signed-in user may create ads (admin/manager). */
  canManage: boolean;
  signIn: (user: OdooUser) => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<OdooUser | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [canManage, setCanManage] = useState(false);

  // Re-check admin (create) rights whenever the signed-in user changes.
  useEffect(() => {
    let alive = true;
    if (user?.base_url) {
      signageCanManage(user.base_url).then((v) => {
        if (alive) setCanManage(v);
      });
    } else {
      setCanManage(false);
    }
    return () => {
      alive = false;
    };
  }, [user?.base_url]);

  useEffect(() => {
    (async () => {
      console.log('[boot][auth] reading persisted session…');
      try {
        const [rawUser, ob] = await Promise.all([
          AsyncStorage.getItem('userData'),
          AsyncStorage.getItem('onboarded'),
        ]);
        if (rawUser) setUser(JSON.parse(rawUser));
        setOnboarded(ob === '1');
        console.log(`[boot][auth] session=${rawUser ? 'found' : 'none'} onboarded=${ob === '1'}`);
      } catch (e: any) {
        console.log('[boot][auth] read FAILED —', e?.message || e);
        // ignore — treat as logged-out / not onboarded
      } finally {
        setInitializing(false);
        console.log('[boot][auth] initializing=false');
      }
    })();
  }, []);

  const signIn = async (u: OdooUser) => {
    setUser(u);
    try {
      await AsyncStorage.multiSet([
        ['userData', JSON.stringify(u)],
        ['odoo_base_url', u.base_url],
        ['odoo_db', u.odoo_db],
      ]);
    } catch {}
  };

  const signOut = async () => {
    setUser(null);
    try {
      await AsyncStorage.removeItem('userData');
    } catch {}
  };

  const completeOnboarding = async () => {
    setOnboarded(true);
    try {
      await AsyncStorage.setItem('onboarded', '1');
    } catch {}
  };

  return (
    <AuthContext.Provider
      value={{ user, onboarded, initializing, canManage, signIn, signOut, completeOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
