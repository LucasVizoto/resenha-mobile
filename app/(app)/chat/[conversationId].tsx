import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
  type KeyboardEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../src/lib/auth';
import { getConversation, isGroupConversationId, markConversationRead } from '../../../src/lib/db/conversations';
import { useChatInbox } from '../../../src/lib/chat-inbox';
import { insertMessage, listMessages, newMessageId, deleteMessagesByIds } from '../../../src/lib/db/messages';
import { listGroupMembers, fetchChatGroup } from '../../../src/lib/groups';
import { displayNameFor } from '../../../src/lib/invites';
import { deliverOutgoingMessage } from '../../../src/lib/message-sync';
import { setActiveConversationId } from '../../../src/lib/notifications';
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
  IconTrash,
  SoftAvatar,
  SoftButton,
  SoftEmptyState,
  SoftGlass,
  WaveHeader,
  useDialog,
} from '../../../src/soft-ui';
import { themeFromScheme } from '../../../src/soft-ui/theme';

export default function ChatThreadScreen() {
  const theme = themeFromScheme(useColorScheme());
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { show } = useDialog();
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { user } = useAuth();
  const { refresh: refreshUnread, inboxTick, bump } = useChatInbox();
  const focusedRef = useRef(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [resenhas, setResenhas] = useState<Resenha[]>([]);
  const [loadingResenhas, setLoadingResenhas] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [senderNames, setSenderNames] = useState<Record<string, string>>({});
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [keyboardInset, setKeyboardInset] = useState(0);
  const listRef = useRef<FlatList<Message>>(null);
  const restingWindowHeight = useRef(Dimensions.get('window').height);

  const isGroup =
    conversation?.kind === 'group' || isGroupConversationId(String(conversationId ?? ''));
  const peerName = conversation?.peer_display_name ?? conversation?.title ?? (isGroup ? 'Grupo' : 'Conversa');

  const load = useCallback(async () => {
    if (!conversationId) return;
    const groupLike = isGroupConversationId(conversationId);
    if (groupLike) {
      await fetchChatGroup(conversationId).catch(() => null);
    }
    const conv = await getConversation(conversationId, user?.id);
    setConversation(conv);
    setMessages(await listMessages(conversationId));
    if (groupLike || conv?.kind === 'group') {
      try {
        const members = await listGroupMembers(conversationId);
        const names: Record<string, string> = {};
        for (const member of members) {
          names[member.user_id] = displayNameFor(member.profile);
        }
        setSenderNames(names);
      } catch {
        setSenderNames({});
      }
    }
    await markConversationRead(conversationId);
    await refreshUnread();
  }, [conversationId, refreshUnread, user?.id]);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      setActiveConversationId(conversationId ?? null);
      void load();
      return () => {
        focusedRef.current = false;
        setActiveConversationId(null);
      };
    }, [conversationId, load]),
  );

  useEffect(() => {
    if (!focusedRef.current) return;
    void load();
  }, [inboxTick, load]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: KeyboardEvent) => {
      const keyboardHeight = Math.round(e.endCoordinates.height);
      if (Platform.OS !== 'android') {
        setKeyboardInset(keyboardHeight);
        return;
      }
      const currentWindow = Dimensions.get('window').height;
      const windowShrunk = restingWindowHeight.current - currentWindow > 80;
      // Barra de atalhos do Gboard (~48–80px) + folga para o compositor (~60px).
      const toolbar = 0;
      setKeyboardInset(windowShrunk ? toolbar : keyboardHeight + toolbar);
    };
    const onHide = () => {
      restingWindowHeight.current = Dimensions.get('window').height;
      setKeyboardInset(0);
    };
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const openProfile = () => {
    if (isGroup && conversationId) {
      router.push(`/(app)/chat/group/${conversationId}`);
      return;
    }
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
      bump();
      void deliverOutgoingMessage(msg, user.id);
    } finally {
      setSending(false);
    }
  };

  const emptyHint = useMemo(
    () => (messages.length === 0 ? 'Manda a primeira mensagem.' : undefined),
    [messages.length],
  );

  const selectedCount = selectedIds.size;

  const exitSelect = () => {
    setSelecting(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const enterSelect = (id: string) => {
    setSelecting(true);
    setSelectedIds(new Set([id]));
  };

  const confirmDeleteSelected = () => {
    if (selectedCount === 0) return;
    show({
      title: selectedCount === 1 ? 'Apagar mensagem' : 'Apagar mensagens',
      message:
        selectedCount === 1
          ? 'A mensagem some só neste aparelho. Os outros participantes continuam vendo.'
          : `${selectedCount} mensagens somem só neste aparelho. Os outros participantes continuam vendo.`,
      actions: [
        {
          label: selectedCount === 1 ? 'Apagar' : `Apagar ${selectedCount}`,
          variant: 'danger',
          onPress: () => void removeSelected(),
        },
        { label: 'Cancelar', variant: 'ghost' },
      ],
    });
  };

  const removeSelected = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    try {
      await deleteMessagesByIds(ids);
      exitSelect();
      if (conversationId) setMessages(await listMessages(conversationId));
      bump();
    } catch (e) {
      show({
        title: 'Não foi possível apagar',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <WaveHeader theme={theme} height={118}>
        <View style={styles.headerRow}>
          {selecting ? (
            <>
              <Pressable
                onPress={exitSelect}
                style={styles.headerIconBtn}
                accessibilityRole="button"
                accessibilityLabel="Cancelar seleção"
              >
                <IconChevronLeft color="#FFFFFF" size={22} />
              </Pressable>
              <Text style={[theme.typography.bodyMedium, { color: '#FFFFFF', flex: 1 }]} numberOfLines={1}>
                {selectedCount === 0
                  ? 'Selecionar'
                  : selectedCount === 1
                    ? '1 selecionada'
                    : `${selectedCount} selecionadas`}
              </Text>
              <Pressable
                onPress={confirmDeleteSelected}
                disabled={selectedCount === 0}
                style={({ pressed }) => [
                  styles.headerIconBtn,
                  { opacity: selectedCount === 0 ? 0.4 : pressed ? 0.85 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Apagar selecionadas"
              >
                <IconTrash color="#FFFFFF" size={22} />
              </Pressable>
            </>
          ) : (
            <>
          <Pressable
            onPress={() => router.dismissTo('/(app)/chat')}
            style={styles.headerIconBtn}
            accessibilityRole="button"
            accessibilityLabel="Voltar às conversas"
          >
            <IconChevronLeft color="#FFFFFF" size={22} />
          </Pressable>

          <Pressable
            onPress={openProfile}
            disabled={!isGroup && !conversation?.peer_user_id}
            style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.92 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel={isGroup ? `Ver grupo ${peerName}` : `Ver perfil de ${peerName}`}
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

          {!isGroup ? (
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
          ) : null}
            </>
          )}
        </View>
      </WaveHeader>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        style={styles.flex}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onContentSizeChange={() => {
          if (messages.length > 0) {
            listRef.current?.scrollToEnd({ animated: false });
          }
        }}
        ListEmptyComponent={
          emptyHint ? (
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted, textAlign: 'center' }]}>
              {emptyHint}
            </Text>
          ) : null
        }
        renderItem={({ item }) => {
          const mine = item.sender_id === user?.id;
          const selected = selecting && selectedIds.has(item.id);
          const bubbleInner = (
            <>
              {!mine && isGroup ? (
                <Text
                  style={[
                    theme.typography.caption,
                    {
                      color: theme.colors.brand.solid,
                      fontWeight: '700',
                      marginBottom: 4,
                    },
                  ]}
                >
                  {senderNames[item.sender_id] ?? 'Alguém'}
                </Text>
              ) : null}
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
          const bubble = mine ? (
            <LinearGradient
              colors={[...theme.gradient.colors]}
              locations={[...theme.gradient.locations]}
              start={theme.gradient.start}
              end={theme.gradient.end}
              style={[styles.bubble, { borderBottomRightRadius: 10 }]}
            >
              {bubbleInner}
            </LinearGradient>
          ) : (
            <View
              style={[
                styles.bubble,
                theme.shadows.soft,
                {
                  backgroundColor: theme.colors.surface,
                  borderBottomLeftRadius: 10,
                },
              ]}
            >
              {bubbleInner}
            </View>
          );
          return (
            <Pressable
              onLongPress={() => enterSelect(item.id)}
              onPress={() => {
                if (selecting) toggleSelect(item.id);
              }}
              delayLongPress={280}
              accessibilityRole="button"
              accessibilityLabel={selected ? 'Mensagem selecionada' : 'Mensagem'}
              style={({ pressed }) => [
                styles.bubbleRow,
                {
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  opacity: pressed ? 0.92 : 1,
                  backgroundColor: selected ? 'rgba(47,107,255,0.12)' : 'transparent',
                  borderRadius: 24,
                },
              ]}
            >
              {selecting ? (
                <View
                  style={[
                    styles.selDot,
                    {
                      borderColor: selected ? theme.colors.brand.solid : theme.colors.borderSubtle,
                      backgroundColor: selected ? theme.colors.brand.solid : 'transparent',
                    },
                  ]}
                >
                  {selected ? (
                    <Text style={{ color: theme.colors.textOnBrand, fontWeight: '700', fontSize: 12 }}>✓</Text>
                  ) : null}
                </View>
              ) : null}
              {bubble}
            </Pressable>
          );
        }}
      />

      {!selecting ? (
      <View
        style={{
          marginHorizontal: 14,
          marginBottom: keyboardInset > 0 ? keyboardInset : 10 + Math.max(insets.bottom, 8),
        }}
      >
        <SoftGlass theme={theme} radius={28} contentStyle={styles.composer}>
          <TextInput
            style={[
              theme.typography.body,
              styles.input,
              {
                backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                color: theme.colors.textPrimary,
                borderRadius: 22,
              },
            ]}
            placeholder="Mensagem…"
            placeholderTextColor={theme.colors.placeholder}
            value={body}
            onChangeText={setBody}
            editable={!sending}
            multiline
            maxLength={4000}
            textAlignVertical="top"
            scrollEnabled
            blurOnSubmit={false}
            onFocus={() => {
              restingWindowHeight.current = Math.max(
                restingWindowHeight.current,
                Dimensions.get('window').height,
              );
              if (Platform.OS === 'android') setKeyboardInset(128);
              listRef.current?.scrollToEnd({ animated: true });
            }}
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
      ) : null}

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
    </View>
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
  bubbleRow: {
    maxWidth: '92%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 2,
  },
  selDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    maxWidth: '100%',
    flexShrink: 1,
  },
  composer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 132,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  send: {
    minHeight: 44,
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
