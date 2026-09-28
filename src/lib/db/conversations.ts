import { getDb } from './client';
import { cacheProfile, getCachedProfile } from './profiles';
import { mapProfileRow } from '../profile';
import { supabase, supabaseConfigured } from '../supabase';
import { PROFILE_COLUMNS } from '../../types/profile';
import type { Conversation } from '../../types/conversation';
import type { Profile } from '../../types/profile';

export function isGroupConversationId(conversationId: string): boolean {
  return Boolean(conversationId) && !conversationId.includes('_');
}

export function otherParticipantId(
  conversationId: string,
  myId: string,
  storedPeer?: string | null,
): string | null {
  const parts = conversationId.split('_');
  if (parts.length === 2) {
    if (parts[0] === myId) return parts[1];
    if (parts[1] === myId) return parts[0];
  }
  if (storedPeer && storedPeer !== myId) return storedPeer;
  return null;
}

async function loadPeerProfile(peerId: string): Promise<Profile | null> {
  const cached = await getCachedProfile(peerId);
  if (cached) return cached;
  if (!supabaseConfigured) return null;
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', peerId).maybeSingle();
  if (error || !data) return null;
  const profile = mapProfileRow(data as Record<string, unknown>, peerId);
  await cacheProfile(profile);
  return profile;
}

async function withPeer(row: Conversation, myId: string): Promise<Conversation> {
  const kind = row.kind === 'group' || isGroupConversationId(row.id) ? 'group' : 'dm';
  if (kind === 'group') {
    return {
      ...row,
      kind: 'group',
      unread_count: Number(row.unread_count ?? 0),
      peer_display_name: row.peer_display_name ?? row.title,
    };
  }
  const peerId = otherParticipantId(row.id, myId, row.peer_user_id);
  if (!peerId) {
    return { ...row, unread_count: Number(row.unread_count ?? 0) };
  }
  const needsHydrate =
    peerId !== row.peer_user_id || !row.peer_display_name || !row.peer_avatar_url;
  let next: Conversation = {
    ...row,
    peer_user_id: peerId,
    unread_count: Number(row.unread_count ?? 0),
  };
  if (needsHydrate) {
    const profile = await loadPeerProfile(peerId);
    if (profile) {
      next = {
        ...next,
        peer_display_name: profile.display_name ?? profile.username,
        peer_avatar_url: profile.avatar_url,
      };
    }
  }
  if (next.peer_user_id !== row.peer_user_id || next.peer_display_name !== row.peer_display_name) {
    await getDb().runAsync(
      `UPDATE conversations
       SET peer_user_id = ?, peer_display_name = ?, peer_avatar_url = ?
       WHERE id = ?`,
      [next.peer_user_id, next.peer_display_name ?? null, next.peer_avatar_url ?? null, next.id],
    );
  }
  return next;
}

export async function listConversations(myId: string): Promise<Conversation[]> {
  const rows = await getDb().getAllAsync<Conversation>(
    `SELECT
       c.id, c.title, c.peer_user_id, c.peer_display_name, c.peer_avatar_url, c.updated_at, c.last_read_at,
       c.kind, c.description,
       (SELECT m.body FROM messages m
         WHERE m.conversation_id = c.id
         ORDER BY m.created_at DESC LIMIT 1) AS last_message_body,
       (SELECT m.sender_id FROM messages m
         WHERE m.conversation_id = c.id
         ORDER BY m.created_at DESC LIMIT 1) AS last_message_sender_id,
       (SELECT COUNT(*) FROM messages m
         WHERE m.conversation_id = c.id
           AND m.sender_id != ?
           AND (c.last_read_at IS NULL OR m.created_at > c.last_read_at)
       ) AS unread_count
     FROM conversations c
     ORDER BY c.updated_at DESC`,
    [myId],
  );
  const result: Conversation[] = [];
  for (const row of rows) {
    result.push(await withPeer(row, myId));
  }
  return result;
}

export async function getConversation(id: string, myId?: string): Promise<Conversation | null> {
  const row = await getDb().getFirstAsync<Conversation>(
    `SELECT id, title, peer_user_id, peer_display_name, peer_avatar_url, updated_at, last_read_at, kind, description
     FROM conversations WHERE id = ?`,
    [id],
  );
  if (!row) return null;
  if (!myId) return row;
  return withPeer(row, myId);
}

export async function upsertConversation(c: Conversation): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO conversations (id, title, peer_user_id, peer_display_name, peer_avatar_url, updated_at, last_read_at, kind, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title=excluded.title,
       peer_user_id=excluded.peer_user_id,
       peer_display_name=excluded.peer_display_name,
       peer_avatar_url=excluded.peer_avatar_url,
       updated_at=excluded.updated_at,
       kind=excluded.kind,
       description=excluded.description`,
    [
      c.id,
      c.title ?? null,
      c.peer_user_id ?? null,
      c.peer_display_name ?? null,
      c.peer_avatar_url ?? null,
      c.updated_at,
      c.last_read_at ?? null,
      c.kind ?? (isGroupConversationId(c.id) ? 'group' : 'dm'),
      c.description ?? null,
    ],
  );
}

export async function touchConversation(id: string, updatedAt: string): Promise<void> {
  await getDb().runAsync(`UPDATE conversations SET updated_at = ? WHERE id = ?`, [
    updatedAt,
    id,
  ]);
}

export async function ensureConversationWithPeer(
  conversationId: string,
  peerId: string,
  updatedAt: string,
): Promise<void> {
  if (isGroupConversationId(conversationId)) {
    await ensureGroupConversation({
      id: conversationId,
      name: null,
      description: null,
      avatar_url: null,
      updated_at: updatedAt,
    });
    return;
  }
  const existing = await getDb().getFirstAsync<{ id: string }>(
    `SELECT id FROM conversations WHERE id = ?`,
    [conversationId],
  );
  if (existing) {
    await touchConversation(conversationId, updatedAt);
    return;
  }
  const profile = await getCachedProfile(peerId).catch(() => null);
  await upsertConversation({
    id: conversationId,
    title: profile?.display_name ?? profile?.username ?? null,
    peer_user_id: peerId,
    peer_display_name: profile?.display_name ?? profile?.username ?? null,
    peer_avatar_url: profile?.avatar_url ?? null,
    updated_at: updatedAt,
    kind: 'dm',
  });
}

export async function ensureGroupConversation(input: {
  id: string;
  name?: string | null;
  description?: string | null;
  avatar_url?: string | null;
  updated_at: string;
}): Promise<void> {
  const existing = await getDb().getFirstAsync<Conversation>(
    `SELECT id, title, description, peer_avatar_url, peer_display_name, last_read_at, updated_at
     FROM conversations WHERE id = ?`,
    [input.id],
  );
  const updatedAt =
    existing?.updated_at && existing.updated_at > input.updated_at
      ? existing.updated_at
      : input.updated_at;
  await upsertConversation({
    id: input.id,
    title: input.name ?? existing?.title ?? 'Grupo',
    peer_user_id: null,
    peer_display_name: input.name ?? existing?.peer_display_name ?? existing?.title ?? 'Grupo',
    peer_avatar_url: input.avatar_url ?? existing?.peer_avatar_url ?? null,
    updated_at: updatedAt,
    last_read_at: existing?.last_read_at ?? null,
    kind: 'group',
    description: input.description ?? existing?.description ?? null,
  });
}

export async function markConversationRead(id: string): Promise<void> {
  await getDb().runAsync(`UPDATE conversations SET last_read_at = ? WHERE id = ?`, [
    new Date().toISOString(),
    id,
  ]);
}

export async function countUnread(myId: string): Promise<number> {
  const row = await getDb().getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(unread), 0) AS total FROM (
       SELECT (
         SELECT COUNT(*) FROM messages m
         WHERE m.conversation_id = c.id
           AND m.sender_id != ?
           AND (c.last_read_at IS NULL OR m.created_at > c.last_read_at)
       ) AS unread
       FROM conversations c
     )`,
    [myId],
  );
  return Number(row?.total ?? 0);
}
