import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../../src/lib/auth';
import { upsertConversation } from '../../../src/lib/db/conversations';
import { cacheProfile } from '../../../src/lib/db/profiles';
import { listMyContacts } from '../../../src/lib/contacts';
import {
  displayNameFor,
  searchProfilesToAdd,
  sendContactInvite,
} from '../../../src/lib/invites';
import { useInvites } from '../../../src/lib/invites-context';
import type { Profile } from '../../../src/types/profile';
import type { ProfileSearchHit } from '../../../src/types/invite';
import {
  IconPlus,
  SoftButton,
  SoftEmptyState,
  SoftInput,
  SoftListRow,
  WaveHeader,
  useDialog,
  useGlassChrome,
} from '../../../src/soft-ui';
import { themeFromScheme } from '../../../src/soft-ui/theme';

export default function ContactsScreen() {
  const theme = themeFromScheme(useColorScheme());
  const insets = useSafeAreaInsets();
  const chrome = useGlassChrome();
  const { user } = useAuth();
  const { show } = useDialog();
  const { incoming, outgoingPendingIds, refresh: refreshInvites, accept, decline } = useInvites();
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ProfileSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchNotice, setSearchNotice] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [rows] = await Promise.all([listMyContacts(user.id), refreshInvites()]);
      setProfiles(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [user, refreshInvites]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => {
      const hay = `${p.display_name ?? ''} ${p.username ?? ''} ${p.first_name ?? ''} ${p.last_name ?? ''} ${p.email ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [profiles, query]);

  const openChat = async (p: Profile) => {
    if (!user) return;
    const id = [user.id, p.id].sort().join('_');
    const now = new Date().toISOString();
    await cacheProfile(p);
    await upsertConversation({
      id,
      title: p.display_name ?? p.username ?? 'Conversa',
      peer_user_id: p.id,
      peer_display_name: p.display_name ?? p.username,
      peer_avatar_url: p.avatar_url,
      updated_at: now,
    });
    router.push(`/(app)/chat/${id}`, { withAnchor: true });
  };

  const runSearch = async () => {
    if (!user) return;
    setSearching(true);
    setSearchError(null);
    setSearchNotice(null);
    try {
      const found = await searchProfilesToAdd(
        search,
        user.id,
        profiles.map((p) => p.id),
        outgoingPendingIds,
      );
      setResults(found);
      if (found.length === 0) {
        setSearchError('Nenhum usuário encontrado com esse username ou e-mail.');
      }
    } catch (e) {
      setResults([]);
      setSearchError(e instanceof Error ? e.message : String(e));
    } finally {
      setSearching(false);
    }
  };

  const confirmInvite = (p: ProfileSearchHit) => {
    if (p.alreadyContact || p.outgoingStatus === 'pending') return;
    const label = displayNameFor(p);
    show({
      title: 'Adicionar contato',
      message: `Deseja mesmo adicionar ${label} à lista de contatos? A pessoa vai receber um convite para aceitar ou recusar.`,
      actions: [
        { label: 'Enviar convite', onPress: () => sendInvite(p) },
        { label: 'Cancelar', variant: 'ghost' },
      ],
    });
  };

  const sendInvite = async (p: ProfileSearchHit) => {
    if (!user) return;
    setSendingId(p.id);
    setSearchError(null);
    setSearchNotice(null);
    try {
      await sendContactInvite(user.id, p);
      await refreshInvites();
      setResults((prev) =>
        prev.map((row) => (row.id === p.id ? { ...row, outgoingStatus: 'pending' } : row)),
      );
      setSearchNotice(`Convite enviado para ${displayNameFor(p)}.`);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : String(e));
    } finally {
      setSendingId(null);
    }
  };

  const onAccept = async (inviteId: string) => {
    try {
      await accept(inviteId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onDecline = async (inviteId: string) => {
    try {
      await decline(inviteId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]} edges={[]}>
      <StatusBar style="light" />
      <WaveHeader theme={theme} height={128} title="Contatos" subtitle="a galera" />
      <View style={[styles.searchWrap, { paddingHorizontal: theme.screenPadding.horizontal }]}>
        <SoftInput
          theme={theme}
          placeholder="Filtrar contatos"
          value={query}
          onChangeText={setQuery}
        />
      </View>
      {loading && profiles.length === 0 && incoming.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.brand.solid} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
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
          ListHeaderComponent={
            incoming.length === 0 ? null : (
              <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.sm }}>
                <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>
                  Convites recebidos
                </Text>
                {incoming.map((invite) => {
                  const from = invite.from_profile;
                  const name = displayNameFor(from);
                  return (
                    <SoftListRow
                      key={invite.id}
                      theme={theme}
                      title={from?.display_name ?? name}
                      subtitle={`${name} quer adicionar você`}
                      avatarUri={from?.avatar_url}
                      footer={
                        <View style={styles.inviteActions}>
                          <View style={styles.inviteBtn}>
                            <SoftButton
                              theme={theme}
                              label="Aceitar"
                              size="compact"
                              onPress={() => onAccept(invite.id)}
                              style={{ width: '100%' }}
                            />
                          </View>
                          <View style={styles.inviteBtn}>
                            <SoftButton
                              theme={theme}
                              label="Recusar"
                              variant="danger"
                              size="compact"
                              onPress={() => onDecline(invite.id)}
                              style={{ width: '100%' }}
                            />
                          </View>
                        </View>
                      }
                    />
                  );
                })}
                <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginTop: 8 }]}>
                  Seus contatos
                </Text>
              </View>
            )
          }
          ListEmptyComponent={
            incoming.length > 0 ? null : (
              <SoftEmptyState
                theme={theme}
                title="Nenhum contato"
                description={
                  error ??
                  'Toque em Adicionar e busque pelo username ou e-mail. A pessoa precisa aceitar o convite.'
                }
              />
            )
          }
          renderItem={({ item }) => (
            <SoftListRow
              theme={theme}
              title={item.display_name ?? item.username ?? item.id}
              subtitle={item.username ? `@${item.username}` : item.email ?? undefined}
              avatarUri={item.avatar_url}
              onPress={() => openChat(item)}
            />
          )}
        />
      )}

      <Pressable
        onPress={() => {
          setAddOpen(true);
          setSearchError(null);
          setSearchNotice(null);
        }}
        style={({ pressed }) => [
          styles.fab,
          theme.shadows.fab,
          { opacity: pressed ? 0.9 : 1, borderRadius: theme.radii.pill, bottom: chrome.tabClearance + 8 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Adicionar contato"
      >
        <LinearGradient
          colors={[...theme.gradient.colors]}
          locations={[...theme.gradient.locations]}
          start={theme.gradient.start}
          end={theme.gradient.end}
          style={[styles.fabInner, { borderRadius: theme.radii.pill }]}
        >
          <IconPlus color={theme.colors.textOnBrand} size={22} />
          <Text style={[theme.typography.button, { color: theme.colors.textOnBrand }]}>Adicionar</Text>
        </LinearGradient>
      </Pressable>

      <Modal visible={addOpen} animationType="slide" transparent onRequestClose={() => setAddOpen(false)}>
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
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
              Novo contato
            </Text>
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.textSecondary, marginTop: 6, marginBottom: theme.spacing.md },
              ]}
            >
              Pesquise pelo username ou e-mail. Depois confirme para enviar o convite.
            </Text>
            <SoftInput
              theme={theme}
              placeholder="@usuario ou email"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={runSearch}
            />
            <View style={{ marginTop: theme.spacing.md }}>
              <SoftButton theme={theme} label="Buscar" onPress={runSearch} loading={searching} />
            </View>
            {searchNotice ? (
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.brand.solid, marginTop: theme.spacing.sm, textAlign: 'center' },
                ]}
              >
                {searchNotice}
              </Text>
            ) : null}
            {searchError ? (
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.danger, marginTop: theme.spacing.sm, textAlign: 'center' },
                ]}
              >
                {searchError}
              </Text>
            ) : null}
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              style={{ marginTop: theme.spacing.md, maxHeight: 280 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const handle = displayNameFor(item);
                const busy = sendingId === item.id;
                const pending = item.outgoingStatus === 'pending';
                const already = item.alreadyContact;
                return (
                  <View style={{ marginBottom: 10 }}>
                    <SoftListRow
                      theme={theme}
                      title={item.display_name ?? handle}
                      subtitle={
                        already
                          ? 'Já está nos seus contatos'
                          : pending
                            ? 'Convite enviado — aguardando resposta'
                            : item.username
                              ? `@${item.username.replace(/^@/, '')}${item.email ? ` · ${item.email}` : ''}`
                              : item.email ?? undefined
                      }
                      avatarUri={item.avatar_url}
                      disabled={already || pending || busy}
                      onPress={already || pending || busy ? undefined : () => confirmInvite(item)}
                    />
                  </View>
                );
              }}
              ListEmptyComponent={
                searching ? (
                  <ActivityIndicator color={theme.colors.brand.solid} style={{ marginTop: 16 }} />
                ) : null
              }
            />
            <View style={{ marginTop: theme.spacing.md, marginBottom: 12 }}>
              <SoftButton theme={theme} variant="ghost" label="Fechar" onPress={() => setAddOpen(false)} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  searchWrap: { marginTop: -8, marginBottom: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingTop: 8, paddingBottom: 96, flexGrow: 1 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    overflow: 'hidden',
  },
  fabInner: {
    minHeight: 56,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 24,
    maxHeight: '86%',
  },
  inviteActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  inviteBtn: { flex: 1, minHeight: 48 },
});
