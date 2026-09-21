import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View, useColorScheme } from 'react-native';
import { useAuth } from '../../src/lib/auth';
import { useInvites } from '../../src/lib/invites-context';
import {
  IconAccount,
  IconChat,
  IconPeople,
  IconResenha,
  SoftGlassBackdrop,
  useGlassChrome,
} from '../../src/soft-ui';
import { themeFromScheme } from '../../src/soft-ui/theme';

export default function AppLayout() {
  const { session, loading } = useAuth();
  const theme = themeFromScheme(useColorScheme());
  const { incoming } = useInvites();
  const chrome = useGlassChrome();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator color={theme.colors.brand.solid} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  const pillRadius = chrome.tabHeight / 2;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Tabs
        safeAreaInsets={{ bottom: 0 }}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.colors.brand.solid,
          tabBarInactiveTintColor: theme.colors.textMuted,
          tabBarLabelStyle: { fontWeight: '600', fontSize: 11 },
          tabBarHideOnKeyboard: false,
          tabBarBackground: () => <SoftGlassBackdrop theme={theme} intensity={90} />,
          tabBarStyle: {
            position: 'absolute',
            left: chrome.tabHInset,
            right: chrome.tabHInset,
            bottom: chrome.tabBottom,
            height: chrome.tabHeight,
            borderRadius: pillRadius,
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            elevation: 18,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: theme.mode === 'dark' ? 0.5 : 0.18,
            shadowRadius: 22,
            overflow: 'hidden',
            paddingTop: 8,
            paddingBottom: 8,
          },
        }}
      >
        <Tabs.Screen
          name="contacts"
          options={{
            title: 'Contatos',
            tabBarBadge: incoming.length > 0 ? incoming.length : undefined,
            tabBarBadgeStyle: {
              backgroundColor: theme.colors.brand.solid,
              color: theme.colors.textOnBrand,
            },
            tabBarIcon: ({ color, size }) => <IconPeople color={String(color)} size={size} />,
          }}
        />
        <Tabs.Screen
          name="resenhas"
          options={{
            title: 'Resenhas',
            tabBarIcon: ({ color, size }) => <IconResenha color={String(color)} size={size} />,
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: 'Chat',
            tabBarIcon: ({ color, size }) => <IconChat color={String(color)} size={size} />,
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            title: 'Conta',
            tabBarIcon: ({ color, size }) => <IconAccount color={String(color)} size={size} />,
          }}
        />
      </Tabs>
    </View>
  );
}
