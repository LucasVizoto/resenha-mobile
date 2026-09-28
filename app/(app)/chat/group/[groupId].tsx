import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  addChatGroupMembers,
  fetchChatGroup,
  friendlyGroupError,
  leaveChatGroup,
  listGroupMembers,
} from '../../../../src/lib/groups';
import { listMyContacts } from '../../../../src/lib/contacts';
import { displayNameFor } from '../../../../src/lib/invites';
import { useAuth } from '../../../../src/lib/auth';
import { useChatInbox } from '../../../../src/lib/chat-inbox';
import { deleteConversationLocally } from '../../../../src/lib/db/messages';
import type { ChatGroup, ChatGroupMember } from '../../../../src/types/group';
import type { Profile } from '../../../../src/types/profile';
import {
  IconChevronLeft,
  SoftAvatar,
  SoftButton,
  SoftEmptyState,
  SoftListRow,
  WaveHeader,
  useDialog,
  useGlassChrome,
} from '../../../../src/soft-ui';
import { themeFromScheme } from '../../../../src/soft-ui/theme';

export default function GroupProfileScreen() {
  const theme = themeFromScheme(useColorScheme());
  const chrome = useGlassChrome();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { show } = useDialog();
  const { user } = useAuth();
  const { bump } = useChatInbox();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const [group, setGroup] = useState<ChatGroup | null>(null);
  const [members, setMembers] = useState<ChatGroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [wipeLocal, setWipeLocal] = useState(false);
  const [saving, setSaving] = useState(false);

  const memberIds = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);
  const addable = useMemo(
    () => contacts.filter((c) => !memberIds.has(c.id)),
    [contacts, memberIds],
  );

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    setError(null);
    try {
      const row = await fetchChatGroup(groupId);
      setGroup(row);
      setMembers(row ? await listGroupMembers(row.id) : []);
    } catch (e) {
      setError(friendlyGroupError(e));
      setGroup(null);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openAdd = async () => {
    if (!user) return;
    setAddOpen(true);
    setPicked(new Set());
    setLoadingContacts(true);
    try {
      setContacts(await listMyContacts(user.id));
    } catch {
      setContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  };

  const togglePick = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submitAdd = async () => {
    if (!group || picked.size === 0 || saving) return;
    setSaving(true);
    try {
      await addChatGroupMembers(group.id, [...picked]);
      setAddOpen(false);
      setPicked(new Set());
      await load();
      bump();
    } catch (e) {
      show({ title: 'Não foi possível adicionar', message: friendlyGroupError(e) });
    } finally {
      setSaving(false);
    }
  };

  const submitLeave = async () => {
    if (!group || saving) return;
    setSaving(true);
    try {
      await leaveChatGroup(group.id);
      if (wipeLocal) {
        await deleteConversationLocally(group.id);
      }
      setLeaveOpen(false);
      bump();
      router.replace('/(app)/chat');
    } catch (e) {
      show({ title: 'Não foi possível sair', message: friendlyGroupError(e) });
    } finally {
      setSaving(false);
    }
  };

  if (loading && !group) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.brand.solid} />
      </View>
    );
  }

  if (!group) {
    return (
      <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
        <WaveHeader theme={theme} height={110}>
          <Pressable onPress={() => router.back()} style={styles.headerIconBtn}>
            <IconChevronLeft color="#FFFFFF" size={22} />
          </Pressable>
        </WaveHeader>
        <SoftEmptyState
          theme={theme}
          title="Grupo não encontrado"
          description={error ?? 'Não foi possível carregar este grupo.'}
        />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <WaveHeader theme={theme} height={110}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.headerIconBtn} accessibilityLabel="Voltar">
            <IconChevronLeft color="#FFFFFF" size={22} />
          </Pressable>
          <Text style={[theme.typography.heading, { color: '#FFFFFF', flex: 1 }]} numberOfLines={1}>
            Grupo
          </Text>
        </View>
      </WaveHeader>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.screenPadding.horizontal,
          gap: theme.spacing.md,
          paddingBottom: chrome.tabClearance + 24,
        }}
      >
        <View style={styles.hero}>
          <SoftAvatar theme={theme} uri={group.avatar_url} name={group.name} size={96} />
          <Text
            style={[
              theme.typography.heading,
              { color: theme.colors.textPrimary, marginTop: 14, textAlign: 'center' },
            ]}
          >
            {group.name}
          </Text>
        </View>

        <View
          style={[
            styles.field,
            { backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg, ...theme.shadows.soft },
          ]}
        >
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Nome</Text>
          <Text style={[theme.typography.body, { color: theme.colors.textPrimary, marginTop: 4 }]}>
            {group.name}
          </Text>
        </View>

        <View
          style={[
            styles.field,
            { backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg, ...theme.shadows.soft },
          ]}
        >
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Descrição</Text>
          <Text style={[theme.typography.body, { color: theme.colors.textPrimary, marginTop: 4 }]}>
            {group.description?.trim() ? group.description : 'Sem descrição'}
          </Text>
        </View>

        <SoftButton
          theme={theme}
          label="Abrir conversa"
          onPress={() => router.replace(`/(app)/chat/${group.id}`)}
        />
        <SoftButton theme={theme} variant="secondary" label="Adicionar pessoas" onPress={() => void openAdd()} />
        <SoftButton
          theme={theme}
          variant="danger"
          label="Sair do grupo"
          onPress={() => {
            setWipeLocal(false);
            setLeaveOpen(true);
          }}
        />

        <Text style={[theme.typography.bodyMedium, { color: theme.colors.textPrimary, marginTop: 8 }]}>
          Participantes ({members.length})
        </Text>
        {members.length === 0 ? (
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            Nenhum participante carregado.
          </Text>
        ) : null}
        {members.map((member) => {
          const name = displayNameFor(member.profile);
          const isMe = member.user_id === user?.id;
          return (
            <SoftListRow
              key={member.user_id}
              theme={theme}
              title={isMe ? `${name} (você)` : name}
              subtitle={member.role === 'owner' ? 'Administrador' : 'Membro'}
              avatarUri={member.profile?.avatar_url}
              onPress={
                isMe ? undefined : () => router.push(`/(app)/chat/profile/${member.user_id}`)
              }
            />
          );
        })}
      </ScrollView>

      <Modal visible={addOpen} animationType="slide" transparent onRequestClose={() => setAddOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable
            style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]}
            onPress={() => setAddOpen(false)}
          />
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
              Adicionar pessoas
            </Text>
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.textSecondary, marginTop: 6, marginBottom: theme.spacing.md },
              ]}
            >
              Só entram contatos que ainda não estão no grupo.
            </Text>
            {loadingContacts ? (
              <ActivityIndicator color={theme.colors.brand.solid} style={{ marginVertical: 24 }} />
            ) : (
              <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: theme.spacing.sm }}>
                {addable.length === 0 ? (
                  <SoftEmptyState
                    theme={theme}
                    title="Ninguém para adicionar"
                    description="Todos os seus contatos já estão no grupo, ou você ainda não tem contatos."
                  />
                ) : (
                  addable.map((item) => {
                    const on = picked.has(item.id);
                    return (
                      <SoftListRow
                        key={item.id}
                        theme={theme}
                        title={item.display_name ?? displayNameFor(item)}
                        subtitle={item.username ? `@${item.username.replace(/^@/, '')}` : item.email}
                        avatarUri={item.avatar_url}
                        onPress={() => togglePick(item.id)}
                        right={
                          <View
                            style={[
                              styles.check,
                              {
                                borderColor: on ? theme.colors.brand.solid : theme.colors.borderSubtle,
                                backgroundColor: on ? theme.colors.brand.solid : 'transparent',
                              },
                            ]}
                          >
                            {on ? (
                              <Text style={{ color: theme.colors.textOnBrand, fontWeight: '700' }}>✓</Text>
                            ) : null}
                          </View>
                        }
                      />
                    );
                  })
                )}
              </ScrollView>
            )}
            <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.sm }}>
              <SoftButton
                theme={theme}
                label={picked.size === 0 ? 'Adicionar' : `Adicionar (${picked.size})`}
                onPress={() => void submitAdd()}
                loading={saving}
                disabled={picked.size === 0 || saving}
              />
              <SoftButton theme={theme} variant="ghost" label="Fechar" onPress={() => setAddOpen(false)} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={leaveOpen} transparent animationType="fade" onRequestClose={() => setLeaveOpen(false)}>
        <View style={[styles.leaveOverlay, { backgroundColor: theme.colors.overlay }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setLeaveOpen(false)} />
          <View
            style={[
              styles.leaveCard,
              {
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radii.xl,
                ...theme.shadows.softStrong,
              },
            ]}
          >
            <Text style={[theme.typography.heading, { color: theme.colors.textPrimary, textAlign: 'center' }]}>
              Sair do grupo?
            </Text>
            <Text
              style={[
                theme.typography.body,
                {
                  color: theme.colors.textSecondary,
                  textAlign: 'center',
                  marginTop: theme.spacing.sm,
                },
              ]}
            >
              Você deixa de receber mensagens novas deste grupo.
            </Text>
            <Pressable
              onPress={() => setWipeLocal((v) => !v)}
              style={styles.leaveCheckRow}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: wipeLocal }}
            >
              <View
                style={[
                  styles.check,
                  {
                    borderColor: wipeLocal ? theme.colors.brand.solid : theme.colors.borderSubtle,
                    backgroundColor: wipeLocal ? theme.colors.brand.solid : 'transparent',
                  },
                ]}
              >
                {wipeLocal ? (
                  <Text style={{ color: theme.colors.textOnBrand, fontWeight: '700' }}>✓</Text>
                ) : null}
              </View>
              <Text style={[theme.typography.body, { color: theme.colors.textPrimary, flex: 1 }]}>
                Sair e apagar as mensagens neste aparelho
              </Text>
            </Pressable>
            <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
              <SoftButton
                theme={theme}
                variant="danger"
                label={wipeLocal ? 'Sair e apagar' : 'Sair do grupo'}
                onPress={() => void submitLeave()}
                loading={saving}
                disabled={saving}
              />
              <SoftButton theme={theme} variant="ghost" label="Cancelar" onPress={() => setLeaveOpen(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', paddingVertical: 12 },
  field: { paddingHorizontal: 16, paddingVertical: 14 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 24,
    maxHeight: '86%',
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  leaveCard: {
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  leaveCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
  },
});
