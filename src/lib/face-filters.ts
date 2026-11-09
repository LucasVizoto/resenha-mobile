import { uploadFilterImage } from './storage';
import { supabase, supabaseConfigured } from './supabase';

export type FilterStyle =
  | 'none'
  | 'glasses'
  | 'aviator'
  | 'dog'
  | 'cat'
  | 'bunny'
  | 'neon'
  | 'smooth'
  | 'tint'
  | 'thug'
  | 'marks'
  | 'gandalf'
  | 'custom';

export type FaceAnchor = 'forehead' | 'eyes' | 'nose' | 'cheeks' | 'mouth' | 'face';

export type FaceFilter = {
  id: string;
  name: string;
  author: string;
  style: FilterStyle;
  color: string;
  scale: number;
  anchor?: FaceAnchor;
  image?: string;
  mine?: boolean;
};

export const FILTER_ANCHORS: { id: FaceAnchor; label: string }[] = [
  { id: 'eyes', label: 'Olhos' },
  { id: 'forehead', label: 'Testa' },
  { id: 'nose', label: 'Nariz' },
  { id: 'mouth', label: 'Boca' },
  { id: 'cheeks', label: 'Bochechas' },
  { id: 'face', label: 'Rosto' },
];

export const FILTER_STYLES: { id: Exclude<FilterStyle, 'none' | 'custom'>; label: string; color: string }[] = [
  { id: 'glasses', label: 'Óculos', color: '#1A1D24' },
  { id: 'aviator', label: 'Aviador', color: '#C9A227' },
  { id: 'dog', label: 'Cão', color: '#C47A3A' },
  { id: 'cat', label: 'Gato', color: '#F4B7C6' },
  { id: 'bunny', label: 'Coelho', color: '#F6D7E4' },
  { id: 'neon', label: 'Neon', color: '#3DE0FF' },
  { id: 'smooth', label: 'Beleza', color: '#F3C7B0' },
  { id: 'tint', label: 'Cor', color: '#2F6BFF' },
  { id: 'thug', label: 'Thug Life', color: '#111111' },
  { id: 'marks', label: 'Landmarks', color: '#39FF6A' },
  { id: 'gandalf', label: 'Gandalf', color: '#8D8D8D' },
];

export const FILTER_COLORS = ['#1A1D24', '#C9A227', '#C47A3A', '#F4B7C6', '#E45B78', '#3DE0FF', '#7B6CFF', '#F3C7B0'];

export const FILTER_SIZES = [
  { id: 'sm', label: 'Pequeno', scale: 0.55 },
  { id: 'md', label: 'Médio', scale: 0.85 },
  { id: 'lg', label: 'Grande', scale: 1.15 },
];

const COLOR_FILTERS: FaceFilter[] = [
  { id: 'tint-blue', name: 'Azul', author: 'Resenha', style: 'tint', color: '#2F6BFF', scale: 1 },
  { id: 'tint-red', name: 'Vermelho', author: 'Resenha', style: 'tint', color: '#E23B3B', scale: 1 },
  { id: 'tint-green', name: 'Verde', author: 'Resenha', style: 'tint', color: '#21C45A', scale: 1 },
  { id: 'tint-gold', name: 'Dourado', author: 'Resenha', style: 'tint', color: '#E2B33C', scale: 1 },
  { id: 'tint-violet', name: 'Roxo', author: 'Resenha', style: 'tint', color: '#7B6CFF', scale: 1 },
];

export const SYSTEM_FILTERS: FaceFilter[] = [
  { id: 'none', name: 'Sem filtro', author: 'Resenha', style: 'none', color: '#1A1D24', scale: 1 },
  ...FILTER_STYLES.filter((style) => style.id !== 'tint').map((style) => ({
    id: style.id,
    name: style.label,
    author: 'Resenha',
    style: style.id,
    color: style.color,
    scale: style.id === 'glasses' || style.id === 'aviator' || style.id === 'thug' || style.id === 'gandalf' ? 1 : 0.9,
  })),
  ...COLOR_FILTERS,
];

function parsePacked(raw: string): { style: FilterStyle; color: string } | null {
  const [style, color] = raw.split('|');
  const known = FILTER_STYLES.find((item) => item.id === style);
  if (!known) return null;
  const tint = /^#[0-9A-Fa-f]{6}$/.test(color || '') ? color : known.color;
  return { style: known.id, color: tint };
}

const FILTER_COLUMNS = 'id, author_id, author_name, name, anchor, emoji, scale, image_url';

function asAnchor(value: string): FaceAnchor {
  const known = FILTER_ANCHORS.find((item) => item.id === value);
  return known ? known.id : 'eyes';
}

function asFilter(row: Record<string, unknown>, myId: string | null): FaceFilter | null {
  const id = String(row.id ?? '');
  const name = String(row.name ?? '').trim();
  const scale = Number(row.scale);
  const image = String(row.image_url ?? '').trim();
  if (!id || !name || !Number.isFinite(scale)) return null;
  const mine = myId != null && String(row.author_id ?? '') === myId;
  const author = String(row.author_name ?? 'Alguém');
  if (/^https?:\/\//i.test(image)) {
    return {
      id,
      name,
      author,
      style: 'custom',
      color: '#1A1D24',
      scale,
      anchor: asAnchor(String(row.anchor ?? '')),
      image,
      mine,
    };
  }
  const packed = parsePacked(String(row.emoji ?? '').trim());
  if (!packed) return null;
  return {
    id,
    name,
    author,
    style: packed.style,
    color: packed.color,
    scale,
    anchor: asAnchor(String(row.anchor ?? '')),
    mine,
  };
}

const LEGACY_COLUMNS = 'id, author_id, author_name, name, anchor, emoji, scale';

function rowsToFilters(data: unknown[] | null, myId: string | null): FaceFilter[] {
  return (data ?? [])
    .map((row) => asFilter(row as Record<string, unknown>, myId))
    .filter((row): row is FaceFilter => row != null);
}

export async function listCommunityFilters(myId: string | null): Promise<FaceFilter[]> {
  if (!supabaseConfigured) return [];
  const first = await supabase
    .from('face_filters')
    .select(FILTER_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(40);
  if (first.error && /image_url|schema cache|could not find/i.test(first.error.message)) {
    const legacy = await supabase
      .from('face_filters')
      .select(LEGACY_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(40);
    if (legacy.error) throw legacy.error;
    return rowsToFilters(legacy.data, myId);
  }
  if (first.error) throw first.error;
  return rowsToFilters(first.data, myId);
}

export async function publishFaceFilter(input: {
  authorId: string;
  authorName: string;
  name: string;
  anchor: FaceAnchor;
  scale: number;
  uri: string;
  mimeType?: string | null;
  base64?: string | null;
}): Promise<FaceFilter> {
  if (!supabaseConfigured) {
    throw new Error('O Supabase não está configurado para publicar filtros.');
  }
  const name = input.name.trim();
  if (name.length < 2) throw new Error('Dê um nome com pelo menos 2 letras.');
  if (!input.uri && !input.base64) throw new Error('Envie a imagem do filtro.');
  const anchor = asAnchor(input.anchor);
  const scale = Math.min(1.5, Math.max(0.25, input.scale));
  const imageUrl = await uploadFilterImage({
    userId: input.authorId,
    uri: input.uri,
    mimeType: input.mimeType,
    base64: input.base64,
  });
  const { data, error } = await supabase
    .from('face_filters')
    .insert({
      author_id: input.authorId,
      author_name: input.authorName.trim() || 'Você',
      name,
      anchor,
      emoji: 'custom',
      image_url: imageUrl,
      scale,
    })
    .select(FILTER_COLUMNS)
    .single();
  if (error) throw error;
  const filter = asFilter(data as Record<string, unknown>, input.authorId);
  if (!filter?.image) throw new Error('Não foi possível publicar o filtro.');
  return filter;
}

export function friendlyFilterError(e: unknown): string {
  const record = e && typeof e === 'object' ? (e as { message?: unknown }) : null;
  const message = typeof record?.message === 'string' ? record.message : e instanceof Error ? e.message : '';
  if (/face_filters|image_url|schema cache|does not exist|could not find|anchor_check/i.test(message)) {
    return 'Rode supabase/migrations/018_custom_face_filters.sql no SQL Editor para publicar filtros da comunidade.';
  }
  return message.trim() || 'Não foi possível publicar o filtro.';
}
