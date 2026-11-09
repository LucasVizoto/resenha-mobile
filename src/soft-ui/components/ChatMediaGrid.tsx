import { useCallback, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { listConversationImages } from '../../lib/db/messages';
import type { AppTheme } from '../theme';
import { themeFromScheme } from '../theme';

type Shot = { id: string; image_url: string };

export function ChatImageViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const theme = themeFromScheme(useColorScheme());
  return (
    <Modal visible={Boolean(uri)} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.viewer, { backgroundColor: 'rgba(0,0,0,0.92)' }]} onPress={onClose}>
        {uri ? (
          <Image source={{ uri }} style={styles.viewerImage} resizeMode="contain" />
        ) : null}
        <Text style={[theme.typography.button, styles.viewerClose]}>Fechar</Text>
      </Pressable>
    </Modal>
  );
}

export function ChatMediaGrid({
  conversationId,
  theme,
}: {
  conversationId: string;
  theme: AppTheme;
}) {
  const { width } = useWindowDimensions();
  const [shots, setShots] = useState<Shot[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const tile = Math.floor((width - theme.screenPadding.horizontal * 2 - 8) / 3);

  const load = useCallback(async () => {
    if (!conversationId) {
      setShots([]);
      return;
    }
    const rows = await listConversationImages(conversationId).catch(() => []);
    setShots(rows);
  }, [conversationId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text style={[theme.typography.bodyMedium, { color: theme.colors.textPrimary }]}>Mídia</Text>
      {shots.length === 0 ? (
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
          Nenhuma imagem nesta conversa.
        </Text>
      ) : (
        <View style={styles.grid}>
          {shots.map((shot) => (
            <Pressable key={shot.id} onPress={() => setOpen(shot.image_url)} accessibilityLabel="Abrir imagem">
              <Image
                source={{ uri: shot.image_url }}
                style={{ width: tile, height: tile, borderRadius: theme.radii.md }}
                resizeMode="cover"
              />
            </Pressable>
          ))}
        </View>
      )}
      <ChatImageViewer uri={open} onClose={() => setOpen(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  viewer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  viewerImage: { width: '100%', height: '80%' },
  viewerClose: { color: '#FFFFFF', marginTop: 16 },
});
