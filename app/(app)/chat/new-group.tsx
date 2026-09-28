import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../../src/lib/auth';
import { listMyContacts } from '../../../src/lib/contacts';
import { createChatGroup, friendlyGroupError, updateChatGroupAvatar } from '../../../src/lib/groups';
import { displayNameFor } from '../../../src/lib/invites';
import { useChatInbox } from '../../../src/lib/chat-inbox';
import { friendlyStorageError, uploadGroupAvatar } from '../../../src/lib/storage';
import type { Profile } from '../../../src/types/profile';
import {
  IconChevronLeft,
  SoftAvatar,
  SoftButton,
  SoftEmptyState,
  SoftInput,
  SoftListRow,
  WaveHeader,
  useDialog,
  useGlassChrome,
} from '../../../src/soft-ui';
import { themeFromScheme } from '../../../src/soft-ui/theme';

export default function NewGroupScreen() {
  const theme = themeFromScheme(useColorScheme());
  const chrome = useGlassChrome();
  const router = useRouter();
  const { show } = useDialog();
  const { user } = useAuth();
  const { refresh, bump } = useChatInbox();
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [photo, setPhoto] = useState<{ uri: string; mimeType?: string | null; base64?: string | null } | null>(
    null,
  );

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setContacts(await listMyContacts(user.id));
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pickPhoto = () => {
    show({
      title: 'Foto do grupo',
      message: 'Escolha uma imagem.',
      actions: [
        {
          label: 'Galeria',
          onPress: () => void pickFrom(false),
        },
        {
          label: 'Câmera',
          variant: 'secondary',
          onPress: () => void pickFrom(true),
        },
        { label: 'Cancelar', variant: 'ghost' },
      ],
    });
  };

  const pickFrom = async (fromCamera: boolean) => {
    try {
      if (fromCamera) {
        const cam = await ImagePicker.requestCameraPermissionsAsync();
        if (!cam.granted) {
          show({ title: 'Foto do grupo', message: 'Permissão da câmera negada.' });
          return;
        }
      } else {
        const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!lib.granted) {
          show({ title: 'Foto do grupo', message: 'Permissão da galeria negada.' });
          return;
        }
      }
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
            base64: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
            base64: true,
          });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      setPhoto({ uri: asset.uri, mimeType: asset.mimeType, base64: asset.base64 });
    } catch (e) {
      show({ title: 'Foto do grupo', message: friendlyStorageError(e) });
    }
  };

  const canCreate = name.trim().length >= 2 && selected.size > 0 && !saving;

  const create = async () => {
    if (!user || !canCreate) return;
    setSaving(true);
    try {
      const group = await createChatGroup({
        name: name.trim(),
        description: description.trim(),
        memberIds: [...selected],
      });
      if (photo) {
        try {
          const url = await uploadGroupAvatar({
            ownerId: user.id,
            groupId: group.id,
            uri: photo.uri,
            mimeType: photo.mimeType,
            base64: photo.base64,
          });
          await updateChatGroupAvatar(group.id, url);
        } catch (e) {
          show({
            title: 'Grupo criado',
            message: `O grupo existe, mas a foto não foi enviada. ${friendlyStorageError(e)}`,
          });
        }
      }
      await refresh();
      bump();
      router.replace(`/(app)/chat/${group.id}`);
    } catch (e) {
      show({ title: 'Não foi possível criar o grupo', message: friendlyGroupError(e) });
    } finally {
      setSaving(false);
    }
  };

  const selectedLabel = useMemo(() => {
    if (selected.size === 0) return 'Nenhum contato escolhido';
    if (selected.size === 1) return '1 pessoa';
    return `${selected.size} pessoas`;
  }, [selected.size]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]} edges={[]}>
      <StatusBar style="light" />
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
          <Text style={[theme.typography.heading, { color: '#FFFFFF', flex: 1 }]}>Novo grupo</Text>
        </View>
      </WaveHeader>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.brand.solid} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.screenPadding.horizontal,
            paddingBottom: chrome.tabClearance + 24,
            gap: theme.spacing.md,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <SoftAvatar
              theme={theme}
              uri={photo?.uri}
              name={name.trim() || 'Grupo'}
              accentColor={theme.colors.brand.solid}
              size={88}
              editable
              onPress={pickPhoto}
            />
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 8 }]}>
              Toque para escolher a foto
            </Text>
          </View>

          <SoftInput
            theme={theme}
            label="Nome"
            placeholder="Nome do grupo"
            value={name}
            onChangeText={setName}
            editable={!saving}
          />
          <SoftInput
            theme={theme}
            label="Descrição (opcional)"
            placeholder="Sobre o grupo"
            value={description}
            onChangeText={setDescription}
            editable={!saving}
          />

          <Text style={[theme.typography.bodyMedium, { color: theme.colors.textPrimary, marginTop: 8 }]}>
            Participantes
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            {selectedLabel}. Só entram pessoas da sua lista de contatos.
          </Text>

          {contacts.length === 0 ? (
            <SoftEmptyState
              theme={theme}
              title="Nenhum contato"
              description="Adicione contatos antes de criar um grupo."
            />
          ) : (
            <FlatList
              data={contacts}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={{ gap: theme.spacing.sm }}
              renderItem={({ item }) => {
                const on = selected.has(item.id);
                return (
                  <SoftListRow
                    theme={theme}
                    title={item.display_name ?? displayNameFor(item)}
                    subtitle={item.username ? `@${item.username.replace(/^@/, '')}` : item.email}
                    avatarUri={item.avatar_url}
                    onPress={() => toggle(item.id)}
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
              }}
            />
          )}

          <View style={{ marginTop: theme.spacing.md }}>
            <SoftButton
              theme={theme}
              label="Criar grupo"
              onPress={create}
              loading={saving}
              disabled={!canCreate}
            />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  hero: { alignItems: 'center', paddingTop: 4, paddingBottom: 8 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
