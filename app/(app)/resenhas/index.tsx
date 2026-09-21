import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../../src/lib/auth';
import { friendlyResenhaError, listMyResenhas } from '../../../src/lib/resenhas';
import { formatResenhaDate, resenhaIconEmoji } from '../../../src/types/resenha';
import type { Resenha } from '../../../src/types/resenha';
import { IconPlus, SoftEmptyState, WaveHeader, useGlassChrome } from '../../../src/soft-ui';
import { themeFromScheme } from '../../../src/soft-ui/theme';

export default function ResenhasScreen() {
  const theme = themeFromScheme(useColorScheme());
  const chrome = useGlassChrome();
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Resenha[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      setItems(await listMyResenhas(user.id));
    } catch (e) {
      setError(friendlyResenhaError(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]} edges={[]}>
      <StatusBar style="light" />
      <WaveHeader theme={theme} height={128} title="Resenhas" subtitle="os rolês" />
      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.brand.solid} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={load}
              tintColor={theme.colors.brand.solid}
            />
          }
          contentContainerStyle={[
            styles.list,
            {
              paddingHorizontal: theme.screenPadding.horizontal,
              gap: theme.spacing.md,
              paddingBottom: chrome.tabClearance + 80,
            },
          ]}
          ListEmptyComponent={
            <SoftEmptyState
              theme={theme}
              title="Nenhuma resenha"
              description={
                error ??
                'Marque um encontro com a galera: nome, data, ícone e o local no mapa. Só entra quem já é contato de alguém do rolê.'
              }
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/(app)/resenhas/${item.id}`)}
              style={({ pressed }) => [
                styles.row,
                theme.shadows.soft,
                {
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.radii.lg,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: theme.colors.surfaceElevated }]}>
                <Text style={styles.emoji}>{resenhaIconEmoji(item.icon, item.icon_emoji)}</Text>
              </View>
              <View style={styles.copy}>
                <Text
                  style={[theme.typography.bodyMedium, { color: theme.colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text
                  style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 4 }]}
                  numberOfLines={1}
                >
                  {formatResenhaDate(item.occurs_at)}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}

      <Pressable
        onPress={() => router.push('/(app)/resenhas/new')}
        style={({ pressed }) => [
          styles.fab,
          theme.shadows.fab,
          { opacity: pressed ? 0.9 : 1, borderRadius: theme.radii.pill, bottom: chrome.tabClearance + 8 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Nova resenha"
      >
        <LinearGradient
          colors={[...theme.gradient.colors]}
          locations={[...theme.gradient.locations]}
          start={theme.gradient.start}
          end={theme.gradient.end}
          style={[styles.fabInner, { borderRadius: theme.radii.pill }]}
        >
          <IconPlus color={theme.colors.textOnBrand} size={22} />
          <Text style={[theme.typography.button, { color: theme.colors.textOnBrand }]}>Marcar</Text>
        </LinearGradient>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingTop: 12, paddingBottom: 96, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 26 },
  copy: { flex: 1 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    overflow: 'hidden',
  },
  fabInner: {
    minHeight: 56,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
