import React, { useState } from 'react';
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
import { GoogleButton } from '../components/GoogleButton';
import { IconEnvelope, IconLock } from '../components/SoftIcons';
import { getTheme } from '../theme';

export type LoginScreenProps = {
  /** Login do mockup é light; o prop só força dark se precisar. */
  colorScheme?: 'light' | 'dark';
  onLogin?: (payload: { email: string; password: string }) => void | Promise<void>;
  onSignUp?: () => void;
  onGoogle?: () => void | Promise<void>;
  onForgotPassword?: (email: string) => void | Promise<void>;
  loading?: boolean;
  notice?: string;
};

export function LoginScreen({
  colorScheme = 'light',
  onLogin,
  onSignUp,
  onGoogle,
  onForgotPassword,
  loading = false,
  notice,
}: LoginScreenProps) {
  const theme = getTheme(colorScheme);
  const { height: screenH } = useWindowDimensions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();

  const handleLogin = async () => {
    setError(undefined);
    if (!email.trim() || !password) {
      setError('Informe e-mail e senha.');
      return;
    }
    await onLogin?.({ email: email.trim(), password });
  };

  const handleForgot = async () => {
    setError(undefined);
    if (!email.trim()) {
      setError('Informe o e-mail para recuperar a senha.');
      return;
    }
    await onForgotPassword?.(email.trim());
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
            height={Math.max(248, screenH * 0.34)}
            title="Resenha"
            subtitle="o papo da galera"
          >
            <BrandLogo theme={theme} variant="mark" size={104} />
          </WaveHeader>

          <View
            style={[
              styles.body,
              { paddingHorizontal: theme.screenPadding.horizontal },
            ]}
          >
            <View style={styles.heading}>
              <Text style={[theme.typography.title, { color: theme.colors.textPrimary, textAlign: 'center' }]}>
                Bem-vindo de volta
              </Text>
              <Text
                style={[
                  theme.typography.body,
                  { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8 },
                ]}
              >
                Faça login para continuar conversando
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
                leftIcon={<IconEnvelope color={theme.colors.textMuted} />}
              />

              <SoftInput
                theme={theme}
                placeholder="Senha"
                autoComplete="password"
                textContentType="password"
                value={password}
                onChangeText={setPassword}
                editable={!loading}
                error={error}
                secureTextEntry
                passwordToggle
                leftIcon={<IconLock color={theme.colors.textMuted} />}
              />

              <Pressable
                onPress={handleForgot}
                disabled={loading || !onForgotPassword}
                hitSlop={8}
                style={styles.forgot}
              >
                <Text style={[theme.typography.label, { color: theme.colors.brand.solid }]}>
                  Esqueceu a senha?
                </Text>
              </Pressable>
            </View>

            <View style={[styles.actions, { gap: theme.spacing.md }]}>
              <SoftButton
                theme={theme}
                label="Login"
                onPress={handleLogin}
                loading={loading}
              />

              <GoogleButton theme={theme} onPress={onGoogle} disabled={loading} />

              <View style={styles.footerRow}>
                <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
                  Ainda não tem conta?{' '}
                </Text>
                <Pressable onPress={onSignUp} disabled={loading} hitSlop={8}>
                  <Text style={[theme.typography.bodyMedium, { color: theme.colors.brand.solid }]}>
                    Cadastre-se
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
    gap: 28,
  },
  heading: {
    alignItems: 'center',
  },
  notice: {
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  fields: {
    width: '100%',
  },
  forgot: {
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  actions: {
    width: '100%',
    paddingBottom: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
  },
});
