import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../../src/lib/auth';
import { isGroupConversationId, listConversations } from '../../../src/lib/db/conversations';
import { useChatInbox } from '../../../src/lib/chat-inbox';
import type { Conversation } from '../../../src/types/conversation';
import { IconPlus, SoftEmptyState, SoftListRow, WaveHeader, useGlassChrome } from '../../../src/soft-ui';
import { themeFromScheme } from '../../../src/soft-ui/theme';

function lastMessagePreview(item: Conversation, myId?: string) {
  const body = item.last_message_body?.replace(/\s+/g, ' ').trim();
  const isGroup = item.kind === 'group' || isGroupConversationId(item.id);
  if (!body) return isGroup ? 'Grupo · nenhuma mensagem ainda' : 'Nenhuma mensagem ainda';
  const mine = Boolean(myId && item.last_message_sender_id === myId);
  const preview = mine ? `Você: ${body}` : body;
  return isGroup ? `Grupo · ${preview}` : preview;
}

export default function ConversationsScreen() {
  const theme = themeFromScheme(useColorScheme());
  const chrome = useGlassChrome();
  const { user } = useAuth();
  const { refresh: refreshUnread, inboxTick } = useChatInbox();
  const router = useRouter();
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = user ? await listConversations(user.id) : [];
      setItems(rows);
      await refreshUnread();
    } catch (e) {
      console.warn(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [refreshUnread, user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        setItems(await listConversations(user.id));
        await refreshUnread();
      } catch {
        // ignore
      }
    })();
  }, [inboxTick, refreshUnread, user]);

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
              paddingBottom: chrome.tabClearance + 80,
            },
          ]}
          ListEmptyComponent={
            <SoftEmptyState
              theme={theme}
              title="Nenhuma conversa ainda"
              description="Abra um contato ou crie um grupo para começar a conversar."
            />
          }
          renderItem={({ item }) => (
            <SoftListRow
              theme={theme}
              title={item.peer_display_name ?? item.title ?? 'Conversa'}
              subtitle={lastMessagePreview(item, user?.id)}
              avatarUri={item.peer_avatar_url}
              unreadCount={item.unread_count ?? 0}
              onPress={() => router.push(`/(app)/chat/${item.id}`, { withAnchor: true })}
            />
          )}
        />
      )}

      <Pressable
        onPress={() => router.push('/(app)/chat/new-group')}
        style={({ pressed }) => [
          styles.fab,
          theme.shadows.fab,
          { opacity: pressed ? 0.9 : 1, borderRadius: theme.radii.pill, bottom: chrome.tabClearance + 8 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Novo grupo"
      >
        <LinearGradient
          colors={[...theme.gradient.colors]}
          locations={[...theme.gradient.locations]}
          start={theme.gradient.start}
          end={theme.gradient.end}
          style={[styles.fabInner, { borderRadius: theme.radii.pill }]}
        >
          <IconPlus color={theme.colors.textOnBrand} size={22} />
          <Text style={[theme.typography.button, { color: theme.colors.textOnBrand }]}>Novo grupo</Text>
        </LinearGradient>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingTop: 8, paddingBottom: 28, flexGrow: 1 },
  fab: {
    position: 'absolute',
    right: 20,
    overflow: 'hidden',
  },
  fabInner: {
    minHeight: 52,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
