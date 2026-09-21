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
import { IconEnvelope, IconLock } from '../components/SoftIcons';
import { getTheme } from '../theme';

export type RegisterScreenProps = {
  colorScheme?: 'light' | 'dark';
  onRegister?: (payload: { email: string; password: string }) => void | Promise<void>;
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
  const [error, setError] = useState<string | undefined>();

  const handleRegister = async () => {
    setError(undefined);
    if (!email.trim() || password.length < 6) {
      setError('Informe e-mail e senha (mín. 6 caracteres).');
      return;
    }
    await onRegister?.({ email: email.trim(), password });
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
            height={Math.max(220, screenH * 0.3)}
            title="Resenha"
            subtitle="o papo da galera"
          >
            <BrandLogo theme={theme} variant="mark" size={96} />
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
                error={error}
                secureTextEntry
                passwordToggle
                leftIcon={<IconLock color={theme.colors.textMuted} />}
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
    gap: 28,
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
