import { useState } from 'react';
import { useRouter } from 'expo-router';
import { RegisterScreen, useDialog } from '../../src/soft-ui';
import { useAuth } from '../../src/lib/auth';
import { missingSupabaseEnvNotice, supabaseConfigured } from '../../src/lib/supabase';

export default function RegisterRoute() {
  const { signUp } = useAuth();
  const { show } = useDialog();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <RegisterScreen
      colorScheme="light"
      loading={loading}
      notice={supabaseConfigured ? undefined : missingSupabaseEnvNotice}
      onRegister={async ({ email, password }) => {
        setLoading(true);
        try {
          await signUp(email, password);
          show({
            title: 'Conta criada',
            message: 'Verifique o e-mail se necessário e faça login.',
          });
          router.replace('/(auth)/login');
        } catch (e) {
          show({
            title: 'Não foi possível cadastrar',
            message: e instanceof Error ? e.message : String(e),
          });
        } finally {
          setLoading(false);
        }
      }}
      onBackToLogin={() => router.back()}
    />
  );
}
