import { useCallback, useState } from 'react';
import { useColorScheme } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { AccountScreen, useDialog } from '../../../src/soft-ui';
import type { ProfileFormValues } from '../../../src/types/profile';
import { themeFromScheme } from '../../../src/soft-ui/theme';
import { useAuth } from '../../../src/lib/auth';
import {
  fetchMyProfile,
  friendlyProfileError,
  profileFromAuthUser,
  upsertMyProfile,
  validateProfileForm,
} from '../../../src/lib/profile';
import { friendlyStorageError, uploadProfileAvatar } from '../../../src/lib/storage';
import type { Profile } from '../../../src/types/profile';

export default function AccountRoute() {
  const theme = themeFromScheme(useColorScheme());
  const { user, signOut, updateEmail } = useAuth();
  const { show } = useDialog();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(() =>
    user ? profileFromAuthUser(user) : null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(undefined);
    const fallback = profileFromAuthUser(user);
    try {
      const row = await fetchMyProfile(user.id);
      setProfile(row ? { ...fallback, ...row, email: row.email ?? fallback.email } : fallback);
    } catch (e) {
      setProfile(fallback);
      setError(friendlyProfileError(e));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const pickAndUpload = async (fromCamera: boolean) => {
    if (!user) return;
    setError(undefined);
    setNotice(undefined);
    try {
      if (fromCamera) {
        const cam = await ImagePicker.requestCameraPermissionsAsync();
        if (!cam.granted) {
          setError('Permissão da câmera negada.');
          return;
        }
      } else {
        const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!lib.granted) {
          setError('Permissão da galeria negada.');
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
      setUploadingAvatar(true);
      const saved = await uploadProfileAvatar({
        userId: user.id,
        uri: asset.uri,
        mimeType: asset.mimeType,
        base64: asset.base64,
      });
      setProfile((prev) => ({ ...(prev ?? profileFromAuthUser(user)), ...saved }));
      setNotice('Foto de perfil atualizada.');
    } catch (e) {
      const message = friendlyStorageError(e) || friendlyProfileError(e);
      setError(message);
      show({ title: 'Foto de perfil', message });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const onChangeAvatar = () => {
    show({
      title: 'Foto de perfil',
      message: 'Escolha uma imagem.',
      actions: [
        { label: 'Galeria', onPress: () => pickAndUpload(false) },
        { label: 'Câmera', variant: 'secondary', onPress: () => pickAndUpload(true) },
        { label: 'Cancelar', variant: 'ghost' },
      ],
    });
  };

  const onSave = async (form: ProfileFormValues) => {
    if (!user) return;
    setError(undefined);
    setNotice(undefined);
    const parsed = validateProfileForm(form);
    if (!parsed.ok || !parsed.values) {
      setError(parsed.error);
      return;
    }
    setSaving(true);
    try {
      const saved = await upsertMyProfile(user.id, parsed.values, {
        avatar_url: profile?.avatar_url,
      });
      setProfile((prev) => ({
        ...(prev ?? saved),
        ...saved,
        avatar_url: saved.avatar_url ?? prev?.avatar_url ?? null,
      }));
      if (parsed.values.email !== user.email) {
        await updateEmail(parsed.values.email);
        setNotice(`Enviamos um e-mail de confirmação para ${parsed.values.email}.`);
      } else {
        setNotice('Perfil atualizado.');
      }
    } catch (e) {
      setError(friendlyProfileError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccountScreen
      colorScheme={theme.mode}
      profile={profile}
      authEmail={user?.email}
      pendingEmail={user?.new_email}
      loading={loading}
      saving={saving}
      error={error}
      notice={notice}
      onSave={onSave}
      uploadingAvatar={uploadingAvatar}
      onChangeAvatar={onChangeAvatar}
      signingOut={signingOut}
      onSignOut={() => {
        show({
          title: 'Encerrar sessão',
          message: 'Deseja sair da sua conta neste aparelho?',
          actions: [
            {
              label: 'Sair',
              variant: 'danger',
              onPress: async () => {
                setSigningOut(true);
                try {
                  await signOut();
                } catch (e) {
                  setError(friendlyProfileError(e));
                } finally {
                  setSigningOut(false);
                  router.replace('/(auth)/login');
                }
              },
            },
            { label: 'Cancelar', variant: 'ghost' },
          ],
        });
      }}
    />
  );
}
