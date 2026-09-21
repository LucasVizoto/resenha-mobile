import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    if (Platform.OS === 'web') {
      try {
        return Promise.resolve(localStorage.getItem(key));
      } catch {
        return Promise.resolve(null);
      }
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem(key, value);
        return Promise.resolve();
      } catch {
        return Promise.resolve();
      }
    }
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    if (Platform.OS === 'web') {
      try {
        localStorage.removeItem(key);
        return Promise.resolve();
      } catch {
        return Promise.resolve();
      }
    }
    return SecureStore.deleteItemAsync(key);
  },
};

// Expo SDK 57: only static process.env.EXPO_PUBLIC_* access is inlined from .env.
const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
const storageBucketFromEnv = (process.env.EXPO_PUBLIC_SUPABASE_STORAGE_BUCKET ?? '').trim();

export const supabaseUrlValue = supabaseUrl;
export const supabaseStorageBucket = storageBucketFromEnv || 'avatars';

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const missingSupabaseEnvMessage = [
  'Supabase não configurado.',
  'Crie um arquivo .env na raiz (copie de .env.example) e preencha:',
  '  EXPO_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co',
  '  EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...  (chave anon/public em Settings > API)',
  'Nunca use a service_role no app — ela é secreta e ignora o RLS.',
  'Salve o .env e recarregue o app (npx expo start --clear).',
].join('\n');

export const missingSupabaseEnvNotice =
  'Supabase não configurado. Entre em contato com o desenvolvedor.';

if (!supabaseConfigured) {
  console.error(missingSupabaseEnvMessage);
  if (__DEV__) {
    console.error(
      '[Resenha] Falha de configuração: EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY ausentes ou vazias.',
    );
  }
}

const authOptions = {
  storage: ExpoSecureStoreAdapter,
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: false,
} as const;

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: authOptions })
  : createClient('https://unconfigured.invalid', 'unconfigured-anon-key', {
      auth: authOptions,
    });
