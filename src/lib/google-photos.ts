import * as IntentLauncher from 'expo-intent-launcher';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

export const GOOGLE_PHOTOS_SCOPE = 'https://www.googleapis.com/auth/photoslibrary.appendonly';

const UPLOAD_URL = 'https://photoslibrary.googleapis.com/v1/uploads';
const ALBUMS_URL = 'https://photoslibrary.googleapis.com/v1/albums';
const BATCH_URL = 'https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate';

export type AlbumPhoto = {
  id: string;
  url: string;
};

export type ResenhaAlbumResult = {
  added: number;
  failed: number;
  albumUrl: string | null;
};

function mimeOf(url: string): { mime: string; ext: string } {
  const path = url.split('?')[0]?.toLowerCase() ?? '';
  if (path.endsWith('.png')) return { mime: 'image/png', ext: 'png' };
  if (path.endsWith('.webp')) return { mime: 'image/webp', ext: 'webp' };
  if (path.endsWith('.gif')) return { mime: 'image/gif', ext: 'gif' };
  return { mime: 'image/jpeg', ext: 'jpg' };
}

function authError(status: number): boolean {
  return status === 401 || status === 403;
}

async function uploadBytes(token: string, bytes: ArrayBuffer, mime: string): Promise<string> {
  const response = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'X-Goog-Upload-Content-Type': mime,
      'X-Goog-Upload-Protocol': 'raw',
    },
    body: new Uint8Array(bytes),
  });
  const text = (await response.text()).trim();
  if (!response.ok) {
    throw new Error(text || `Falha ao enviar a foto (${response.status}).`);
  }
  if (!text) throw new Error('O Google Fotos não devolveu o envio da foto.');
  return text;
}

async function createAlbum(token: string, title: string): Promise<{ id: string; productUrl: string | null }> {
  const response = await fetch(ALBUMS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ album: { title: title.slice(0, 500) } }),
  });
  const payload = (await response.json().catch(() => null)) as {
    id?: string;
    productUrl?: string;
    error?: { message?: string; status?: string };
  } | null;
  if (!response.ok || !payload?.id) {
    const message = payload?.error?.message || `Não foi possível criar o álbum (${response.status}).`;
    const error = new Error(message);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return { id: payload.id, productUrl: payload.productUrl ?? null };
}

async function addToAlbum(
  token: string,
  albumId: string,
  items: { token: string; fileName: string; description: string }[],
): Promise<number> {
  let failed = 0;
  for (let index = 0; index < items.length; index += 50) {
    const slice = items.slice(index, index + 50);
    const response = await fetch(BATCH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        albumId,
        newMediaItems: slice.map((item) => ({
          description: item.description.slice(0, 1000),
          simpleMediaItem: { fileName: item.fileName, uploadToken: item.token },
        })),
      }),
    });
    const payload = (await response.json().catch(() => null)) as {
      newMediaItemResults?: { status?: { code?: number } }[];
      error?: { message?: string };
    } | null;
    if (!response.ok && response.status !== 207) {
      throw new Error(payload?.error?.message || `Não foi possível guardar as fotos (${response.status}).`);
    }
    for (const result of payload?.newMediaItemResults ?? []) {
      if (result.status?.code && result.status.code !== 0) failed += 1;
    }
  }
  return failed;
}

async function buildAlbum(
  token: string,
  title: string,
  images: AlbumPhoto[],
): Promise<ResenhaAlbumResult> {
  const prepared: { token: string; fileName: string; description: string }[] = [];
  let uploadFailed = 0;
  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    try {
      const file = mimeOf(image.url);
      const response = await fetch(image.url);
      if (!response.ok) throw new Error('foto indisponível');
      const bytes = await response.arrayBuffer();
      const uploadToken = await uploadBytes(token, bytes, file.mime);
      prepared.push({
        token: uploadToken,
        fileName: `resenha-${index + 1}.${file.ext}`,
        description: title,
      });
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (typeof status === 'number' && authError(status)) throw e;
      if (e instanceof Error && authError(Number(e.message.match(/\b(401|403)\b/)?.[1] ?? 0))) throw e;
      uploadFailed += 1;
    }
  }
  if (prepared.length === 0) {
    throw new Error('Nenhuma foto pôde ser enviada ao Google Fotos.');
  }
  const album = await createAlbum(token, title);
  const batchFailed = await addToAlbum(token, album.id, prepared);
  return {
    added: prepared.length - batchFailed,
    failed: uploadFailed + batchFailed,
    albumUrl: album.productUrl,
  };
}

export async function createResenhaPhotoAlbum(input: {
  title: string;
  images: AlbumPhoto[];
  getToken: (force?: boolean) => Promise<string>;
}): Promise<ResenhaAlbumResult> {
  const title = input.title.trim() || 'Resenha';
  if (input.images.length === 0) {
    throw new Error('Escolha ao menos uma foto.');
  }
  let token = await input.getToken(false);
  try {
    return await buildAlbum(token, title, input.images);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!/401|403|insufficient|permission|auth/i.test(message)) throw e;
    token = await input.getToken(true);
    return buildAlbum(token, title, input.images);
  }
}

export async function openGooglePhotos(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      IntentLauncher.openApplication('com.google.android.apps.photos');
      return;
    } catch {
      // o aplicativo não está instalado
    }
  }
  await Linking.openURL('https://photos.google.com/');
}

export function friendlyPhotosError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (/401|403|insufficient|permission|invalid authentication|accessNotConfigured/i.test(message)) {
    return 'O Google recusou o Fotos. Ative a Photos Library API no Google Cloud, inclua o escopo photoslibrary.appendonly no provider Google do Supabase e autorize de novo.';
  }
  if (/cancelado/i.test(message)) return 'Autorização do Google Fotos cancelada.';
  return message.replace(/^.*error:\s*/i, '');
}
