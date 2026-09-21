import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { fetchContactProfile, friendlyProfileError } from '../../lib/profile';
import { displayNameFor } from '../../lib/invites';
import type { Profile } from '../../types/profile';
import { SoftAvatar, SoftEmptyState } from '../components';
import { themeFromScheme } from '../theme';
import { useGlassChrome } from '../chrome';

function Field({
  label,
  value,
  theme,
}: {
  label: string;
  value?: string | null;
  theme: ReturnType<typeof themeFromScheme>;
}) {
  if (!value) return null;
  return (
    <View
      style={[
        styles.field,
        { backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg, ...theme.shadows.soft },
      ]}
    >
      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{label}</Text>
      <Text style={[theme.typography.bodyMedium, { color: theme.colors.textPrimary, marginTop: 4 }]}>
        {value}
      </Text>
    </View>
  );
}

export function ContactProfileScreen({ userId }: { userId: string }) {
  const theme = themeFromScheme(useColorScheme());
  const chrome = useGlassChrome();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      setProfile(await fetchContactProfile(userId));
    } catch (e) {
      setError(friendlyProfileError(e));
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const name = profile?.display_name ?? displayNameFor(profile);

  if (loading && !profile) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.brand.solid} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <SoftEmptyState
          theme={theme}
          title="Perfil não encontrado"
          description={error ?? 'Não foi possível carregar esse contato.'}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={[
        styles.body,
        { paddingHorizontal: theme.screenPadding.horizontal, gap: theme.spacing.md, paddingBottom: chrome.tabClearance },
      ]}
    >
      <View style={styles.hero}>
        <SoftAvatar theme={theme} uri={profile.avatar_url} name={name} size={96} />
        <Text
          style={[theme.typography.heading, { color: theme.colors.textPrimary, marginTop: 14, textAlign: 'center' }]}
        >
          {name}
        </Text>
      </View>
      <Field theme={theme} label="Nome" value={profile.display_name} />
      <Field
        theme={theme}
        label="Usuário"
        value={profile.username ? `@${profile.username.replace(/^@/, '')}` : null}
      />
      <Field
        theme={theme}
        label="Instagram"
        value={profile.instagram ? `@${profile.instagram.replace(/^@/, '')}` : null}
      />
      <Field theme={theme} label="Telefone" value={profile.phone} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingTop: 16, paddingBottom: 32 },
  hero: { alignItems: 'center', paddingVertical: 12 },
  field: { paddingHorizontal: 16, paddingVertical: 14 },
});
