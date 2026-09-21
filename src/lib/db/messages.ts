import { getDb } from './client';
import { touchConversation } from './conversations';
import type { Message } from '../../types/message';

export async function listMessages(conversationId: string): Promise<Message[]> {
  return getDb().getAllAsync<Message>(
    `SELECT id, conversation_id, sender_id, body, created_at, status, synced
     FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`,
    [conversationId],
  );
}

export async function insertMessage(m: Message): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO messages (id, conversation_id, sender_id, body, created_at, status, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      m.id,
      m.conversation_id,
      m.sender_id,
      m.body,
      m.created_at,
      m.status,
      m.synced ? 1 : 0,
    ],
  );
  await touchConversation(m.conversation_id, m.created_at);
}

export function newMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
