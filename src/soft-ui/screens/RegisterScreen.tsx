import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SoftButton } from '../components/SoftButton';
import { SoftInput } from '../components/SoftInput';
import { WaveHeader } from '../components/WaveHeader';
import { BrandLogo } from '../components/BrandLogo';
import { IconAt, IconEnvelope, IconLock, IconPhone, IconUser } from '../components/SoftIcons';
import { getTheme } from '../theme';
import {
  inspectPassword,
  PASSWORD_RULES,
  validatePasswordConfirmation,
  validateStrongPassword,
} from '../../lib/password';
import { validateSignupProfile } from '../../lib/profile';

export type RegisterPayload = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  username: string;
  instagram: string;
  phone: string;
};

export type RegisterScreenProps = {
  colorScheme?: 'light' | 'dark';
  onRegister?: (payload: RegisterPayload) => void | Promise<void>;
  onBackToLogin?: () => void;
  loading?: boolean;
  notice?: string;
};

export function RegisterScreen({
  colorScheme = 'light',
  onRegister,
  onBackToLogin,
  loading = false,
  notice,
}: RegisterScreenProps) {
  const theme = getTheme(colorScheme);
  const { height: screenH } = useWindowDimensions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [instagram, setInstagram] = useState('');
  const [phone, setPhone] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [usernameError, setUsernameError] = useState<string | undefined>();
  const [instagramError, setInstagramError] = useState<string | undefined>();
  const [phoneError, setPhoneError] = useState<string | undefined>();

  const strength = useMemo(() => inspectPassword(password), [password]);

  const handleRegister = async () => {
    setEmailError(undefined);
    setPasswordError(undefined);
    setConfirmError(undefined);
    setUsernameError(undefined);
    setInstagramError(undefined);
    setPhoneError(undefined);

    const trimmedEmail = email.trim();
    const profile = validateSignupProfile({
      email: trimmedEmail,
      first_name: firstName,
      last_name: lastName,
      username,
      instagram,
      phone,
    });
    if (!profile.ok) {
      const message = profile.error ?? 'Revise os dados do perfil.';
      if (/e-mail/i.test(message)) setEmailError(message);
      else if (/Usuário|usuário/i.test(message)) setUsernameError(message);
      else if (/Instagram/i.test(message)) setInstagramError(message);
      else if (/Telefone/i.test(message)) setPhoneError(message);
      else setUsernameError(message);
      return;
    }

    const weak = validateStrongPassword(password);
    if (weak) {
      setPasswordError(weak);
      return;
    }

    const mismatch = validatePasswordConfirmation(password, confirmPassword);
    if (mismatch) {
      setConfirmError(mismatch);
      return;
    }

    await onRegister?.({
      email: trimmedEmail,
      password,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      username: username.trim(),
      instagram: instagram.trim(),
      phone: phone.trim(),
    });
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <WaveHeader
            theme={theme}
            height={Math.max(176, screenH * 0.22)}
            title="Resenha"
            subtitle="o papo da galera"
          >
            <BrandLogo theme={theme} variant="mark" size={80} />
          </WaveHeader>

          <View
            style={[
              styles.body,
              { paddingHorizontal: theme.screenPadding.horizontal },
            ]}
          >
            <View style={styles.heading}>
              <Text style={[theme.typography.title, { color: theme.colors.textPrimary, textAlign: 'center' }]}>
                Crie sua conta
              </Text>
              <Text
                style={[
                  theme.typography.body,
                  { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8 },
                ]}
              >
                Entre na resenha e comece a conversar
              </Text>
              {notice ? (
                <Text
                  style={[
                    theme.typography.caption,
                    styles.notice,
                    { color: theme.colors.danger },
                  ]}
                >
                  {notice}
                </Text>
              ) : null}
            </View>

            <View style={[styles.fields, { gap: theme.spacing.md }]}>
              <SoftInput
                theme={theme}
                placeholder="E-mail"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                value={email}
                onChangeText={setEmail}
                editable={!loading}
                error={emailError}
                leftIcon={<IconEnvelope color={theme.colors.textMuted} />}
              />
              <SoftInput
                theme={theme}
                placeholder="Senha"
                autoComplete="new-password"
                textContentType="newPassword"
                value={password}
                onChangeText={setPassword}
                editable={!loading}
                error={passwordError}
                secureTextEntry
                passwordToggle
                leftIcon={<IconLock color={theme.colors.textMuted} />}
              />
              <View style={{ gap: 6, paddingHorizontal: 8 }}>
                {PASSWORD_RULES.map((rule) => {
                  const ok = strength[rule.key];
                  const idle = password.length === 0;
                  return (
                    <Text
                      key={rule.key}
                      style={[
                        theme.typography.caption,
                        {
                          color: idle
                            ? theme.colors.textMuted
                            : ok
                              ? theme.colors.brand.solid
                              : theme.colors.danger,
                        },
                      ]}
                    >
                      {ok && !idle ? '✓' : '•'} {rule.label}
                    </Text>
                  );
                })}
              </View>
              <SoftInput
                theme={theme}
                placeholder="Confirmar senha"
                autoComplete="new-password"
                textContentType="newPassword"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!loading}
                error={confirmError}
                secureTextEntry
                passwordToggle
                leftIcon={<IconLock color={theme.colors.textMuted} />}
              />
            </View>

            <View style={{ gap: 8 }}>
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.textPrimary }]}>
                Perfil (opcional)
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                Preencha agora ou complete depois na aba Conta.
              </Text>
            </View>

            <View style={[styles.fields, { gap: theme.spacing.md }]}>
              <SoftInput
                theme={theme}
                placeholder="Nome"
                autoComplete="given-name"
                textContentType="givenName"
                value={firstName}
                onChangeText={setFirstName}
                editable={!loading}
                leftIcon={<IconUser color={theme.colors.textMuted} />}
              />
              <SoftInput
                theme={theme}
                placeholder="Sobrenome"
                autoComplete="family-name"
                textContentType="familyName"
                value={lastName}
                onChangeText={setLastName}
                editable={!loading}
                leftIcon={<IconUser color={theme.colors.textMuted} />}
              />
              <SoftInput
                theme={theme}
                placeholder="Nome de usuário"
                autoCapitalize="none"
                autoComplete="username"
                textContentType="username"
                value={username}
                onChangeText={setUsername}
                editable={!loading}
                error={usernameError}
                leftIcon={<IconAt color={theme.colors.textMuted} />}
              />
              <SoftInput
                theme={theme}
                placeholder="@instagram"
                autoCapitalize="none"
                value={instagram}
                onChangeText={setInstagram}
                editable={!loading}
                error={instagramError}
                leftIcon={<IconAt color={theme.colors.textMuted} />}
              />
              <SoftInput
                theme={theme}
                placeholder="Telefone"
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                value={phone}
                onChangeText={setPhone}
                editable={!loading}
                error={phoneError}
                leftIcon={<IconPhone color={theme.colors.textMuted} />}
              />
            </View>

            <View style={[styles.actions, { gap: theme.spacing.md }]}>
              <SoftButton
                theme={theme}
                label="Cadastrar"
                onPress={handleRegister}
                loading={loading}
              />
              <View style={styles.footerRow}>
                <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
                  Já tem conta?{' '}
                </Text>
                <Pressable onPress={onBackToLogin} disabled={loading} hitSlop={8}>
                  <Text style={[theme.typography.bodyMedium, { color: theme.colors.brand.solid }]}>
                    Entrar
                  </Text>
                </Pressable>
              </View>
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
  body: {
    flexGrow: 1,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 22,
  },
  heading: { alignItems: 'center' },
  notice: {
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  fields: { width: '100%' },
  actions: { width: '100%', paddingBottom: 8 },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
});
