import { useEffect, useState } from 'react';
import { Slot } from 'expo-router';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/lib/auth';
import { ChatInboxProvider } from '../src/lib/chat-inbox';
import { initDb } from '../src/lib/db/client';
import { DialogProvider } from '../src/soft-ui/components/SoftDialog';
import { InvitesProvider } from '../src/lib/invites-context';
import { AppSplash } from '../src/soft-ui/screens/AppSplash';

const isExpoGo = Constants.appOwnership === 'expo';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
if (!isExpoGo) {
  SplashScreen.setOptions({ duration: 500, fade: true });
}

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
    SplashScreen.hideAsync().catch(() => undefined);
  }, [dbReady]);

  if (!dbReady) {
    return (
      <AppSplash
        onReady={() => {
          SplashScreen.hideAsync().catch(() => undefined);
        }}
      />
    );
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
