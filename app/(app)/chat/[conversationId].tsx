import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../src/lib/auth';
import { getConversation } from '../../../src/lib/db/conversations';
import { insertMessage, listMessages, newMessageId } from '../../../src/lib/db/messages';
import {
  addResenhaGuest,
  friendlyResenhaError,
  listResenhasToInvite,
} from '../../../src/lib/resenhas';
import type { Conversation } from '../../../src/types/conversation';
import type { Message } from '../../../src/types/message';
import { formatResenhaDate, resenhaIconEmoji, type Resenha } from '../../../src/types/resenha';
import {
  IconChevronLeft,
  IconPlus,
  SoftAvatar,
  SoftButton,
  SoftEmptyState,
  SoftGlass,
  WaveHeader,
  useDialog,
  useGlassChrome,
} from '../../../src/soft-ui';
import { themeFromScheme } from '../../../src/soft-ui/theme';

export default function ChatThreadScreen() {
  const theme = themeFromScheme(useColorScheme());
  const insets = useSafeAreaInsets();
  const chrome = useGlassChrome();
  const router = useRouter();
  const { show } = useDialog();
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { user } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [resenhas, setResenhas] = useState<Resenha[]>([]);
  const [loadingResenhas, setLoadingResenhas] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  const peerName = conversation?.peer_display_name ?? conversation?.title ?? 'Conversa';

  const load = useCallback(async () => {
    if (!conversationId) return;
    const conv = await getConversation(conversationId);
    setConversation(conv);
    setMessages(await listMessages(conversationId));
  }, [conversationId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openProfile = () => {
    if (!conversation?.peer_user_id) return;
    router.push(`/(app)/chat/profile/${conversation.peer_user_id}`);
  };

  const openAddToResenha = async () => {
    if (!user || !conversation?.peer_user_id) return;
    setAddOpen(true);
    setLoadingResenhas(true);
    try {
      setResenhas(await listResenhasToInvite(user.id, conversation.peer_user_id));
    } catch (e) {
      setResenhas([]);
      show({ title: 'Resenhas', message: friendlyResenhaError(e) });
    } finally {
      setLoadingResenhas(false);
    }
  };

  const inviteToResenha = async (resenha: Resenha) => {
    if (!conversation?.peer_user_id) return;
    setAddingId(resenha.id);
    try {
      await addResenhaGuest(resenha.id, conversation.peer_user_id);
      setAddOpen(false);
      show({
        title: 'Adicionado',
        message: `${peerName} entrou em ${resenha.name}.`,
      });
    } catch (e) {
      show({ title: 'Não foi possível adicionar', message: friendlyResenhaError(e) });
    } finally {
      setAddingId(null);
    }
  };

  const send = async () => {
    const text = body.trim();
    if (!text || !user || !conversationId || sending) return;
    setSending(true);
    try {
      const msg: Message = {
        id: newMessageId(),
        conversation_id: conversationId,
        sender_id: user.id,
        body: text,
        created_at: new Date().toISOString(),
        status: 'sent',
        synced: false,
      };
      await insertMessage(msg);
      setBody('');
      setMessages(await listMessages(conversationId));
    } finally {
      setSending(false);
    }
  };

  const emptyHint = useMemo(
    () => (messages.length === 0 ? 'Manda a primeira mensagem.' : undefined),
    [messages.length],
  );

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <WaveHeader theme={theme} height={118}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={styles.headerIconBtn}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <IconChevronLeft color="#FFFFFF" size={22} />
          </Pressable>

          <Pressable
            onPress={openProfile}
            disabled={!conversation?.peer_user_id}
            style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.92 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel={`Ver perfil de ${peerName}`}
          >
            <SoftGlass theme={theme} radius={999} intensity={40} contentStyle={styles.personPill}>
              <SoftAvatar
                theme={theme}
                uri={conversation?.peer_avatar_url}
                name={peerName}
                size={36}
              />
              <Text
                style={[
                  theme.typography.bodyMedium,
                  {
                    flex: 1,
                    color: theme.mode === 'dark' ? '#F7F8FB' : '#121218',
                  },
                ]}
                numberOfLines={1}
              >
                {peerName}
              </Text>
            </SoftGlass>
          </Pressable>

          <Pressable
            onPress={openAddToResenha}
            disabled={!conversation?.peer_user_id}
            style={({ pressed }) => [
              styles.addPill,
              {
                backgroundColor: 'rgba(255,255,255,0.18)',
                borderRadius: theme.radii.pill,
                opacity: !conversation?.peer_user_id ? 0.45 : pressed ? 0.88 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Adicionar à Resenha"
          >
            <IconPlus color="#FFFFFF" size={16} />
            <Text style={[theme.typography.caption, { color: '#FFFFFF', fontWeight: '700' }]}>
              Resenha
            </Text>
          </Pressable>
        </View>
      </WaveHeader>

      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          emptyHint ? (
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted, textAlign: 'center' }]}>
              {emptyHint}
            </Text>
          ) : null
        }
        renderItem={({ item }) => {
          const mine = item.sender_id === user?.id;
          const bubbleInner = (
            <>
              <Text
                style={[
                  theme.typography.body,
                  { color: mine ? theme.colors.textOnBrand : theme.colors.textPrimary },
                ]}
              >
                {item.body}
              </Text>
              <Text
                style={[
                  theme.typography.caption,
                  {
                    color: mine ? 'rgba(255,255,255,0.78)' : theme.colors.textMuted,
                    marginTop: 4,
                  },
                ]}
              >
                {new Date(item.created_at).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </>
          );
          if (mine) {
            return (
              <LinearGradient
                colors={[...theme.gradient.colors]}
                locations={[...theme.gradient.locations]}
                start={theme.gradient.start}
                end={theme.gradient.end}
                style={[styles.bubble, { alignSelf: 'flex-end', borderBottomRightRadius: 10 }]}
              >
                {bubbleInner}
              </LinearGradient>
            );
          }
          return (
            <View
              style={[
                styles.bubble,
                theme.shadows.soft,
                {
                  alignSelf: 'flex-start',
                  backgroundColor: theme.colors.surface,
                  borderBottomLeftRadius: 10,
                },
              ]}
            >
              {bubbleInner}
            </View>
          );
        }}
      />

      <View style={{ marginHorizontal: 14, marginBottom: chrome.tabClearance }}>
        <SoftGlass theme={theme} radius={28} contentStyle={styles.composer}>
          <TextInput
            style={[
              theme.typography.body,
              styles.input,
              {
                backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                color: theme.colors.textPrimary,
                borderRadius: theme.radii.pill,
              },
            ]}
            placeholder="Mensagem…"
            placeholderTextColor={theme.colors.placeholder}
            value={body}
            onChangeText={setBody}
            editable={!sending}
            onSubmitEditing={send}
          />
          <Pressable
            onPress={send}
            disabled={sending}
            style={[
              styles.send,
              {
                backgroundColor: theme.colors.brand.solid,
                borderRadius: theme.radii.pill,
                opacity: sending ? 0.6 : 1,
                ...theme.shadows.button,
              },
            ]}
          >
            <Text style={[theme.typography.button, { color: theme.colors.textOnBrand }]}>Enviar</Text>
          </Pressable>
        </SoftGlass>
      </View>

      <Modal visible={addOpen} animationType="slide" transparent onRequestClose={() => setAddOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]} onPress={() => setAddOpen(false)} />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.surface,
                paddingHorizontal: theme.screenPadding.horizontal,
                paddingBottom: Math.max(insets.bottom, 16),
                ...theme.shadows.softStrong,
              },
            ]}
          >
            <Text style={[theme.typography.heading, { color: theme.colors.textPrimary }]}>
              Adicionar à Resenha
            </Text>
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.textSecondary, marginTop: 6, marginBottom: theme.spacing.md },
              ]}
            >
              Escolha um rolê do qual você já participa. {peerName} precisa ter contato com alguém da lista.
            </Text>
            {loadingResenhas ? (
              <ActivityIndicator color={theme.colors.brand.solid} style={{ marginVertical: 24 }} />
            ) : (
              <FlatList
                data={resenhas}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 360 }}
                ListEmptyComponent={
                  <SoftEmptyState
                    theme={theme}
                    title="Nenhuma resenha disponível"
                    description="Marque um rolê primeiro, ou essa pessoa já está em todas as suas resenhas."
                  />
                }
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => inviteToResenha(item)}
                    disabled={addingId === item.id}
                    style={({ pressed }) => [
                      styles.resenhaRow,
                      {
                        backgroundColor: theme.colors.background,
                        borderRadius: theme.radii.lg,
                        opacity: pressed || addingId === item.id ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Text style={styles.resenhaEmoji}>{resenhaIconEmoji(item.icon, item.icon_emoji)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[theme.typography.bodyMedium, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                        {formatResenhaDate(item.occurs_at)}
                      </Text>
                    </View>
                    {addingId === item.id ? (
                      <ActivityIndicator color={theme.colors.brand.solid} />
                    ) : (
                      <IconPlus color={theme.colors.brand.solid} size={18} />
                    )}
                  </Pressable>
                )}
              />
            )}
            <View style={{ marginTop: theme.spacing.md }}>
              <SoftButton theme={theme} variant="ghost" label="Fechar" onPress={() => setAddOpen(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 14,
    minHeight: 48,
  },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    minHeight: 40,
  },
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16, flexGrow: 1, gap: 10 },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    maxWidth: '80%',
  },
  composer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 18,
  },
  send: {
    minHeight: 48,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 24,
    maxHeight: '86%',
  },
  resenhaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
  },
  resenhaEmoji: { fontSize: 26 },
});
