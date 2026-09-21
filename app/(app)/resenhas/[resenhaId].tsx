import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { friendlyResenhaError, getResenha } from '../../../src/lib/resenhas';
import { displayNameFor } from '../../../src/lib/invites';
import {
  formatResenhaDateTime,
  resenhaIconEmoji,
  type Resenha,
} from '../../../src/types/resenha';
import { ResenhaMap, SoftAvatar, SoftEmptyState, SoftListRow, useGlassChrome } from '../../../src/soft-ui';
import { themeFromScheme } from '../../../src/soft-ui/theme';

export default function ResenhaDetailScreen() {
  const theme = themeFromScheme(useColorScheme());
  const chrome = useGlassChrome();
  const navigation = useNavigation();
  const { resenhaId } = useLocalSearchParams<{ resenhaId: string }>();
  const [item, setItem] = useState<Resenha | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!resenhaId) return;
    setLoading(true);
    setError(null);
    try {
      const row = await getResenha(String(resenhaId));
      setItem(row);
      if (row) {
        navigation.setOptions({ title: row.name });
        try {
          const geo = await Location.reverseGeocodeAsync({
            latitude: row.latitude,
            longitude: row.longitude,
          });
          const first = geo[0];
          if (first) {
            const bits = [first.street, first.district, first.city, first.region].filter(Boolean);
            setPlace(bits.join(', ') || null);
          }
        } catch {
          setPlace(null);
        }
      }
    } catch (e) {
      setError(friendlyResenhaError(e));
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [resenhaId, navigation]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading && !item) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.brand.solid} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <SoftEmptyState
          theme={theme}
          title="Resenha não encontrada"
          description={error ?? 'Esse encontro não existe ou você não faz parte dele.'}
        />
      </View>
    );
  }

  const members = [...(item.members ?? [])].sort((a, b) => {
    if (a.role === b.role) return 0;
    return a.role === 'host' ? -1 : 1;
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={[
        styles.scroll,
        { paddingHorizontal: theme.screenPadding.horizontal, paddingBottom: chrome.tabClearance },
      ]}
    >
      <View style={[styles.hero, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg }]}>
        <Text style={styles.emoji}>{resenhaIconEmoji(item.icon, item.icon_emoji)}</Text>
        <Text style={[theme.typography.heading, { color: theme.colors.textPrimary, textAlign: 'center' }]}>
          {item.name}
        </Text>
        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8 },
          ]}
        >
          {formatResenhaDateTime(item.occurs_at)}
        </Text>
      </View>

      <Text style={[theme.typography.label, styles.section, { color: theme.colors.textSecondary }]}>
        Local
      </Text>
      <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
        {place ?? 'Ponto marcado no mapa'}
      </Text>
      <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>
        {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
      </Text>
      <View
        collapsable={false}
        style={[
          styles.mapWrap,
          { borderRadius: theme.radii.lg, marginTop: 12, backgroundColor: theme.colors.surface },
        ]}
      >
        <ResenhaMap latitude={item.latitude} longitude={item.longitude} height={280} />
      </View>

      <Text style={[theme.typography.label, styles.section, { color: theme.colors.textSecondary }]}>
        Galera ({members.length})
      </Text>
      <View style={{ gap: 10 }}>
        {members.map((member) => {
          const profile = member.profile;
          const title = profile?.display_name ?? displayNameFor(profile);
          return (
            <SoftListRow
              key={member.user_id}
              theme={theme}
              title={title}
              subtitle={member.role === 'host' ? 'Organizou o rolê' : displayNameFor(profile)}
              avatarUri={profile?.avatar_url}
            />
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingTop: 16 },
  hero: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  emoji: { fontSize: 48, marginBottom: 8 },
  section: { marginTop: 24, marginBottom: 8 },
  mapWrap: { overflow: 'hidden', height: 280, width: '100%' },
});
