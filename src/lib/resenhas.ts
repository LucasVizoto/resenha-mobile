import { missingSupabaseEnvMessage, supabase, supabaseConfigured } from './supabase';
import { mapProfileRow } from './profile';
import { ensureConversationWithPeer } from './db/conversations';
import { insertMessage, newMessageId } from './db/messages';
import { deliverOutgoingMessage } from './message-sync';
import type { Profile } from '../types/profile';
import type { Resenha, ResenhaMember, ResenhaMemberRole } from '../types/resenha';

function asProfile(row: Record<string, unknown>): Profile {
  return mapProfileRow(row, String(row.id ?? ''));
}

function asResenha(row: Record<string, unknown>, members?: ResenhaMember[]): Resenha {
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
    members,
  };
}

async function loadMembers(resenhaIds: string[]): Promise<Map<string, ResenhaMember[]>> {
  const byResenha = new Map<string, ResenhaMember[]>();
  if (resenhaIds.length === 0) return byResenha;

  const { data: rows, error } = await supabase
    .from('resenha_members')
    .select('resenha_id, user_id, role')
    .in('resenha_id', resenhaIds);
  if (error) throw error;

  const userIds = [...new Set((rows ?? []).map((r) => String((r as { user_id: string }).user_id)))];
  const profiles = new Map<string, Profile>();
  if (userIds.length > 0) {
    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds);
    if (profileError) throw profileError;
    for (const row of profileRows ?? []) {
      const profile = asProfile(row as Record<string, unknown>);
      profiles.set(profile.id, profile);
    }
  }

  for (const row of rows ?? []) {
    const typed = row as { resenha_id: string; user_id: string; role: ResenhaMemberRole };
    const list = byResenha.get(typed.resenha_id) ?? [];
    list.push({
      user_id: typed.user_id,
      role: typed.role,
      profile: profiles.get(typed.user_id) ?? null,
    });
    byResenha.set(typed.resenha_id, list);
  }
  return byResenha;
}

export function resenhaHasPassed(occursAt: string, now = Date.now()): boolean {
  const time = new Date(occursAt).getTime();
  return !Number.isFinite(time) || time <= now;
}

export async function purgeExpiredResenhas(): Promise<void> {
  if (!supabaseConfigured) return;
  const { error } = await supabase.rpc('purge_expired_resenhas');
  if (error && !/schema cache|does not exist|could not find the function/i.test(error.message)) {
    console.warn('[Resenha] Falha ao remover resenhas vencidas', error.message);
  }
}

export async function listMyResenhas(userId: string): Promise<Resenha[]> {
  if (!supabaseConfigured) return [];
  await purgeExpiredResenhas();
  const { data: memberships, error: memberError } = await supabase
    .from('resenha_members')
    .select('resenha_id')
    .eq('user_id', userId);
  if (memberError) throw memberError;
  const ids = [...new Set((memberships ?? []).map((r) => String((r as { resenha_id: string }).resenha_id)))];
  if (ids.length === 0) return [];

  const { data, error } = await supabase.from('resenhas').select('*').in('id', ids).order('occurs_at', {
    ascending: true,
  });
  if (error) throw error;
  return (data ?? [])
    .map((row) => asResenha(row as Record<string, unknown>))
    .filter((row) => !resenhaHasPassed(row.occurs_at));
}

export async function getResenha(resenhaId: string): Promise<Resenha | null> {
  if (!supabaseConfigured) return null;
  await purgeExpiredResenhas();
  const { data, error } = await supabase.from('resenhas').select('*').eq('id', resenhaId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const resenha = asResenha(data as Record<string, unknown>);
  if (resenhaHasPassed(resenha.occurs_at)) return null;
  const members = await loadMembers([resenhaId]);
  return { ...resenha, members: members.get(resenhaId) ?? [] };
}

export async function cancelResenha(resenhaId: string): Promise<void> {
  if (!supabaseConfigured) {
    throw new Error(missingSupabaseEnvMessage);
  }
  const { error } = await supabase.from('resenhas').delete().eq('id', resenhaId);
  if (error) throw error;
}

export async function notifyResenhaGuests(myId: string, guestIds: string[], body: string): Promise<void> {
  const text = body.trim();
  if (text.length < 1) {
    throw new Error('Escreva a mensagem para os participantes.');
  }
  const createdAt = new Date().toISOString();
  for (const guestId of guestIds) {
    if (!guestId || guestId === myId) continue;
    const conversationId = [myId, guestId].sort().join('_');
    await ensureConversationWithPeer(conversationId, guestId, createdAt);
    const msg = {
      id: newMessageId(),
      conversation_id: conversationId,
      sender_id: myId,
      body: text,
      created_at: createdAt,
      status: 'sent' as const,
      synced: false,
    };
    await insertMessage(msg);
    await deliverOutgoingMessage(msg, myId);
  }
}

export async function createResenha(input: {
  name: string;
  occursAt: Date;
  icon: string;
  iconEmoji?: string | null;
  iconLabel?: string | null;
  latitude: number;
  longitude: number;
  guestIds: string[];
}): Promise<string> {
  if (!supabaseConfigured) {
    throw new Error(missingSupabaseEnvMessage);
  }
  const name = input.name.trim();
  if (name.length < 2) {
    throw new Error('Informe um nome para a resenha.');
  }
  if (!input.guestIds.length) {
    throw new Error('Convide ao menos uma pessoa dos seus contatos.');
  }
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
    throw new Error('Escolha o local da resenha no mapa.');
  }

  const base = {
    p_name: name,
    p_occurs_at: input.occursAt.toISOString(),
    p_icon: input.icon,
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_guest_ids: input.guestIds,
  };
  const extra = {
    p_icon_emoji: input.iconEmoji?.trim() || null,
    p_icon_label: input.iconLabel?.trim() || null,
  };

  let { data, error } = await supabase.rpc('create_resenha', { ...base, ...extra });
  if (error && /could not find the function|schema cache/i.test(error.message)) {
    if (input.icon.startsWith('custom_')) {
      throw new Error(
        'Rode supabase/migrations/007_custom_icons.sql no SQL Editor do Supabase para salvar ícones personalizados.',
      );
    }
    const retry = await supabase.rpc('create_resenha', base);
    data = retry.data;
    error = retry.error;
  }
  if (error) throw error;
  return String(data);
}

export async function listResenhasToInvite(myId: string, peerId: string): Promise<Resenha[]> {
  const mine = await listMyResenhas(myId);
  if (mine.length === 0) return [];
  const members = await loadMembers(mine.map((row) => row.id));
  return mine.filter((row) => !(members.get(row.id) ?? []).some((m) => m.user_id === peerId));
}

export async function addResenhaGuest(resenhaId: string, userId: string): Promise<void> {
  if (!supabaseConfigured) {
    throw new Error(missingSupabaseEnvMessage);
  }
  const { error } = await supabase.rpc('add_resenha_guest', {
    p_resenha_id: resenhaId,
    p_user_id: userId,
  });
  if (error) throw error;
}

export function friendlyResenhaError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (/007_custom_icons|icon_emoji|ícones personalizados/i.test(message)) {
    return 'Rode supabase/migrations/007_custom_icons.sql no SQL Editor do Supabase para ícones personalizados.';
  }
  if (/add_resenha_guest/i.test(message)) {
    return 'Rode supabase/migrations/006_add_resenha_guest.sql no SQL Editor do Supabase para adicionar pessoas a uma resenha existente.';
  }
  if (/relation|schema cache|does not exist|could not find the function/i.test(message)) {
    return 'As tabelas de resenha ainda não existem. Rode supabase/migrations/005_resenhas.sql no SQL Editor do Supabase.';
  }
  if (/contato com ao menos um participante/i.test(message)) {
    return 'Essa pessoa precisa ter ao menos um dos participantes nos contatos.';
  }
  return message.replace(/^.*error:\s*/i, '');
}
