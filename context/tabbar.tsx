import { createContext, ReactNode, useContext, useState } from 'react';

/**
 * Lets the Home screen auto-hide the bottom tab bar (clean full-screen signage)
 * and reveal it on tap, while the tab layout stays the owner of its styling.
 */
type TabBarValue = { hidden: boolean; setHidden: (b: boolean) => void };

const TabBarContext = createContext<TabBarValue>({ hidden: false, setHidden: () => {} });

export function TabBarProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);
  return <TabBarContext.Provider value={{ hidden, setHidden }}>{children}</TabBarContext.Provider>;
}

export function useTabBar() {
  return useContext(TabBarContext);
}
