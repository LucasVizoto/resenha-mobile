import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { themeFromScheme } from '../../../src/soft-ui/theme';

export default function ChatStack() {
  const theme = themeFromScheme(useColorScheme());
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: theme.colors.background },
        headerTitleStyle: { fontWeight: '700', color: theme.colors.textPrimary },
        headerTintColor: theme.colors.brand.solid,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[conversationId]" options={{ headerShown: false }} />
      <Stack.Screen name="profile/[userId]" options={{ title: 'Perfil' }} />
    </Stack>
  );
}
