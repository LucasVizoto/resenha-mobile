import { missingSupabaseEnvMessage, supabase, supabaseConfigured } from './supabase';
import { persistGroupLocally } from './groups';
import type { ChatGroup } from '../types/group';
import type { Resenha } from '../types/resenha';

function asGroup(row: Record<string, unknown>): ChatGroup {
  return {
    id: String(row.id),
    name: String(row.name ?? 'Grupo'),
    description: typeof row.description === 'string' ? row.description : null,
    avatar_url: typeof row.avatar_url === 'string' ? row.avatar_url : null,
    created_by: String(row.created_by ?? ''),
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  };
}

function asResenha(row: Record<string, unknown>): Resenha {
  return {
    id: String(row.id),
    host_id: String(row.host_id),
    name: String(row.name ?? ''),
    occurs_at: String(row.occurs_at ?? ''),
    icon: String(row.icon ?? 'soccer'),
    icon_emoji: typeof row.icon_emoji === 'string' ? row.icon_emoji : null,
    icon_label: typeof row.icon_label === 'string' ? row.icon_label : null,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  };
}

function missingLinkSchema(message: string) {
  return /schema cache|does not exist|could not find the function|chat_group_resenhas|groups_covering_resenha|create_resenha_chat_group|link_chat_group_resenha|list_group_resenhas|resenhas_covering_group|resenha_origin_chat_group|group_origin_resenha_for_host/i.test(
    message,
  );
}

function messageOf(e: unknown): string {
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string') {
    return e.message;
  }
  return '';
}

export function friendlyGroupResenhaError(e: unknown): string {
  const message = messageOf(e);
  if (missingLinkSchema(message)) {
    return 'Rode supabase/migrations/013_group_resenhas.sql e 014_chat_images.sql no SQL Editor do Supabase para vincular grupos e resenhas.';
  }
  const cleaned = message.replace(/^.*error:\s*/i, '').trim();
  if (!cleaned || cleaned === '[object Object]') {
    return 'Não foi possível carregar as resenhas deste grupo.';
  }
  return cleaned;
}

function rowsOf(data: unknown): Record<string, unknown>[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  return [data as Record<string, unknown>];
}

export async function listGroupsCoveringResenha(resenhaId: string): Promise<ChatGroup[]> {
  if (!supabaseConfigured) return [];
  const { data, error } = await supabase.rpc('groups_covering_resenha', {
    p_resenha_id: resenhaId,
  });
  if (error) throw error;
  return rowsOf(data).map(asGroup);
}

export async function createResenhaChatGroup(input: {
  resenhaId: string;
  name: string;
  description?: string;
}): Promise<ChatGroup> {
  if (!supabaseConfigured) {
    throw new Error(missingSupabaseEnvMessage);
  }
  const { data, error } = await supabase.rpc('create_resenha_chat_group', {
    p_resenha_id: input.resenhaId,
    p_name: input.name.trim(),
    p_description: input.description?.trim() || null,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!row?.id) throw new Error('Não foi possível criar o grupo.');
  const group = asGroup(row);
  await persistGroupLocally(group);
  return group;
}

export async function findResenhaOriginGroup(resenhaId: string): Promise<ChatGroup | null> {
  if (!supabaseConfigured) return null;
  const { data, error } = await supabase.rpc('resenha_origin_chat_group', {
    p_resenha_id: resenhaId,
  });
  if (error) throw error;
  const row = rowsOf(data)[0];
  return row ? asGroup(row) : null;
}

function descriptionSaysOrigin(description: string | null | undefined): boolean {
  return /^Chat da resenha\s+/i.test(description ?? '');
}

function titleFromOriginGroup(group: ChatGroup): string {
  const description = group.description ?? '';
  const fromDescription = description.replace(/^Chat da resenha\s+/i, '').trim();
  return fromDescription || group.name;
}

function syntheticOriginResenha(group: ChatGroup, hostId: string): Resenha {
  return {
    id: group.id,
    host_id: hostId,
    name: titleFromOriginGroup(group),
    occurs_at: new Date(0).toISOString(),
    icon: 'party',
    latitude: 0,
    longitude: 0,
  };
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

async function hostResenhaFromLinks(group: ChatGroup, hostId: string): Promise<Resenha | null | undefined> {
  const withOrigin = await supabase
    .from('chat_group_resenhas')
    .select('resenha_id, origin')
    .eq('group_id', group.id);
  let rows: { resenha_id: string; origin: string | null }[] = [];
  let hasOriginColumn = true;
  if (withOrigin.error) {
    if (!/origin/i.test(messageOf(withOrigin.error))) {
      if (missingLinkSchema(messageOf(withOrigin.error))) return undefined;
      throw withOrigin.error;
    }
    hasOriginColumn = false;
    const plain = await supabase.from('chat_group_resenhas').select('resenha_id').eq('group_id', group.id);
    if (plain.error) {
      if (missingLinkSchema(messageOf(plain.error))) return undefined;
      throw plain.error;
    }
    rows = (plain.data ?? []).map((row) => ({
      resenha_id: String((row as { resenha_id: string }).resenha_id),
      origin: null,
    }));
  } else {
    rows = (withOrigin.data ?? []).map((row) => {
      const typed = row as { resenha_id: string; origin?: string | null };
      return { resenha_id: String(typed.resenha_id), origin: typed.origin ?? null };
    });
  }

  if (rows.length === 0) return undefined;

  const originIds = rows
    .filter((row) => {
      if (!hasOriginColumn) return descriptionSaysOrigin(group.description);
      if (row.origin === 'created') return true;
      return row.origin == null && descriptionSaysOrigin(group.description);
    })
    .map((row) => row.resenha_id);
  if (originIds.length === 0) return null;

  const { data, error } = await supabase.from('resenhas').select('*').in('id', originIds).eq('host_id', hostId);
  if (error) throw error;
  const row = (data ?? [])[0] as Record<string, unknown> | undefined;
  return row ? asResenha(row) : null;
}

export async function findGroupOriginResenhaForHost(group: ChatGroup): Promise<Resenha | null> {
  if (!supabaseConfigured) return null;
  const hostId = await currentUserId();
  if (!hostId) return null;

  const { data, error } = await supabase.rpc('group_origin_resenha_for_host', {
    p_group_id: group.id,
  });
  if (!error) {
    const row = rowsOf(data)[0];
    if (row) return asResenha(row);
  } else if (!missingLinkSchema(messageOf(error))) {
    console.warn('[Resenha] origem do álbum', error);
  }

  try {
    const linked = await hostResenhaFromLinks(group, hostId);
    if (linked) return linked;
    if (linked === null) return null;
  } catch (e) {
    console.warn('[Resenha] origem do álbum', e);
  }

  if (group.created_by === hostId && descriptionSaysOrigin(group.description)) {
    return syntheticOriginResenha(group, hostId);
  }
  return null;
}

export async function linkGroupResenha(groupId: string, resenhaId: string): Promise<void> {
  if (!supabaseConfigured) {
    throw new Error(missingSupabaseEnvMessage);
  }
  const { error } = await supabase.rpc('link_chat_group_resenha', {
    p_group_id: groupId,
    p_resenha_id: resenhaId,
  });
  if (error) throw error;
}

export async function listLinkedResenhas(groupId: string): Promise<Resenha[]> {
  if (!supabaseConfigured) return [];
  const { data, error } = await supabase.rpc('list_group_resenhas', {
    p_group_id: groupId,
  });
  if (error) throw error;
  return rowsOf(data).map(asResenha);
}

export async function listResenhasCoveringGroup(groupId: string): Promise<Resenha[]> {
  if (!supabaseConfigured) return [];
  const { data, error } = await supabase.rpc('resenhas_covering_group', {
    p_group_id: groupId,
  });
  if (error) throw error;
  return rowsOf(data).map(asResenha);
}
