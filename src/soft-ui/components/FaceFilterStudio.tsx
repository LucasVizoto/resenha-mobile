import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  WebView as BaseWebView,
  type WebViewMessageEvent,
  type WebViewProps,
} from 'react-native-webview';
import {
  FILTER_ANCHORS,
  FILTER_SIZES,
  SYSTEM_FILTERS,
  friendlyFilterError,
  listCommunityFilters,
  publishFaceFilter,
  type FaceAnchor,
  type FaceFilter,
} from '../../lib/face-filters';
import { faceFilterDocument } from '../../lib/face-filter-document';
import type { AppTheme } from '../theme';
import { SoftButton } from './SoftButton';
import { SoftEmptyState } from './SoftEmptyState';
import { IconChevronLeft } from './SoftIcons';

type WebHandle = { injectJavaScript: (script: string) => void };

const WebView = BaseWebView as unknown as React.ComponentType<
  WebViewProps & React.RefAttributes<WebHandle>
>;

type Tab = 'system' | 'community' | 'publish';

type Props = {
  visible: boolean;
  theme: AppTheme;
  authorId: string | null;
  authorName: string;
  onClose: () => void;
  onCapture: (shot: { uri: string; base64: string; mimeType: string }) => void;
};

type FilterAsset = {
  uri: string;
  base64: string;
  mimeType: string;
};

async function renderFilterAsset(uri: string, format: SaveFormat): Promise<FilterAsset> {
  const context = ImageManipulator.manipulate(uri, { maxWidth: 720, maxHeight: 720 });
  try {
    const rendered = await context.renderAsync();
    try {
      const saved = await rendered.saveAsync({
        compress: format === SaveFormat.PNG ? 1 : 0.82,
        format,
        base64: true,
      });
      if (!saved.base64) throw new Error('Não consegui ler essa imagem. Escolha outra.');
      return {
        uri: saved.uri,
        base64: saved.base64,
        mimeType: format === SaveFormat.PNG ? 'image/png' : 'image/jpeg',
      };
    } finally {
      rendered.release();
    }
  } finally {
    context.release();
  }
}

export function FaceFilterStudio({
  visible,
  theme,
  authorId,
  authorName,
  onClose,
  onCapture,
}: Props) {
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebHandle>(null);
  const [tab, setTab] = useState<Tab>('system');
  const [selected, setSelected] = useState<FaceFilter>(SYSTEM_FILTERS[1]);
  const [ready, setReady] = useState(false);
  const [faceCount, setFaceCount] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [published, setPublished] = useState<FaceFilter[]>([]);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [anchor, setAnchor] = useState<FaceAnchor>('eyes');
  const [asset, setAsset] = useState<FilterAsset | null>(null);
  const [scale, setScale] = useState(FILTER_SIZES[1].scale);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const html = useMemo(() => faceFilterDocument(), []);

  useEffect(() => {
    if (!visible) return;
    setCameraError(null);
    setReady(false);
    void ImagePicker.requestCameraPermissionsAsync();
    void listCommunityFilters(authorId)
      .then((rows) => {
        setPublished(rows);
        setLibraryError(null);
      })
      .catch((error: unknown) => setLibraryError(friendlyFilterError(error)));
  }, [authorId, visible]);

  useEffect(() => {
    if (!ready) return;
    webRef.current?.injectJavaScript(`window.applyFilter(${JSON.stringify(selected)}); true;`);
  }, [ready, selected]);

  useEffect(() => {
    if (tab !== 'publish') return;
    if (!asset) {
      setSelected({
        id: 'none',
        name: 'Sem filtro',
        author: 'Resenha',
        style: 'none',
        color: '#1A1D24',
        scale: 1,
      });
      return;
    }
    setSelected({
      id: 'draft',
      name: 'Rascunho',
      author: authorName,
      style: 'custom',
      color: '#1A1D24',
      scale,
      anchor,
      image: `data:${asset.mimeType};base64,${asset.base64}`,
    });
  }, [tab, asset, scale, anchor, authorName]);

  const onMessage = (event: WebViewMessageEvent) => {
    let payload: { type?: string; engine?: string; faces?: number; base64?: string; message?: string } = {};
    try {
      payload = JSON.parse(event.nativeEvent.data) as typeof payload;
    } catch {
      return;
    }
    if (payload.type === 'status') {
      setReady(payload.engine === 'mesh' || payload.engine === 'box');
      setFaceCount(payload.faces ?? 0);
      if (payload.engine === 'mesh' || payload.engine === 'box') setCameraError(null);
    } else if (payload.type === 'error') {
      setCameraError(payload.message || 'A câmera não abriu.');
    } else if (payload.type === 'photo' && payload.base64) {
      onCapture({
        uri: `data:image/jpeg;base64,${payload.base64}`,
        base64: payload.base64,
        mimeType: 'image/jpeg',
      });
    }
  };

  const pickImage = async () => {
    setPublishError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPublishError('Permita o acesso às fotos para enviar a imagem do filtro.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    const file = result.assets[0];
    try {
      const keepPng = (file.mimeType ?? '').includes('png');
      let next = await renderFilterAsset(file.uri, keepPng ? SaveFormat.PNG : SaveFormat.JPEG);
      if (next.base64.length > 900_000) {
        next = await renderFilterAsset(file.uri, SaveFormat.JPEG);
      }
      if (next.base64.length > 900_000) {
        setPublishError('Essa imagem está pesada demais. Escolha uma menor.');
        return;
      }
      setAsset(next);
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : 'Não consegui preparar essa imagem.');
    }
  };

  const publish = async () => {
    if (!authorId || !asset || publishing) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const created = await publishFaceFilter({
        authorId,
        authorName,
        name,
        anchor,
        scale,
        uri: asset.uri,
        mimeType: asset.mimeType,
        base64: asset.base64,
      });
      setPublished((rows) => [created, ...rows.filter((row) => row.id !== created.id)]);
      setSelected(created);
      setName('');
      setAsset(null);
      setTab('community');
    } catch (error) {
      setPublishError(friendlyFilterError(error));
    } finally {
      setPublishing(false);
    }
  };

  const chips = (filters: FaceFilter[]) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {filters.map((filter) => {
        const on = selected.id === filter.id;
        return (
          <Pressable
            key={filter.id}
            onPress={() => setSelected(filter)}
            style={[
              styles.chip,
              {
                backgroundColor: on ? theme.colors.brand.soft : theme.colors.backgroundSubtle,
                borderRadius: theme.radii.pill,
              },
            ]}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: filter.color,
              }}
            />
            <Text style={[theme.typography.caption, { color: theme.colors.textPrimary }]}>{filter.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
        <LinearGradient
          colors={[...theme.gradientVertical.colors]}
          start={theme.gradientVertical.start}
          end={theme.gradientVertical.end}
          style={[styles.header, { paddingTop: insets.top + 8 }]}
        >
          <Pressable onPress={onClose} accessibilityLabel="Voltar" style={styles.headerBtn}>
            <IconChevronLeft color="#FFFFFF" size={22} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.heading, { color: '#FFFFFF' }]}>Filtros</Text>
            <Text style={[theme.typography.caption, { color: 'rgba(255,255,255,0.88)' }]}>
              {cameraError
                ? cameraError
                : !ready
                  ? 'Carregando o rastreador do rosto…'
                  : faceCount > 0
                    ? 'Filtro acompanhando o rosto'
                    : 'Aponte o rosto para a câmera'}
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.stage}>
          {visible ? (
            <WebView
              ref={webRef}
              source={{ html, baseUrl: 'https://localhost' }}
              style={styles.web}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              cacheEnabled
              thirdPartyCookiesEnabled
              mixedContentMode="always"
              androidLayerType="hardware"
              setSupportMultipleWindows={false}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              mediaCapturePermissionGrantType="grant"
              onMessage={onMessage}
            />
          ) : null}
        </View>

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surface,
              paddingBottom: Math.max(insets.bottom, 12),
              borderTopLeftRadius: theme.radii.xl,
              borderTopRightRadius: theme.radii.xl,
              ...theme.shadows.softStrong,
            },
          ]}
        >
          <View style={styles.tabs}>
            {(
              [
                ['system', 'Sistema'],
                ['community', 'Comunidade'],
                ['publish', 'Publicar'],
              ] as const
            ).map(([id, label]) => {
              const on = tab === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => setTab(id)}
                  style={[
                    styles.tab,
                    {
                      backgroundColor: on ? theme.colors.brand.soft : 'transparent',
                      borderRadius: theme.radii.pill,
                    },
                  ]}
                >
                  <Text
                    style={[
                      theme.typography.caption,
                      { color: on ? theme.colors.brand.solid : theme.colors.textSecondary, fontWeight: '700' },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {tab === 'system' ? chips(SYSTEM_FILTERS) : null}

          {tab === 'community' ? (
            <ScrollView style={styles.panel} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
              {libraryError ? (
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{libraryError}</Text>
              ) : null}
              {published.length === 0 && !libraryError ? (
                <SoftEmptyState
                  theme={theme}
                  title="Nenhum filtro publicado"
                  description="Envie uma imagem na aba Publicar. Ela entra aqui e acompanha o rosto de quem usar."
                />
              ) : null}
              {published.map((filter) => (
                <Pressable
                  key={filter.id}
                  onPress={() => setSelected(filter)}
                  style={[
                    styles.row,
                    {
                      backgroundColor:
                        selected.id === filter.id ? theme.colors.brand.soft : theme.colors.backgroundSubtle,
                      borderRadius: theme.radii.lg,
                    },
                  ]}
                >
                  {filter.image ? (
                    <Image source={{ uri: filter.image }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, { backgroundColor: filter.color, borderRadius: 18 }]} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[theme.typography.bodyMedium, { color: theme.colors.textPrimary }]}>{filter.name}</Text>
                    <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                      {filter.author}
                      {filter.mine ? ' · seu' : ''}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          {tab === 'publish' ? (
            <ScrollView style={styles.panel} contentContainerStyle={{ gap: 10, paddingBottom: 8 }}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                Envie qualquer imagem. Ela cola no rosto e acompanha o movimento, como no Instagram e no Snapchat.
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Nome do filtro"
                placeholderTextColor={theme.colors.placeholder}
                maxLength={40}
                style={[
                  styles.input,
                  theme.typography.body,
                  {
                    color: theme.colors.textPrimary,
                    backgroundColor: theme.colors.inputFill,
                    borderRadius: theme.radii.md,
                  },
                ]}
              />
              <View style={styles.assetRow}>
                {asset ? (
                  <Image
                    source={{ uri: `data:${asset.mimeType};base64,${asset.base64}` }}
                    style={[styles.preview, { backgroundColor: theme.colors.backgroundSubtle }]}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={[styles.preview, { backgroundColor: theme.colors.backgroundSubtle }]} />
                )}
                <View style={{ flex: 1, gap: 6 }}>
                  <SoftButton
                    theme={theme}
                    variant="secondary"
                    size="compact"
                    label={asset ? 'Trocar imagem' : 'Enviar imagem'}
                    onPress={() => void pickImage()}
                  />
                  <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
                    PNG com fundo transparente fica melhor.
                  </Text>
                </View>
              </View>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Onde cola no rosto</Text>
              <View style={styles.wrap}>
                {FILTER_ANCHORS.map((item) => {
                  const on = anchor === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setAnchor(item.id)}
                      style={[
                        styles.mini,
                        {
                          backgroundColor: on ? theme.colors.brand.soft : theme.colors.backgroundSubtle,
                          borderRadius: theme.radii.pill,
                        },
                      ]}
                    >
                      <Text style={[theme.typography.caption, { color: theme.colors.textPrimary }]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.wrap}>
                {FILTER_SIZES.map((item) => {
                  const on = scale === item.scale;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setScale(item.scale)}
                      style={[
                        styles.mini,
                        {
                          backgroundColor: on ? theme.colors.brand.soft : theme.colors.backgroundSubtle,
                          borderRadius: theme.radii.pill,
                        },
                      ]}
                    >
                      <Text style={[theme.typography.caption, { color: theme.colors.textPrimary }]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {publishError ? (
                <Text style={[theme.typography.caption, { color: theme.colors.danger }]}>{publishError}</Text>
              ) : null}
              <SoftButton
                theme={theme}
                label="Publicar filtro"
                onPress={() => void publish()}
                loading={publishing}
                disabled={!authorId || !asset || name.trim().length < 2}
              />
            </ScrollView>
          ) : null}

          <SoftButton
            theme={theme}
            label="Usar esta foto"
            onPress={() => webRef.current?.injectJavaScript('window.capturePhoto(); true;')}
            disabled={!ready || Boolean(cameraError)}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stage: { flex: 1, backgroundColor: '#0E1424' },
  web: { flex: 1, backgroundColor: '#0E1424' },
  sheet: { paddingHorizontal: 16, paddingTop: 12, gap: 10, maxHeight: '52%' },
  tabs: { flexDirection: 'row', gap: 6 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  chips: { gap: 8, paddingVertical: 4 },
  chip: { alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8 },
  panel: { maxHeight: 260 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  thumb: { width: 36, height: 36, borderRadius: 10 },
  assetRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  preview: { width: 72, height: 72, borderRadius: 16 },
  input: { paddingHorizontal: 14, paddingVertical: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mini: { paddingHorizontal: 12, paddingVertical: 8 },
});
