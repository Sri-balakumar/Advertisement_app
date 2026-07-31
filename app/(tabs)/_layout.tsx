import { Tabs } from 'expo-router';

import { FloatingTabBar } from '@/components/floating-tabbar';
import { RouteError } from '@/components/route-error';
import { useAuth } from '@/context/auth';

// Keeps a throw inside a tab from taking down the whole app.
export { RouteError as ErrorBoundary };

export default function TabLayout() {
  const { canManage } = useAuth();

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <FloatingTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="manage" options={{ title: 'Manage', href: canManage ? '/manage' : null }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
