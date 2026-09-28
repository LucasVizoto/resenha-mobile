import { useEffect, useState } from 'react';
import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/lib/auth';
import { ChatInboxProvider } from '../src/lib/chat-inbox';
import { initDb } from '../src/lib/db/client';
import { DialogProvider } from '../src/soft-ui/components/SoftDialog';
import { InvitesProvider } from '../src/lib/invites-context';
import { AppSplash } from '../src/soft-ui/screens/AppSplash';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await initDb();
      } catch (e) {
        console.warn('initDb failed', e);
      } finally {
        if (alive) {
          setDbReady(true);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!dbReady) return;
    const id = requestAnimationFrame(() => {
      SplashScreen.hideAsync().catch(() => undefined);
    });
    return () => cancelAnimationFrame(id);
  }, [dbReady]);

  if (!dbReady) {
    return <AppSplash />;
  }

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AuthProvider>
        <DialogProvider>
          <InvitesProvider>
            <ChatInboxProvider>
              <Slot />
            </ChatInboxProvider>
          </InvitesProvider>
        </DialogProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
