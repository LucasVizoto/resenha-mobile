import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { initDb } from './db/client';
import { upsertMyProfile } from './profile';
import { missingSupabaseEnvMessage, supabase, supabaseConfigured } from './supabase';
import { GOOGLE_CALENDAR_SCOPE } from './google-calendar';

WebBrowser.maybeCompleteAuthSession();

export function isGoogleAuthCancelled(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /cancelado/i.test(message);
}

function codeFromAuthUrl(raw: string): string | null {
  const match = raw.match(/[?&#]code=([^&#]+)/);
  if (!match?.[1] || match[1] === 'undefined') return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function oauthErrorFromUrl(raw: string): string | null {
  if (!raw) return null;
  const description = raw.match(/[?&#]error_description=([^&#]+)/);
  const code = raw.match(/[?&#]error_code=([^&#]+)/);
  const errorCode = code?.[1] ? decodeURIComponent(code[1]) : '';
  if (errorCode === 'bad_oauth_state') {
    return 'A autorização do Google expirou ou foi iniciada duas vezes. Volte e toque em Tentar de novo.';
  }
  if (!description?.[1] && !errorCode) return null;
  if (description?.[1]) {
    try {
      return decodeURIComponent(description[1].replace(/\+/g, ' '));
    } catch {
      return description[1];
    }
  }
  return errorCode || null;
}

const googleCodeExchanges = new Map<string, Promise<Session>>();

export function exchangeGoogleAuthCode(code: string): Promise<Session> {
  const existing = googleCodeExchanges.get(code);
  if (existing) return existing;
  const pending = (async () => {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    if (!data.session) throw new Error('Sessão Google indisponível');
    return data.session;
  })();
  googleCodeExchanges.set(code, pending);
  return pending;
}

type PendingGoogleOAuth = {
  resolve: (code: string) => void;
  reject: (error: Error) => void;
  settled: boolean;
};

let pendingGoogleOAuth: PendingGoogleOAuth | null = null;
let googleOAuthFlight: Promise<Session> | null = null;

/** Called by the auth/callback screen when Expo Router opens the deep link. */
export function completeGoogleOAuthFromUrl(raw: string): boolean {
  const pending = pendingGoogleOAuth;
  if (!pending || pending.settled) return false;
  const oauthError = oauthErrorFromUrl(raw);
  const code = codeFromAuthUrl(raw);
  if (!oauthError && !code) return false;
  pending.settled = true;
  pendingGoogleOAuth = null;
  if (oauthError) pending.reject(new Error(oauthError));
  else if (code) pending.resolve(code);
  return true;
}

function googleRedirectUri(): string {
  // No Expo Go isso vira exp://IP:8081/--/auth/callback.
  // mensagens-mobile:// só fecha o navegador num app compilado, não no Expo Go.
  return Linking.createURL('auth/callback');
}

function waitForGoogleRedirect(authUrl: string, redirectTo: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const pending: PendingGoogleOAuth = {
      settled: false,
      resolve: (code) => {
        sub.remove();
        resolve(code);
      },
      reject: (error) => {
        sub.remove();
        reject(error);
      },
    };
    pendingGoogleOAuth = pending;

    const finishUrl = (url: string) => {
      if (pending.settled) return;
      if (!completeGoogleOAuthFromUrl(url)) return;
      try {
        WebBrowser.dismissAuthSession();
      } catch {
        // a sessão do navegador já fechou
      }
    };

    const sub = Linking.addEventListener('url', ({ url }) => finishUrl(url));

    const giveUp = (message: string) => {
      if (pending.settled) return;
      pending.settled = true;
      if (pendingGoogleOAuth === pending) pendingGoogleOAuth = null;
      sub.remove();
      reject(new Error(message));
    };

    void WebBrowser.openAuthSessionAsync(authUrl, redirectTo)
      .then((result) => {
        if (pending.settled) return;
        const raw = result.type === 'success' && 'url' in result ? result.url : '';
        if (raw) finishUrl(raw);
        if (pending.settled) return;
        // The deep link can land on /auth/callback a moment after the browser closes.
        setTimeout(() => {
          if (pending.settled) return;
          giveUp(
            `Login Google cancelado. No Supabase, Site URL e Redirect URLs precisam ser exatamente: ${redirectTo}`,
          );
        }, 1200);
      })
      .catch((e: unknown) => {
        if (pending.settled) return;
        pending.settled = true;
        if (pendingGoogleOAuth === pending) pendingGoogleOAuth = null;
        sub.remove();
        reject(e instanceof Error ? e : new Error(String(e)));
      });
  });
}

export type SignUpProfile = {
  first_name?: string;
  last_name?: string;
  username?: string;
  instagram?: string | null;
  phone?: string | null;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, profile?: SignUpProfile) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  ensureGoogleCalendarAccess: (options?: { force?: boolean }) => Promise<string>;
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
    supabase.auth.getSession().then(async ({ data }) => {
      try {
        await initDb(data.session?.user.id ?? null);
      } catch (e) {
        console.warn('initDb failed', e);
      }
      if (mounted) {
        setSession(data.session);
        setLoading(false);
      }
    });
    // Callback síncrono: await aqui trava o lock do Auth e o 1º login não completa.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setTimeout(() => {
        void (async () => {
          try {
            await initDb(next?.user.id ?? null);
          } catch (e) {
            console.warn('initDb failed', e);
          }
          if (mounted) {
            setSession(next);
            setLoading(false);
          }
        })();
      }, 0);
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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    try {
      await initDb(data.session?.user.id ?? null);
    } catch (e) {
      console.warn('initDb failed', e);
    }
    if (data.session) {
      setSession(data.session);
      setLoading(false);
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, profile?: SignUpProfile) => {
    if (!supabaseConfigured) {
      throw new Error(missingSupabaseEnvMessage);
    }
    const first = profile?.first_name?.trim() || '';
    const last = profile?.last_name?.trim() || '';
    const username = profile?.username?.trim().replace(/^@+/, '') || '';
    const display = [first, last].filter(Boolean).join(' ');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: first || undefined,
          last_name: last || undefined,
          given_name: first || undefined,
          family_name: last || undefined,
          full_name: display || undefined,
          username: username || undefined,
          preferred_username: username || undefined,
          instagram: profile?.instagram || undefined,
          phone: profile?.phone || undefined,
        },
      },
    });
    if (error) throw error;

    if (!data.session?.user) return;

    try {
      await initDb(data.session.user.id);
    } catch (e) {
      console.warn('initDb failed', e);
    }
    setSession(data.session);
    setLoading(false);

    try {
      const derivedUsername = username || email.split('@')[0] || `user${data.session.user.id.slice(0, 8)}`;
      await upsertMyProfile(data.session.user.id, {
        first_name: first,
        last_name: last,
        email,
        instagram: profile?.instagram ?? null,
        phone: profile?.phone ?? null,
        username: derivedUsername.replace(/^@+/, ''),
        display_name: display || derivedUsername,
      });
    } catch {
      // trigger já criou o perfil; o usuário completa depois na Conta
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabaseConfigured) {
      setSession(null);
      await initDb(null);
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      await supabase.auth.signOut({ scope: 'local' });
    }
    setSession(null);
    await initDb(null);
  }, []);

  const runGoogleOAuth = useCallback(
    async (calendar: boolean, linkExisting = false): Promise<Session> => {
      if (googleOAuthFlight) return googleOAuthFlight;
      googleOAuthFlight = (async () => {
        if (!supabaseConfigured) {
          throw new Error(missingSupabaseEnvMessage);
        }
        const redirectTo = googleRedirectUri();
        if (__DEV__) {
          console.warn('[Resenha] Redirect do Google para colar no Supabase:', redirectTo);
        }
        const options = {
          redirectTo,
          skipBrowserRedirect: true,
          ...(calendar
            ? {
                scopes: `email profile ${GOOGLE_CALENDAR_SCOPE}`,
                queryParams: { access_type: 'offline', prompt: 'consent' },
              }
            : {}),
        };
        let authUrl: string | null = null;
        if (calendar && linkExisting) {
          const linked = await supabase.auth.linkIdentity({
            provider: 'google',
            options,
          });
          if (!linked.error) authUrl = linked.data?.url ?? null;
        }
        if (!authUrl) {
          const started = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options,
          });
          if (started.error) throw started.error;
          authUrl = started.data.url;
        }
        if (!authUrl) throw new Error('URL OAuth indisponível');

        const code = await waitForGoogleRedirect(authUrl, redirectTo);
        const exchanged = await exchangeGoogleAuthCode(code);
        try {
          await initDb(exchanged.user.id);
        } catch (e) {
          console.warn('initDb failed', e);
        }
        setSession(exchanged);
        setLoading(false);
        return exchanged;
      })().finally(() => {
        googleOAuthFlight = null;
      });
      return googleOAuthFlight;
    },
    [],
  );

  const signInWithGoogle = useCallback(async () => {
    await runGoogleOAuth(false);
  }, [runGoogleOAuth]);

  const ensureGoogleCalendarAccess = useCallback(
    async (options?: { force?: boolean }): Promise<string> => {
      if (!options?.force) {
        const existing = session?.provider_token?.trim();
        if (existing) return existing;
      }
      const next = await runGoogleOAuth(true, Boolean(session));
      const token = next.provider_token?.trim();
      if (!token) {
        throw new Error(
          'O Google não devolveu token da agenda. Confira o escopo calendar.events no Google Cloud e no provider Google do Supabase (docs/google-credentials.md).',
        );
      }
      return token;
    },
    [runGoogleOAuth, session],
  );

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
      ensureGoogleCalendarAccess,
      resetPassword,
      updateEmail,
    }),
    [
      session,
      loading,
      signIn,
      signUp,
      signOut,
      signInWithGoogle,
      ensureGoogleCalendarAccess,
      resetPassword,
      updateEmail,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
