import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useAuth } from '../../../src/lib/auth';
import { useChatInbox } from '../../../src/lib/chat-inbox';
import {
  createResenhaChatGroup,
  findResenhaOriginGroup,
  friendlyGroupResenhaError,
  linkGroupResenha,
  listGroupsCoveringResenha,
} from '../../../src/lib/group-resenhas';
import { persistGroupLocally } from '../../../src/lib/groups';
import { openGoogleMaps } from '../../../src/lib/maps';
import {
  cancelResenha,
  friendlyResenhaError,
  getResenha,
  notifyResenhaGuests,
} from '../../../src/lib/resenhas';
import { displayNameFor } from '../../../src/lib/invites';
import type { ChatGroup } from '../../../src/types/group';
import {
  formatResenhaDateTime,
  resenhaIconEmoji,
  type Resenha,
} from '../../../src/types/resenha';
import {
  ResenhaMap,
  SoftButton,
  SoftEmptyState,
  SoftInput,
  SoftListRow,
  useDialog,
  useGlassChrome,
} from '../../../src/soft-ui';
import { themeFromScheme } from '../../../src/soft-ui/theme';

export default function ResenhaDetailScreen() {
  const theme = themeFromScheme(useColorScheme());
  const chrome = useGlassChrome();
  const { show } = useDialog();
  const { user } = useAuth();
  const { bump, refresh } = useChatInbox();
  const router = useRouter();
  const navigation = useNavigation();
  const { resenhaId } = useLocalSearchParams<{ resenhaId: string }>();
  const [item, setItem] = useState<Resenha | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelStep, setCancelStep] = useState<'ask' | 'write'>('ask');
  const [notice, setNotice] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatName, setChatName] = useState('');
  const [matchingGroups, setMatchingGroups] = useState<ChatGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);

  const load = useCallback(async () => {
    if (!resenhaId) return;
    setLoading(true);
    setError(null);
    try {
      const row = await getResenha(String(resenhaId));
      setItem(row);
      if (row) {
        navigation.setOptions({ title: row.name });
        try {
          const geo = await Location.reverseGeocodeAsync({
            latitude: row.latitude,
            longitude: row.longitude,
          });
          const first = geo[0];
          if (first) {
            const bits = [first.street, first.district, first.city, first.region].filter(Boolean);
            setPlace(bits.join(', ') || null);
          }
        } catch {
          setPlace(null);
        }
      }
    } catch (e) {
      setError(friendlyResenhaError(e));
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [resenhaId, navigation]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const isHost = Boolean(user && item && item.host_id === user.id);

  const openChat = async () => {
    if (!item || chatBusy) return;
    setChatBusy(true);
    try {
      const origin = await findResenhaOriginGroup(item.id);
      if (origin) {
        await persistGroupLocally(origin);
        await refresh();
        bump();
        router.push(`/(app)/chat/${origin.id}`);
        return;
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const missing = /schema cache|does not exist|could not find the function|resenha_origin_chat_group/i.test(raw);
      if (!missing) {
        show({ title: 'Chat', message: friendlyGroupResenhaError(e) });
        return;
      }
    } finally {
      setChatBusy(false);
    }
    setChatName(item.name.slice(0, 80));
    setMatchingGroups([]);
    setChatOpen(true);
    setLoadingGroups(true);
    try {
      setMatchingGroups(await listGroupsCoveringResenha(item.id));
    } catch (e) {
      show({ title: 'Chat', message: friendlyGroupResenhaError(e) });
    } finally {
      setLoadingGroups(false);
    }
  };

  const openGroupChat = async (group: ChatGroup) => {
    if (!item || chatBusy) return;
    setChatBusy(true);
    try {
      await linkGroupResenha(group.id, item.id);
      await persistGroupLocally(group);
      await refresh();
      bump();
      setChatOpen(false);
      router.push(`/(app)/chat/${group.id}`);
    } catch (e) {
      show({ title: 'Não foi possível abrir o grupo', message: friendlyGroupResenhaError(e) });
    } finally {
      setChatBusy(false);
    }
  };

  const createGroupChat = async () => {
    if (!item || chatBusy) return;
    const name = chatName.trim();
    if (name.length < 2) return;
    setChatBusy(true);
    try {
      const group = await createResenhaChatGroup({
        resenhaId: item.id,
        name,
        description: `Chat da resenha ${item.name}`.slice(0, 500),
      });
      await refresh();
      bump();
      setChatOpen(false);
      router.push(`/(app)/chat/${group.id}`);
    } catch (e) {
      show({ title: 'Não foi possível criar o grupo', message: friendlyGroupResenhaError(e) });
    } finally {
      setChatBusy(false);
    }
  };

  const openCancel = () => {
    if (!item) return;
    setCancelStep('ask');
    setNotice(`A resenha "${item.name}" (${formatResenhaDateTime(item.occurs_at)}) foi desmarcada.`);
    setCancelOpen(true);
  };

  const finishCancel = async (inform: boolean) => {
    if (!item || !user || cancelling) return;
    setCancelling(true);
    try {
      if (inform) {
        const guests = (item.members ?? []).map((member) => member.user_id).filter((id) => id !== user.id);
        await notifyResenhaGuests(user.id, guests, notice);
        bump();
      }
      await cancelResenha(item.id);
      setCancelOpen(false);
      router.replace('/(app)/resenhas');
    } catch (e) {
      show({ title: 'Não foi possível desmarcar', message: friendlyResenhaError(e) });
    } finally {
      setCancelling(false);
    }
  };

  if (loading && !item) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.brand.solid} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <SoftEmptyState
          theme={theme}
          title="Resenha não encontrada"
          description={error ?? 'Esse encontro não existe ou você não faz parte dele.'}
        />
      </View>
    );
  }

  const members = [...(item.members ?? [])].sort((a, b) => {
    if (a.role === b.role) return 0;
    return a.role === 'host' ? -1 : 1;
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={[
        styles.scroll,
        { paddingHorizontal: theme.screenPadding.horizontal, paddingBottom: chrome.tabClearance },
      ]}
    >
      <View style={[styles.hero, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg }]}>
        <Text style={styles.emoji}>{resenhaIconEmoji(item.icon, item.icon_emoji)}</Text>
        <Text style={[theme.typography.heading, { color: theme.colors.textPrimary, textAlign: 'center' }]}>
          {item.name}
        </Text>
        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8 },
          ]}
        >
          {formatResenhaDateTime(item.occurs_at)}
        </Text>
      </View>

      <View style={{ marginTop: 16 }}>
        <SoftButton theme={theme} label="Chat" onPress={() => void openChat()} loading={chatBusy && !chatOpen} />
      </View>

      <Text style={[theme.typography.label, styles.section, { color: theme.colors.textSecondary }]}>
        Local
      </Text>
      <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
        {place ?? 'Ponto marcado no mapa'}
      </Text>
      <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>
        {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
      </Text>
      <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 6 }]}>
        Toque no mapa para abrir no Google Maps.
      </Text>
      <View
        collapsable={false}
        style={[
          styles.mapWrap,
          { borderRadius: theme.radii.lg, marginTop: 12, backgroundColor: theme.colors.surface },
        ]}
      >
        <ResenhaMap
          latitude={item.latitude}
          longitude={item.longitude}
          height={280}
          pinDraggable={false}
          onPress={() => {
            void openGoogleMaps(item.latitude, item.longitude).catch((e) => {
              show({
                title: 'Google Maps',
                message: e instanceof Error ? e.message : 'Não foi possível abrir o mapa.',
              });
            });
          }}
        />
      </View>

      <Text style={[theme.typography.label, styles.section, { color: theme.colors.textSecondary }]}>
        Galera ({members.length})
      </Text>
      <View style={{ gap: 10 }}>
        {members.map((member) => {
          const profile = member.profile;
          const title = profile?.display_name ?? displayNameFor(profile);
          return (
            <SoftListRow
              key={member.user_id}
              theme={theme}
              title={title}
              subtitle={member.role === 'host' ? 'Organizou o rolê' : displayNameFor(profile)}
              avatarUri={profile?.avatar_url}
            />
          );
        })}
      </View>

      {isHost ? (
        <View style={{ marginTop: 28 }}>
          <SoftButton theme={theme} variant="danger" label="Desmarcar resenha" onPress={openCancel} />
        </View>
      ) : null}

      <Modal
        visible={chatOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!chatBusy) setChatOpen(false);
        }}
      >
        <View style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (!chatBusy) setChatOpen(false);
            }}
          />
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radii.xl,
                ...theme.shadows.softStrong,
              },
            ]}
          >
            <Text style={[theme.typography.heading, { color: theme.colors.textPrimary, textAlign: 'center' }]}>
              Chat da resenha
            </Text>
            <Text
              style={[
                theme.typography.body,
                { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8, marginBottom: 14 },
              ]}
            >
              Criar um grupo com todos os participantes desta resenha?
            </Text>
            <SoftInput
              theme={theme}
              placeholder="Nome do grupo"
              value={chatName}
              onChangeText={setChatName}
              maxLength={80}
              editable={!chatBusy}
            />
            <View style={{ marginTop: 14 }}>
              <SoftButton
                theme={theme}
                label="Criar grupo"
                onPress={() => void createGroupChat()}
                loading={chatBusy}
                disabled={chatBusy || chatName.trim().length < 2}
              />
            </View>
            {loadingGroups ? (
              <ActivityIndicator color={theme.colors.brand.solid} style={{ marginTop: 18 }} />
            ) : matchingGroups.length > 0 ? (
              <View style={{ marginTop: 18, gap: 10 }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  Ou reaproveitar um grupo que já tem todos estes participantes
                </Text>
                <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={{ gap: 10 }}>
                  {matchingGroups.map((group) => (
                    <SoftListRow
                      key={group.id}
                      theme={theme}
                      title={group.name}
                      subtitle={group.description?.trim() || 'Grupo existente'}
                      avatarUri={group.avatar_url}
                      disabled={chatBusy}
                      onPress={() => void openGroupChat(group)}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}
            <View style={{ marginTop: 10 }}>
              <SoftButton
                theme={theme}
                variant="ghost"
                label="Cancelar"
                onPress={() => setChatOpen(false)}
                disabled={chatBusy}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={cancelOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!cancelling) setCancelOpen(false);
        }}
      >
        <View style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (!cancelling) setCancelOpen(false);
            }}
          />
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radii.xl,
                ...theme.shadows.softStrong,
              },
            ]}
          >
            <Text style={[theme.typography.heading, { color: theme.colors.textPrimary, textAlign: 'center' }]}>
              Desmarcar resenha?
            </Text>
            {cancelStep === 'ask' ? (
              <Text
                style={[
                  theme.typography.body,
                  { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8 },
                ]}
              >
                Deseja informar as pessoas que estavam vinculadas a esta resenha?
              </Text>
            ) : (
              <>
                <Text
                  style={[
                    theme.typography.caption,
                    { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8, marginBottom: 12 },
                  ]}
                >
                  Essa mensagem segue no chat de cada participante.
                </Text>
                <TextInput
                  value={notice}
                  onChangeText={setNotice}
                  editable={!cancelling}
                  multiline
                  style={[
                    theme.typography.body,
                    styles.notice,
                    {
                      color: theme.colors.textPrimary,
                      backgroundColor: theme.colors.background,
                      borderRadius: theme.radii.lg,
                    },
                  ]}
                />
              </>
            )}
            <View style={{ gap: 10, marginTop: 18 }}>
              {cancelStep === 'ask' ? (
                <>
                  <SoftButton theme={theme} label="Sim, avisar" onPress={() => setCancelStep('write')} disabled={cancelling} />
                  <SoftButton
                    theme={theme}
                    variant="danger"
                    label="Não, só desmarcar"
                    onPress={() => void finishCancel(false)}
                    loading={cancelling}
                    disabled={cancelling}
                  />
                </>
              ) : (
                <SoftButton
                  theme={theme}
                  label="Enviar e desmarcar"
                  onPress={() => void finishCancel(true)}
                  loading={cancelling}
                  disabled={cancelling || notice.trim().length < 1}
                />
              )}
              <SoftButton
                theme={theme}
                variant="ghost"
                label="Voltar"
                onPress={() => {
                  if (cancelStep === 'write') setCancelStep('ask');
                  else setCancelOpen(false);
                }}
                disabled={cancelling}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingTop: 16 },
  hero: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  emoji: { fontSize: 48, marginBottom: 8 },
  section: { marginTop: 24, marginBottom: 8 },
  mapWrap: { overflow: 'hidden', height: 280, width: '100%' },
  overlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  card: { paddingHorizontal: 22, paddingVertical: 24 },
  notice: { minHeight: 96, paddingHorizontal: 14, paddingVertical: 12, textAlignVertical: 'top' },
});
