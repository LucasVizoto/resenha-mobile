import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  friendlyGroupResenhaError,
  linkGroupResenha,
  listLinkedResenhas,
  listResenhasCoveringGroup,
} from '../../../../src/lib/group-resenhas';
import { purgeExpiredResenhas } from '../../../../src/lib/resenhas';
import { formatResenhaDate, resenhaIconEmoji, type Resenha } from '../../../../src/types/resenha';
import {
  IconChevronLeft,
  IconPlus,
  SoftEmptyState,
  WaveHeader,
  useGlassChrome,
} from '../../../../src/soft-ui';
import { themeFromScheme } from '../../../../src/soft-ui/theme';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function HalfSheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const theme = themeFromScheme(useColorScheme());
  const { height } = useWindowDimensions();
  const sheetHeight = Math.round(height * 0.5);
  const translateY = useRef(new Animated.Value(sheetHeight)).current;
  const heightRef = useRef(sheetHeight);
  const closeRef = useRef(onClose);
  heightRef.current = sheetHeight;
  closeRef.current = onClose;

  const dismiss = useCallback(() => {
    Animated.timing(translateY, {
      toValue: heightRef.current,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) closeRef.current();
    });
  }, [translateY]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 3,
      onPanResponderMove: (_, gesture) => {
        translateY.setValue(Math.max(0, gesture.dy));
      },
      onPanResponderRelease: (_, gesture) => {
        const limit = heightRef.current;
        if (gesture.dy > limit * 0.22 || gesture.vy > 0.9) {
          Animated.timing(translateY, {
            toValue: limit,
            duration: 180,
            useNativeDriver: true,
          }).start(({ finished }) => {
            if (finished) closeRef.current();
          });
          return;
        }
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
      },
    }),
  ).current;

  useEffect(() => {
    if (!visible) return;
    translateY.setValue(heightRef.current);
    Animated.timing(translateY, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [visible, sheetHeight, translateY]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.sheetRoot}>
        <Pressable style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]} onPress={dismiss} />
        <Animated.View
          style={[
            styles.sheet,
            {
              height: sheetHeight,
              backgroundColor: theme.colors.surface,
              transform: [{ translateY }],
              ...theme.shadows.softStrong,
            },
          ]}
        >
          <View {...pan.panHandlers} style={styles.handleHit} accessibilityRole="adjustable">
            <View style={[styles.handle, { backgroundColor: theme.colors.borderSubtle }]} />
          </View>
          <Text style={[theme.typography.heading, styles.sheetTitle, { color: theme.colors.textPrimary }]}>
            {title}
          </Text>
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.textSecondary, paddingHorizontal: 20, marginBottom: 12 },
            ]}
          >
            Resenhas em que todos os integrantes deste grupo estão presentes.
          </Text>
          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

export default function GroupResenhasScreen() {
  const theme = themeFromScheme(useColorScheme());
  const chrome = useGlassChrome();
  const router = useRouter();
  const { groupId: groupIdParam } = useLocalSearchParams<{ groupId: string }>();
  const groupId = firstParam(groupIdParam);
  const [items, setItems] = useState<Resenha[]>([]);
  const [candidates, setCandidates] = useState<Resenha[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    setError(null);
    try {
      await purgeExpiredResenhas();
      setItems(await listLinkedResenhas(groupId));
    } catch (e) {
      setError(friendlyGroupResenhaError(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openAdd = async () => {
    if (!groupId) return;
    setMenuOpen(false);
    setSheetError(null);
    setCandidates([]);
    setSheetOpen(true);
    setLoadingCandidates(true);
    try {
      setCandidates(await listResenhasCoveringGroup(groupId));
    } catch (e) {
      setCandidates([]);
      setSheetError(friendlyGroupResenhaError(e));
    } finally {
      setLoadingCandidates(false);
    }
  };

  const linkCandidate = async (resenha: Resenha) => {
    if (!groupId || linkingId) return;
    setLinkingId(resenha.id);
    setSheetError(null);
    try {
      await linkGroupResenha(groupId, resenha.id);
      setSheetOpen(false);
      await load();
    } catch (e) {
      setSheetError(friendlyGroupResenhaError(e));
    } finally {
      setLinkingId(null);
    }
  };

  const markResenha = () => {
    if (!groupId) return;
    setMenuOpen(false);
    router.push({ pathname: '/(app)/resenhas/new', params: { groupId } });
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <WaveHeader theme={theme} height={110}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.headerIconBtn} accessibilityLabel="Voltar">
            <IconChevronLeft color="#FFFFFF" size={22} />
          </Pressable>
          <Text style={[theme.typography.heading, { color: '#FFFFFF', flex: 1 }]} numberOfLines={1}>
            Resenhas
          </Text>
        </View>
      </WaveHeader>

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.brand.solid} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.screenPadding.horizontal,
            paddingTop: 12,
            paddingBottom: chrome.tabClearance + 96,
            gap: theme.spacing.md,
            flexGrow: 1,
          }}
        >
          {items.length === 0 ? (
            <SoftEmptyState
              theme={theme}
              title="Nenhuma resenha vinculada"
              description={
                error ?? 'Use o + para adicionar um rolê deste grupo ou marcar um novo.'
              }
            />
          ) : (
            items.map((item) => (
              <Pressable
                key={item.id}
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
            ))
          )}
        </ScrollView>
      )}

      {menuOpen ? (
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)} accessibilityLabel="Fechar menu" />
      ) : null}

      <View style={[styles.fabStack, { bottom: chrome.tabClearance + 16 }]} pointerEvents="box-none">
        {menuOpen ? (
          <>
            <Pressable
              onPress={() => void openAdd()}
              style={({ pressed }) => [
                styles.fabAction,
                theme.shadows.soft,
                {
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.radii.pill,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Adicionar Resenha"
            >
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.textPrimary }]}>
                Adicionar Resenha
              </Text>
            </Pressable>
            <Pressable
              onPress={markResenha}
              style={({ pressed }) => [
                styles.fabAction,
                theme.shadows.soft,
                {
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.radii.pill,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Marcar Resenha"
            >
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.textPrimary }]}>Marcar Resenha</Text>
            </Pressable>
          </>
        ) : null}
        <Pressable
          onPress={() => setMenuOpen((open) => !open)}
          style={({ pressed }) => [
            styles.fab,
            theme.shadows.fab,
            { opacity: pressed ? 0.9 : 1, borderRadius: theme.radii.pill },
          ]}
          accessibilityRole="button"
          accessibilityLabel={menuOpen ? 'Fechar' : 'Adicionar'}
        >
          <LinearGradient
            colors={[...theme.gradient.colors]}
            locations={[...theme.gradient.locations]}
            start={theme.gradient.start}
            end={theme.gradient.end}
            style={[styles.fabInner, { borderRadius: theme.radii.pill }]}
          >
            <View style={{ transform: [{ rotate: menuOpen ? '45deg' : '0deg' }] }}>
              <IconPlus color={theme.colors.textOnBrand} size={26} />
            </View>
          </LinearGradient>
        </Pressable>
      </View>

      <HalfSheet visible={sheetOpen} title="Adicionar resenha" onClose={() => setSheetOpen(false)}>
        {loadingCandidates ? (
          <ActivityIndicator color={theme.colors.brand.solid} style={{ marginTop: 24 }} />
        ) : candidates.length === 0 ? (
          <SoftEmptyState
            theme={theme}
            title={sheetError ? 'Não foi possível listar' : 'Nenhuma resenha disponível'}
            description={
              sheetError ??
              'Não há um rolê em que todos os integrantes atuais do grupo estejam presentes.'
            }
          />
        ) : (
          <View style={{ gap: 10 }}>
            {sheetError ? (
              <Text style={[theme.typography.body, { color: theme.colors.danger, textAlign: 'center' }]}>
                {sheetError}
              </Text>
            ) : null}
            {candidates.map((item) => (
              <Pressable
                key={item.id}
                disabled={Boolean(linkingId)}
                onPress={() => void linkCandidate(item)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: theme.colors.background,
                    borderRadius: theme.radii.lg,
                    opacity: linkingId && linkingId !== item.id ? 0.5 : pressed ? 0.92 : 1,
                  },
                ]}
              >
                <View style={[styles.iconWrap, { backgroundColor: theme.colors.surface }]}>
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
                {linkingId === item.id ? <ActivityIndicator color={theme.colors.brand.solid} /> : null}
              </Pressable>
            ))}
          </View>
        )}
      </HalfSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
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
  menuBackdrop: { ...StyleSheet.absoluteFill },
  fabStack: {
    position: 'absolute',
    right: 20,
    alignItems: 'flex-end',
    gap: 10,
  },
  fabAction: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fab: { overflow: 'hidden' },
  fabInner: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  handleHit: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 8,
  },
  handle: {
    width: 42,
    height: 5,
    borderRadius: 3,
  },
  sheetTitle: {
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  sheetScroll: { flex: 1 },
  sheetScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
});
