import { getDb } from './client';
import { ensureGroupConversation, isGroupConversationId, touchConversation } from './conversations';
import type { Message } from '../../types/message';

export async function listMessages(conversationId: string): Promise<Message[]> {
  return getDb().getAllAsync<Message>(
    `SELECT id, conversation_id, sender_id, body, created_at, status, synced
     FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`,
    [conversationId],
  );
}

export async function insertMessage(m: Message): Promise<void> {
  if (isGroupConversationId(m.conversation_id)) {
    await ensureGroupConversation({
      id: m.conversation_id,
      updated_at: m.created_at,
    });
  }
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

export async function insertIncomingMessage(m: Message): Promise<boolean> {
  const skipped = await getDb().getFirstAsync<{ id: string }>(
    `SELECT id FROM deleted_messages WHERE id = ?`,
    [m.id],
  );
  if (skipped) return false;
  const result = await getDb().runAsync(
    `INSERT OR IGNORE INTO messages (id, conversation_id, sender_id, body, created_at, status, synced)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [m.id, m.conversation_id, m.sender_id, m.body, m.created_at, m.status],
  );
  if (result.changes > 0) {
    await touchConversation(m.conversation_id, m.created_at);
    return true;
  }
  return false;
}

export async function markMessageSynced(id: string): Promise<void> {
  await getDb().runAsync(`UPDATE messages SET synced = 1, status = 'sent' WHERE id = ?`, [id]);
}

export async function listUnsyncedMessages(): Promise<Message[]> {
  return getDb().getAllAsync<Message>(
    `SELECT id, conversation_id, sender_id, body, created_at, status, synced
     FROM messages WHERE synced = 0 ORDER BY created_at ASC`,
  );
}

async function tombstone(id: string, conversationId: string | null): Promise<void> {
  await getDb().runAsync(
    `INSERT OR IGNORE INTO deleted_messages (id, conversation_id, deleted_at) VALUES (?, ?, ?)`,
    [id, conversationId, new Date().toISOString()],
  );
}

export async function deleteMessagesByIds(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const db = getDb();
  let removed = 0;
  for (const id of ids) {
    const row = await db.getFirstAsync<{ id: string; conversation_id: string }>(
      `SELECT id, conversation_id FROM messages WHERE id = ?`,
      [id],
    );
    await tombstone(id, row?.conversation_id ?? null);
    const result = await db.runAsync(`DELETE FROM messages WHERE id = ?`, [id]);
    removed += result.changes;
  }
  return removed;
}

export async function deleteMessagesInConversation(conversationId: string): Promise<number> {
  const rows = await getDb().getAllAsync<{ id: string }>(
    `SELECT id FROM messages WHERE conversation_id = ?`,
    [conversationId],
  );
  return deleteMessagesByIds(rows.map((row) => row.id));
}

export async function deleteConversationLocally(conversationId: string): Promise<void> {
  await deleteMessagesInConversation(conversationId);
  await getDb().runAsync(`DELETE FROM conversations WHERE id = ?`, [conversationId]);
}

export function newMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
