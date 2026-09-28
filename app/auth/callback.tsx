import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  completeGoogleOAuthFromUrl,
  exchangeGoogleAuthCode,
  oauthErrorFromUrl,
  useAuth,
} from '../../src/lib/auth';
import { SoftButton } from '../../src/soft-ui/components/SoftButton';
import { themeFromScheme } from '../../src/soft-ui/theme';

function queryFromParams(params: Record<string, string | string[] | undefined>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    const raw = Array.isArray(value) ? value[0] : value;
    if (!raw) continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(raw))}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

export default function AuthCallbackScreen() {
  const params = useGlobalSearchParams();
  const router = useRouter();
  const { session } = useAuth();
  const theme = themeFromScheme(useColorScheme());
  const [message, setMessage] = useState('Conectando com o Google…');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const raw = queryFromParams(params as Record<string, string | string[] | undefined>);
    const code = typeof params.code === 'string' ? params.code : '';
    const oauthError = oauthErrorFromUrl(raw);
    const handedOff = completeGoogleOAuthFromUrl(raw);
    try {
      WebBrowser.dismissAuthSession();
    } catch {
      // o navegador já fechou
    }

    if (handedOff && router.canGoBack()) {
      router.back();
      return;
    }

    if (oauthError || !code) {
      setFailed(true);
      setMessage(
        oauthError ||
          'O Google não devolveu o código de acesso. Volte e toque em Tentar de novo.',
      );
      return;
    }

    let alive = true;
    exchangeGoogleAuthCode(code)
      .then(() => {
        if (!alive) return;
        if (router.canGoBack()) router.back();
        else router.replace('/(app)/resenhas');
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setFailed(true);
        setMessage(e instanceof Error ? e.message : 'Não foi possível concluir o Google.');
      });
    return () => {
      alive = false;
    };
    // The deep link params are fixed for this visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else if (session) router.replace('/(app)/resenhas');
    else router.replace('/(auth)/login');
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      {failed ? null : <ActivityIndicator color={theme.colors.brand.solid} />}
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
        {failed ? 'Google Agenda' : 'Google'}
      </Text>
      <Text style={[styles.body, { color: theme.colors.textSecondary }]}>{message}</Text>
      {failed ? (
        <SoftButton label="Voltar" theme={theme} onPress={leave} style={styles.button} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  button: {
    marginTop: 12,
    alignSelf: 'stretch',
  },
});
