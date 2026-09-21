import { getDb } from './client';

export async function listSavedContactIds(): Promise<string[]> {
  const rows = await getDb().getAllAsync<{ contact_user_id: string }>(
    'SELECT contact_user_id FROM saved_contacts ORDER BY added_at DESC',
  );
  return rows.map((r) => r.contact_user_id);
}

export async function addSavedContact(contactUserId: string): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO saved_contacts (contact_user_id, added_at)
     VALUES (?, ?)
     ON CONFLICT(contact_user_id) DO UPDATE SET added_at=excluded.added_at`,
    [contactUserId, new Date().toISOString()],
  );
}
