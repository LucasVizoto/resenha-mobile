import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SoftButton } from '../components/SoftButton';
import { SoftInput } from '../components/SoftInput';
import { WaveHeader } from '../components/WaveHeader';
import { SoftAvatar } from '../components/SoftAvatar';
import { IconAt, IconEnvelope, IconPhone, IconUser } from '../components/SoftIcons';
import { getTheme } from '../theme';
import { useGlassChrome } from '../chrome';
import type { Profile, ProfileFormValues } from '../../types/profile';

export type { ProfileFormValues };

export type AccountScreenProps = {
  colorScheme?: 'light' | 'dark';
  profile: Profile | null;
  authEmail?: string | null;
  pendingEmail?: string | null;
  loading?: boolean;
  saving?: boolean;
  signingOut?: boolean;
  uploadingAvatar?: boolean;
  error?: string;
  notice?: string;
  onSave?: (payload: ProfileFormValues) => void | Promise<void>;
  onChangeAvatar?: () => void | Promise<void>;
  onSignOut?: () => void | Promise<void>;
};

function splitDisplayName(display?: string | null) {
  const parts = (display ?? '').trim().split(/\s+/).filter(Boolean);
  return {
    first: parts[0] ?? '',
    last: parts.slice(1).join(' '),
  };
}

export function AccountScreen({
  colorScheme = 'light',
  profile,
  authEmail,
  pendingEmail,
  loading = false,
  saving = false,
  signingOut = false,
  uploadingAvatar = false,
  error,
  notice,
  onSave,
  onChangeAvatar,
  onSignOut,
}: AccountScreenProps) {
  const theme = getTheme(colorScheme);
  const chrome = useGlassChrome();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [instagram, setInstagram] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');

  useEffect(() => {
    const split = splitDisplayName(profile?.display_name);
    setFirstName(profile?.first_name ?? split.first);
    setLastName(profile?.last_name ?? split.last);
    setEmail(profile?.email ?? authEmail ?? '');
    setInstagram(profile?.instagram ? `@${profile.instagram.replace(/^@/, '')}` : '');
    setPhone(profile?.phone ?? '');
    setUsername(profile?.username ?? '');
  }, [profile, authEmail]);

  const displayName =
    [firstName, lastName].filter(Boolean).join(' ') || profile?.display_name || username || 'Conta';

  const handleSave = async () => {
    await onSave?.({
      first_name: firstName,
      last_name: lastName,
      email,
      instagram,
      phone,
      username,
    });
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.colors.background }]}
      edges={[]}
    >
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: chrome.tabClearance }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <WaveHeader theme={theme} height={132} title="Conta" subtitle="seu perfil" />

          <View
            style={[
              styles.body,
              { paddingHorizontal: theme.screenPadding.horizontal, gap: theme.spacing.lg },
            ]}
          >
            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={theme.colors.brand.solid} />
              </View>
            ) : null}
              <View style={styles.avatarBlock}>
                <SoftAvatar
                  theme={theme}
                  uri={profile?.avatar_url}
                  name={displayName}
                  size={88}
                  editable
                  uploading={uploadingAvatar}
                  onPress={onChangeAvatar}
                />
                <Text
                  style={[
                    theme.typography.caption,
                    { color: theme.colors.textSecondary, marginTop: theme.spacing.sm },
                  ]}
                >
                  {uploadingAvatar ? 'Enviando foto…' : 'Toque na foto para alterar'}
                </Text>
                <Text
                  style={[
                    theme.typography.heading,
                    { color: theme.colors.textPrimary, marginTop: theme.spacing.md },
                  ]}
                >
                  {displayName}
                </Text>
                {username ? (
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                    @{username}
                  </Text>
                ) : null}
              </View>

              {notice ? (
                <Text style={[theme.typography.caption, { color: theme.colors.brand.solid, textAlign: 'center' }]}>
                  {notice}
                </Text>
              ) : null}
              {pendingEmail ? (
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, textAlign: 'center' }]}>
                  Confirme o novo e-mail enviado para {pendingEmail}.
                </Text>
              ) : null}
              {error ? (
                <Text style={[theme.typography.caption, { color: theme.colors.danger, textAlign: 'center' }]}>
                  {error}
                </Text>
              ) : null}

              <View style={{ gap: theme.spacing.md }}>
                <SoftInput
                  theme={theme}
                  label="Nome"
                  placeholder="Seu nome"
                  value={firstName}
                  onChangeText={setFirstName}
                  editable={!saving}
                  autoComplete="given-name"
                  textContentType="givenName"
                  leftIcon={<IconUser color={theme.colors.textMuted} />}
                />
                <SoftInput
                  theme={theme}
                  label="Sobrenome"
                  placeholder="Seu sobrenome"
                  value={lastName}
                  onChangeText={setLastName}
                  editable={!saving}
                  autoComplete="family-name"
                  textContentType="familyName"
                  leftIcon={<IconUser color={theme.colors.textMuted} />}
                />
                <SoftInput
                  theme={theme}
                  label="E-mail"
                  placeholder="seu@email.com"
                  value={email}
                  onChangeText={setEmail}
                  editable={!saving}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                  leftIcon={<IconEnvelope color={theme.colors.textMuted} />}
                  hint="Se mudar o e-mail, enviaremos uma confirmação."
                />
                <SoftInput
                  theme={theme}
                  label="Arroba do Instagram"
                  placeholder="@seuusuario"
                  value={instagram}
                  onChangeText={setInstagram}
                  editable={!saving}
                  autoCapitalize="none"
                  leftIcon={<IconAt color={theme.colors.textMuted} />}
                />
                <SoftInput
                  theme={theme}
                  label="Telefone"
                  placeholder="(11) 99999-0000"
                  value={phone}
                  onChangeText={setPhone}
                  editable={!saving}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  leftIcon={<IconPhone color={theme.colors.textMuted} />}
                />
                <SoftInput
                  theme={theme}
                  label="Nome de usuário"
                  placeholder="usuario"
                  value={username}
                  onChangeText={setUsername}
                  editable={!saving}
                  autoCapitalize="none"
                  autoComplete="username"
                  textContentType="username"
                  leftIcon={<IconAt color={theme.colors.textMuted} />}
                />
              </View>

              <View style={{ gap: theme.spacing.md, paddingBottom: 24 }}>
                <SoftButton
                  theme={theme}
                  label="Salvar perfil"
                  onPress={handleSave}
                  loading={saving}
                  disabled={signingOut}
                />
                <SoftButton
                  theme={theme}
                  label="Encerrar sessão"
                  variant="danger"
                  onPress={onSignOut}
                  loading={signingOut}
                  disabled={saving}
                />
              </View>
            </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  body: { paddingTop: 4 },
  center: { paddingVertical: 8, alignItems: 'center' },
  avatarBlock: { alignItems: 'center', paddingTop: 4 },
});
