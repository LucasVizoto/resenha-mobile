import { AppState } from 'react-native';
import { displayNameFor } from './invites';
import {
  hasExpoPushToken,
  presentIncomingNotification,
  sendExpoPushToTokens,
} from './notifications';
import { fetchMyProfile, mapProfileRow } from './profile';
import { supabase, supabaseConfigured } from './supabase';
import { ensureConversationWithPeer, isGroupConversationId, otherParticipantId } from './db/conversations';
import { persistGroupLocally, fetchChatGroup } from './groups';
import { getCachedProfile } from './db/profiles';
import {
  insertIncomingMessage,
  listUnsyncedMessages,
  markMessageSynced,
} from './db/messages';
import { PROFILE_COLUMNS } from '../types/profile';
import type { Message } from '../types/message';

type RemoteChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
};

function asRemote(row: Record<string, unknown>): RemoteChatMessage | null {
  const id = String(row.id ?? '');
  const conversationId = String(row.conversation_id ?? '');
  const senderId = String(row.sender_id ?? '');
  const recipientId = String(row.recipient_id ?? '');
  const body = String(row.body ?? '').trim();
  if (!id || !conversationId || !senderId || !recipientId || !body) return null;
  return {
    id,
    conversation_id: conversationId,
    sender_id: senderId,
    recipient_id: recipientId,
    body,
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

function missingSchema(message: string) {
  return /schema cache|does not exist|relation|could not find the/i.test(message);
}

function tokensFromRpc(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => (typeof row === 'string' ? row : String((row as { token?: string } | null)?.token ?? '')))
    .filter(Boolean);
}

async function senderLabel(senderId: string): Promise<string> {
  const cached = await getCachedProfile(senderId).catch(() => null);
  if (cached) return displayNameFor(cached);
  if (!supabaseConfigured) return 'Nova mensagem';
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', senderId)
    .maybeSingle();
  if (error || !data) return 'Nova mensagem';
  return displayNameFor(mapProfileRow(data as Record<string, unknown>, senderId));
}

export async function applyIncomingRemoteMessage(
  row: Record<string, unknown>,
  myId: string,
  options?: { notify?: boolean },
): Promise<boolean> {
  const remote = asRemote(row);
  if (!remote || remote.recipient_id !== myId || remote.sender_id === myId) return false;

  if (isGroupConversationId(remote.conversation_id)) {
    const group = await fetchChatGroup(remote.conversation_id).catch(() => null);
    if (group) {
      await persistGroupLocally(group, remote.created_at);
    } else {
      await ensureConversationWithPeer(remote.conversation_id, remote.sender_id, remote.created_at);
    }
  } else {
    await ensureConversationWithPeer(remote.conversation_id, remote.sender_id, remote.created_at);
  }
  const inserted = await insertIncomingMessage({
    id: remote.id,
    conversation_id: remote.conversation_id,
    sender_id: remote.sender_id,
    body: remote.body,
    created_at: remote.created_at,
    status: 'sent',
    synced: true,
  });
  if (!inserted) return false;

  if (options?.notify) {
    const appActive = AppState.currentState === 'active';
    const shouldLocal =
      appActive || !hasExpoPushToken();
    if (shouldLocal) {
      let title = await senderLabel(remote.sender_id);
      if (isGroupConversationId(remote.conversation_id)) {
        const group = await fetchChatGroup(remote.conversation_id).catch(() => null);
        if (group?.name) title = `${title} · ${group.name}`;
      }
      await presentIncomingNotification({
        messageId: remote.id,
        conversationId: remote.conversation_id,
        title,
        body: remote.body,
      });
    }
  }
  return true;
}

export async function pullIncomingMessages(myId: string): Promise<number> {
  if (!supabaseConfigured) return 0;
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, conversation_id, sender_id, recipient_id, body, created_at')
    .eq('recipient_id', myId)
    .order('created_at', { ascending: true })
    .limit(300);
  if (error) {
    if (!missingSchema(error.message)) {
      console.warn('[Resenha] Falha ao puxar mensagens', error.message);
    }
    return 0;
  }
  let applied = 0;
  for (const row of data ?? []) {
    const ok = await applyIncomingRemoteMessage(row as Record<string, unknown>, myId, {
      notify: false,
    });
    if (ok) applied += 1;
  }
  return applied;
}

async function notifyPeerPush(
  peerId: string,
  msg: Message,
  senderName: string,
): Promise<void> {
  const { data, error } = await supabase.rpc('peer_push_tokens', { p_peer_id: peerId });
  if (error) {
    if (!missingSchema(error.message)) {
      console.warn('[Resenha] Falha ao ler tokens de push', error.message);
    }
    return;
  }
  const tokens = tokensFromRpc(data);
  await sendExpoPushToTokens({
    tokens,
    title: senderName,
    body: msg.body,
    conversationId: msg.conversation_id,
    messageId: msg.id,
  });
}

async function notifyGroupPush(groupId: string, msg: Message, title: string): Promise<void> {
  const { data, error } = await supabase.rpc('group_member_push_tokens', { p_group_id: groupId });
  if (error) {
    if (!missingSchema(error.message)) {
      console.warn('[Resenha] Falha ao ler tokens do grupo', error.message);
    }
    return;
  }
  const tokens = tokensFromRpc(data);
  await sendExpoPushToTokens({
    tokens,
    title,
    body: msg.body,
    conversationId: msg.conversation_id,
    messageId: msg.id,
  });
}

export async function deliverOutgoingMessage(msg: Message, myId: string): Promise<void> {
  if (!supabaseConfigured) return;

  if (isGroupConversationId(msg.conversation_id)) {
    const { error } = await supabase.rpc('post_group_message', {
      p_id: msg.id,
      p_group_id: msg.conversation_id,
      p_body: msg.body,
      p_created_at: msg.created_at,
    });
    if (error) {
      if (!missingSchema(error.message)) {
        console.warn('[Resenha] Falha ao sincronizar mensagem do grupo', error.message);
      }
      return;
    }
    await markMessageSynced(msg.id);
    const me = await fetchMyProfile(myId).catch(() => null);
    const senderName = displayNameFor(me);
    const group = await fetchChatGroup(msg.conversation_id).catch(() => null);
    const title = group?.name
      ? `${senderName === 'este usuário' ? 'Nova mensagem' : senderName} · ${group.name}`
      : senderName === 'este usuário'
        ? 'Grupo'
        : senderName;
    await notifyGroupPush(msg.conversation_id, msg, title);
    return;
  }

  const peerId = otherParticipantId(msg.conversation_id, myId);
  if (!peerId) return;

  const { error } = await supabase.from('chat_messages').upsert(
    {
      id: msg.id,
      conversation_id: msg.conversation_id,
      sender_id: msg.sender_id,
      recipient_id: peerId,
      body: msg.body,
      created_at: msg.created_at,
    },
    { onConflict: 'id' },
  );
  if (error) {
    if (!missingSchema(error.message)) {
      console.warn('[Resenha] Falha ao sincronizar mensagem', error.message);
    }
    return;
  }

  await markMessageSynced(msg.id);

  const me = await fetchMyProfile(myId).catch(() => null);
  const senderName = displayNameFor(me);
  await notifyPeerPush(peerId, msg, senderName === 'este usuário' ? 'Nova mensagem' : senderName);
}

export async function flushUnsyncedMessages(myId: string): Promise<void> {
  const pending = await listUnsyncedMessages().catch(() => [] as Message[]);
  for (const msg of pending) {
    if (msg.sender_id !== myId) continue;
    await deliverOutgoingMessage(msg, myId);
  }
}

export const MESSAGES_SCHEMA_HINT =
  'Rode supabase/migrations/008_messages_push.sql no SQL Editor do Supabase para sincronizar mensagens e notificações.';
