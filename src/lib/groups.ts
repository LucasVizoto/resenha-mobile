import { missingSupabaseEnvMessage, supabase, supabaseConfigured } from './supabase';
import { mapProfileRow } from './profile';
import { cacheProfile } from './db/profiles';
import { ensureGroupConversation } from './db/conversations';
import type { ChatGroup, ChatGroupMember, ChatGroupRole } from '../types/group';
import type { Profile } from '../types/profile';

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

function missingSchema(message: string) {
  return /schema cache|does not exist|relation|could not find the function|create_chat_group|post_group_message|add_chat_group_members|leave_chat_group/i.test(
    message,
  );
}

export function friendlyGroupError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (missingSchema(message)) {
    return 'Rode supabase/migrations/010_chat_groups.sql e 011_group_members_leave.sql no SQL Editor do Supabase para criar grupos.';
  }
  if (/contato/i.test(message)) {
    return 'Só é possível adicionar pessoas da sua lista de contatos.';
  }
  return message.replace(/^.*error:\s*/i, '');
}

export async function persistGroupLocally(group: ChatGroup, updatedAt?: string): Promise<void> {
  await ensureGroupConversation({
    id: group.id,
    name: group.name,
    description: group.description,
    avatar_url: group.avatar_url,
    updated_at: updatedAt ?? group.updated_at ?? new Date().toISOString(),
  });
}

export async function fetchChatGroup(groupId: string): Promise<ChatGroup | null> {
  if (!supabaseConfigured) return null;
  const { data, error } = await supabase.from('chat_groups').select('*').eq('id', groupId).maybeSingle();
  if (error) {
    if (missingSchema(error.message)) return null;
    throw error;
  }
  if (!data) return null;
  const group = asGroup(data as Record<string, unknown>);
  await persistGroupLocally(group);
  return group;
}

export async function pullMyGroups(): Promise<number> {
  if (!supabaseConfigured) return 0;
  const { data, error } = await supabase
    .from('chat_groups')
    .select('id, name, description, avatar_url, created_by, created_at, updated_at')
    .order('updated_at', { ascending: false });
  if (error) {
    if (!missingSchema(error.message)) {
      console.warn('[Resenha] Falha ao puxar grupos', error.message);
    }
    return 0;
  }
  let applied = 0;
  for (const row of data ?? []) {
    const group = asGroup(row as Record<string, unknown>);
    await persistGroupLocally(group);
    applied += 1;
  }
  return applied;
}

export async function createChatGroup(input: {
  name: string;
  description?: string;
  memberIds: string[];
}): Promise<ChatGroup> {
  if (!supabaseConfigured) {
    throw new Error(missingSupabaseEnvMessage);
  }
  const { data, error } = await supabase.rpc('create_chat_group', {
    p_name: input.name.trim(),
    p_description: input.description?.trim() || null,
    p_member_ids: input.memberIds,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!row?.id) throw new Error('Não foi possível criar o grupo.');
  const group = asGroup(row);
  await persistGroupLocally(group);
  return group;
}

export async function updateChatGroupAvatar(groupId: string, avatarUrl: string): Promise<void> {
  if (!supabaseConfigured) return;
  const { error } = await supabase
    .from('chat_groups')
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq('id', groupId);
  if (error) throw error;
  const group = await fetchChatGroup(groupId);
  if (group) await persistGroupLocally({ ...group, avatar_url: avatarUrl });
}

export async function listGroupMembers(groupId: string): Promise<ChatGroupMember[]> {
  if (!supabaseConfigured) return [];
  const { data: rows, error } = await supabase
    .from('chat_group_members')
    .select('group_id, user_id, role, joined_at')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true });
  if (error) {
    if (missingSchema(error.message)) return [];
    throw error;
  }
  const ids = [...new Set((rows ?? []).map((r) => String((r as { user_id: string }).user_id)))];
  const profiles = new Map<string, Profile>();
  if (ids.length > 0) {
    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', ids);
    if (!profileError) {
      for (const row of profileRows ?? []) {
        const profile = mapProfileRow(row as Record<string, unknown>, String((row as { id: string }).id));
        profiles.set(profile.id, profile);
        await cacheProfile(profile).catch(() => undefined);
      }
    }
  }
  return (rows ?? []).map((row) => {
    const typed = row as {
      group_id: string;
      user_id: string;
      role: ChatGroupRole;
      joined_at?: string;
    };
    return {
      group_id: String(typed.group_id),
      user_id: typed.user_id,
      role: typed.role,
      joined_at: typed.joined_at,
      profile: profiles.get(typed.user_id) ?? null,
    };
  });
}

export async function addChatGroupMembers(groupId: string, memberIds: string[]): Promise<void> {
  if (!supabaseConfigured) {
    throw new Error(missingSupabaseEnvMessage);
  }
  const { error } = await supabase.rpc('add_chat_group_members', {
    p_group_id: groupId,
    p_member_ids: memberIds,
  });
  if (error) throw error;
}

export async function leaveChatGroup(groupId: string): Promise<void> {
  if (!supabaseConfigured) {
    throw new Error(missingSupabaseEnvMessage);
  }
  const { error } = await supabase.rpc('leave_chat_group', { p_group_id: groupId });
  if (error) throw error;
}
