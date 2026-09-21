import { getDb } from './client';
import type { Profile } from '../../types/profile';

export async function cacheProfile(p: Profile): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO contacts_cache (
       user_id, username, display_name, avatar_url,
       first_name, last_name, email, instagram, phone, cached_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       username=excluded.username,
       display_name=excluded.display_name,
       avatar_url=excluded.avatar_url,
       first_name=excluded.first_name,
       last_name=excluded.last_name,
       email=excluded.email,
       instagram=excluded.instagram,
       phone=excluded.phone,
       cached_at=excluded.cached_at`,
    [
      p.id,
      p.username ?? null,
      p.display_name ?? null,
      p.avatar_url ?? null,
      p.first_name ?? null,
      p.last_name ?? null,
      p.email ?? null,
      p.instagram ?? null,
      p.phone ?? null,
      new Date().toISOString(),
    ],
  );
}

export async function getCachedProfile(userId: string): Promise<Profile | null> {
  const row = await getDb().getFirstAsync<{
    user_id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    instagram: string | null;
    phone: string | null;
  }>(
    `SELECT user_id, username, display_name, avatar_url, first_name, last_name, email, instagram, phone
     FROM contacts_cache WHERE user_id = ?`,
    [userId],
  );
  if (!row) return null;
  return {
    id: row.user_id,
    username: row.username,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    instagram: row.instagram,
    phone: row.phone,
  };
}
