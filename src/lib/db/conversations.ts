import { getDb } from './client';
import type { Conversation } from '../../types/conversation';

export async function listConversations(): Promise<Conversation[]> {
  const rows = await getDb().getAllAsync<Conversation>(
    `SELECT
       c.id, c.title, c.peer_user_id, c.peer_display_name, c.peer_avatar_url, c.updated_at,
       (SELECT m.body FROM messages m
         WHERE m.conversation_id = c.id
         ORDER BY m.created_at DESC LIMIT 1) AS last_message_body,
       (SELECT m.sender_id FROM messages m
         WHERE m.conversation_id = c.id
         ORDER BY m.created_at DESC LIMIT 1) AS last_message_sender_id
     FROM conversations c
     ORDER BY c.updated_at DESC`,
  );
  return rows;
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const row = await getDb().getFirstAsync<Conversation>(
    `SELECT id, title, peer_user_id, peer_display_name, peer_avatar_url, updated_at
     FROM conversations WHERE id = ?`,
    [id],
  );
  return row ?? null;
}

export async function upsertConversation(c: Conversation): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO conversations (id, title, peer_user_id, peer_display_name, peer_avatar_url, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title=excluded.title,
       peer_user_id=excluded.peer_user_id,
       peer_display_name=excluded.peer_display_name,
       peer_avatar_url=excluded.peer_avatar_url,
       updated_at=excluded.updated_at`,
    [
      c.id,
      c.title ?? null,
      c.peer_user_id ?? null,
      c.peer_display_name ?? null,
      c.peer_avatar_url ?? null,
      c.updated_at,
    ],
  );
}

export async function touchConversation(id: string, updatedAt: string): Promise<void> {
  await getDb().runAsync(`UPDATE conversations SET updated_at = ? WHERE id = ?`, [
    updatedAt,
    id,
  ]);
}
