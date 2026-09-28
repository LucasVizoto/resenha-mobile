import * as FileSystem from 'expo-file-system/legacy';
import { missingSupabaseEnvMessage, supabase, supabaseConfigured, supabaseStorageBucket } from './supabase';
import { updateMyAvatarUrl } from './profile';
import type { Profile } from '../types/profile';

function extensionFromMime(mime?: string | null) {
  if (!mime) return 'jpg';
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('heic') || mime.includes('heif')) return 'jpg';
  return 'jpg';
}

function contentTypeFromExt(ext: string) {
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

export function withCacheBust(url: string) {
  const join = url.includes('?') ? '&' : '?';
  return `${url}${join}t=${Date.now()}`;
}

function decodeBase64(base64: string): ArrayBuffer {
  const clean = base64.includes(',') ? (base64.split(',').pop() ?? base64) : base64;
  const binary = globalThis.atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function readLocalImageBytes(uri: string, base64?: string | null): Promise<ArrayBuffer> {
  if (base64) {
    return decodeBase64(base64);
  }

  try {
    const encoded = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });
    if (encoded) return decodeBase64(encoded);
  } catch {
    // continua para o fallback
  }

  const response = await fetch(uri);
  if (response.ok) {
    return response.arrayBuffer();
  }

  throw new Error('Não foi possível ler a imagem selecionada.');
}

export async function uploadProfileAvatar(params: {
  userId: string;
  uri: string;
  mimeType?: string | null;
  base64?: string | null;
}): Promise<Profile> {
  if (!supabaseConfigured) {
    throw new Error(missingSupabaseEnvMessage);
  }

  const ext = extensionFromMime(params.mimeType);
  const contentType = params.mimeType?.startsWith('image/')
    ? params.mimeType
    : contentTypeFromExt(ext);
  const path = `${params.userId}/avatar.${ext}`;
  const bucket = supabaseStorageBucket;

  const body = await readLocalImageBytes(params.uri, params.base64);

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, body, {
    contentType,
    upsert: true,
    cacheControl: '3600',
  });
  if (uploadError) {
    throw new Error(friendlyStorageError(uploadError));
  }

  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);
  let avatarUrl = publicData?.publicUrl ? withCacheBust(publicData.publicUrl) : '';

  if (!avatarUrl) {
    const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365);
    if (signed.error || !signed.data?.signedUrl) {
      throw new Error(friendlyStorageError(signed.error ?? new Error('URL da foto indisponível.')));
    }
    avatarUrl = signed.data.signedUrl;
  }

  return updateMyAvatarUrl(params.userId, avatarUrl);
}

export async function uploadGroupAvatar(params: {
  ownerId: string;
  groupId: string;
  uri: string;
  mimeType?: string | null;
  base64?: string | null;
}): Promise<string> {
  if (!supabaseConfigured) {
    throw new Error(missingSupabaseEnvMessage);
  }

  const ext = extensionFromMime(params.mimeType);
  const contentType = params.mimeType?.startsWith('image/')
    ? params.mimeType
    : contentTypeFromExt(ext);
  const path = `${params.ownerId}/groups/${params.groupId}.${ext}`;
  const bucket = supabaseStorageBucket;
  const body = await readLocalImageBytes(params.uri, params.base64);

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, body, {
    contentType,
    upsert: true,
    cacheControl: '3600',
  });
  if (uploadError) {
    throw new Error(friendlyStorageError(uploadError));
  }

  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);
  let avatarUrl = publicData?.publicUrl ? withCacheBust(publicData.publicUrl) : '';
  if (!avatarUrl) {
    const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365);
    if (signed.error || !signed.data?.signedUrl) {
      throw new Error(friendlyStorageError(signed.error ?? new Error('URL da foto indisponível.')));
    }
    avatarUrl = signed.data.signedUrl;
  }
  return avatarUrl;
}

function errorMessage(e: unknown): string {
  if (!e) return 'Erro desconhecido.';
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && 'message' in e && (e as { message?: unknown }).message) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}

export function friendlyStorageError(e: unknown): string {
  const message = errorMessage(e);
  if (/bucket|not found|does not exist/i.test(message)) {
    return `Bucket "${supabaseStorageBucket}" não encontrado. Confira o nome em Storage no Supabase ou EXPO_PUBLIC_SUPABASE_STORAGE_BUCKET no .env.`;
  }
  if (/row-level security|policy|unauthorized|403|401/i.test(message)) {
    return 'Sem permissão para enviar a foto. Rode supabase/migrations/003_contacts_and_storage.sql no SQL Editor (políticas do Storage).';
  }
  return message;
}
