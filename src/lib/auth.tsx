import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { missingSupabaseEnvMessage, supabase, supabaseConfigured } from './supabase';

WebBrowser.maybeCompleteAuthSession();

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateEmail: (email: string) => Promise<User>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setLoading(false);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabaseConfigured) {
      throw new Error(missingSupabaseEnvMessage);
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabaseConfigured) {
      throw new Error(missingSupabaseEnvMessage);
    }
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabaseConfigured) {
      setSession(null);
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      await supabase.auth.signOut({ scope: 'local' });
      setSession(null);
      return;
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabaseConfigured) {
      throw new Error(missingSupabaseEnvMessage);
    }
    const redirectTo = makeRedirectUri({
      scheme: 'mensagens-mobile',
      path: 'auth/callback',
    });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data.url) throw new Error('URL OAuth indisponível');

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success' || !('url' in result) || !result.url) {
      throw new Error('Login Google cancelado');
    }
    const url = new URL(result.url);
    const code = url.searchParams.get('code');
    if (!code) {
      throw new Error('Código OAuth ausente no redirect');
    }
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (!supabaseConfigured) {
      throw new Error(missingSupabaseEnvMessage);
    }
    const redirectTo = makeRedirectUri({
      scheme: 'mensagens-mobile',
      path: 'auth/callback',
    });
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }, []);

  const updateEmail = useCallback(async (email: string) => {
    if (!supabaseConfigured) {
      throw new Error(missingSupabaseEnvMessage);
    }
    const emailRedirectTo = makeRedirectUri({
      scheme: 'mensagens-mobile',
      path: 'auth/callback',
    });
    const { data, error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo },
    );
    if (error) throw error;
    if (!data.user) throw new Error('Não foi possível atualizar o e-mail.');
    return data.user;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signIn,
      signUp,
      signOut,
      signInWithGoogle,
      resetPassword,
      updateEmail,
    }),
    [session, loading, signIn, signUp, signOut, signInWithGoogle, resetPassword, updateEmail],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
