import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

import { OdooUser } from '@/services/odoo';

type AuthContextValue = {
  user: OdooUser | null;
  onboarded: boolean;
  /** True while we load the persisted session on cold start. */
  initializing: boolean;
  signIn: (user: OdooUser) => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<OdooUser | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [rawUser, ob] = await Promise.all([
          AsyncStorage.getItem('userData'),
          AsyncStorage.getItem('onboarded'),
        ]);
        if (rawUser) setUser(JSON.parse(rawUser));
        setOnboarded(ob === '1');
      } catch {
        // ignore — treat as logged-out / not onboarded
      } finally {
        setInitializing(false);
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
      value={{ user, onboarded, initializing, signIn, signOut, completeOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
