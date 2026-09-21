import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../../src/lib/auth';
import { listConversations } from '../../../src/lib/db/conversations';
import type { Conversation } from '../../../src/types/conversation';
import { SoftEmptyState, SoftListRow, WaveHeader, useGlassChrome } from '../../../src/soft-ui';
import { themeFromScheme } from '../../../src/soft-ui/theme';

function lastMessagePreview(item: Conversation, myId?: string) {
  const body = item.last_message_body?.replace(/\s+/g, ' ').trim();
  if (!body) return 'Nenhuma mensagem ainda';
  const mine = Boolean(myId && item.last_message_sender_id === myId);
  return mine ? `Você: ${body}` : body;
}

export default function ConversationsScreen() {
  const theme = themeFromScheme(useColorScheme());
  const chrome = useGlassChrome();
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listConversations());
    } catch (e) {
      console.warn(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]} edges={[]}>
      <StatusBar style="light" />
      <WaveHeader theme={theme} height={128} title="Conversas" subtitle="seu papo" />
      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.brand.solid} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={load}
              tintColor={theme.colors.brand.solid}
            />
          }
          contentContainerStyle={[
            styles.list,
            {
              paddingHorizontal: theme.screenPadding.horizontal,
              gap: theme.spacing.md,
              paddingBottom: chrome.tabClearance + 16,
            },
          ]}
          ListEmptyComponent={
            <SoftEmptyState
              theme={theme}
              title="Nenhuma conversa ainda"
              description="Abra um contato para criar uma conversa offline (SQLite)."
            />
          }
          renderItem={({ item }) => (
            <SoftListRow
              theme={theme}
              title={item.peer_display_name ?? item.title ?? 'Conversa'}
              subtitle={lastMessagePreview(item, user?.id)}
              avatarUri={item.peer_avatar_url}
              onPress={() => router.push(`/(app)/chat/${item.id}`)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingTop: 8, paddingBottom: 28, flexGrow: 1 },
});
