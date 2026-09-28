import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, StyleSheet, View, useColorScheme } from 'react-native';
import { useAuth } from '../../src/lib/auth';
import { useChatInbox } from '../../src/lib/chat-inbox';
import { useInvites } from '../../src/lib/invites-context';
import {
  IconAccount,
  IconChat,
  IconPeople,
  IconResenha,
  useGlassChrome,
} from '../../src/soft-ui';
import { themeFromScheme } from '../../src/soft-ui/theme';

export default function AppLayout() {
  const { session, loading } = useAuth();
  const theme = themeFromScheme(useColorScheme());
  const { incoming } = useInvites();
  const { unreadTotal } = useChatInbox();
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

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Tabs
        safeAreaInsets={{ bottom: 0 }}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.colors.brand.solid,
          tabBarInactiveTintColor: theme.colors.textMuted,
          tabBarLabelStyle: { fontWeight: '600', fontSize: 11 },
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            position: 'relative',
            left: 0,
            right: 0,
            bottom: 0,
            height: chrome.tabHeight,
            paddingTop: 6,
            paddingBottom: chrome.systemBottom,
            marginHorizontal: 0,
            borderRadius: 0,
            backgroundColor: theme.colors.surface,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: theme.colors.borderSubtle,
            elevation: 8,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: theme.mode === 'dark' ? 0.35 : 0.08,
            shadowRadius: 8,
            overflow: 'visible',
          },
        }}
      >
        <Tabs.Screen
          name="chat"
          options={{
            title: 'Chats',
            tabBarBadge: unreadTotal > 0 ? unreadTotal : undefined,
            tabBarBadgeStyle: {
              backgroundColor: theme.colors.brand.solid,
              color: theme.colors.textOnBrand,
            },
            tabBarIcon: ({ color, size }) => <IconChat color={String(color)} size={size} />,
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
