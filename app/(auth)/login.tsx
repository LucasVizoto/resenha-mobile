import { useState } from 'react';
import { useRouter } from 'expo-router';
import { LoginScreen, useDialog } from '../../src/soft-ui';
import { useAuth } from '../../src/lib/auth';
import { missingSupabaseEnvNotice, supabaseConfigured } from '../../src/lib/supabase';

export default function LoginRoute() {
  const { signIn, signInWithGoogle, resetPassword } = useAuth();
  const { show } = useDialog();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <LoginScreen
      colorScheme="light"
      loading={loading}
      notice={supabaseConfigured ? undefined : missingSupabaseEnvNotice}
      onLogin={async ({ email, password }) => {
        setLoading(true);
        try {
          await signIn(email, password);
          router.replace('/(app)/contacts');
        } catch (e) {
          show({
            title: 'Não foi possível entrar',
            message: e instanceof Error ? e.message : String(e),
          });
        } finally {
          setLoading(false);
        }
      }}
      onSignUp={() => router.push('/(auth)/register')}
      onForgotPassword={async (email) => {
        try {
          await resetPassword(email);
          show({
            title: 'Recuperar senha',
            message: `Enviamos um e-mail para ${email}.`,
          });
        } catch (e) {
          show({
            title: 'Recuperar senha',
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }}
      onGoogle={async () => {
        setLoading(true);
        try {
          await signInWithGoogle();
          router.replace('/(app)/contacts');
        } catch (e) {
          show({
            title: 'Google',
            message: e instanceof Error ? e.message : String(e),
          });
        } finally {
          setLoading(false);
        }
      }}
    />
  );
}
