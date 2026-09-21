import { supabase, supabaseConfigured } from './supabase';
import { addSavedContact, listSavedContactIds } from './db/contacts';
import { cacheProfile, getCachedProfile } from './db/profiles';
import { mapProfileRow } from './profile';
import type { Profile } from '../types/profile';

function asProfile(row: Record<string, unknown>): Profile {
  return mapProfileRow(row, String(row.id ?? ''));
}

async function hydrateFromCache(ids: string[]): Promise<Profile[]> {
  const out: Profile[] = [];
  for (const id of ids) {
    try {
      const cached = await getCachedProfile(id);
      if (cached) out.push(cached);
    } catch {
      // ignore
    }
  }
  return out;
}

export async function listMyContacts(userId: string): Promise<Profile[]> {
  const localIds = await listSavedContactIds().catch(() => [] as string[]);

  if (!supabaseConfigured) {
    return hydrateFromCache(localIds);
  }

  const remote = await supabase.from('contacts').select('contact_id').eq('owner_id', userId);
  if (!remote.error && remote.data) {
    const ids = remote.data.map((r) => String((r as { contact_id: string }).contact_id));
    await Promise.all(ids.map((id) => addSavedContact(id).catch(() => undefined)));
    if (ids.length === 0) return [];
    const profiles = await supabase.from('profiles').select('*').in('id', ids);
    if (profiles.error) {
      return hydrateFromCache(ids);
    }
    const mapped = (profiles.data ?? []).map((row) => asProfile(row as Record<string, unknown>));
    await Promise.all(mapped.map((p) => cacheProfile(p).catch(() => undefined)));
    return mapped;
  }

  return hydrateFromCache(localIds);
}

export async function addContact(ownerId: string, profile: Profile): Promise<void> {
  if (profile.id === ownerId) {
    throw new Error('Você não pode adicionar a si mesmo.');
  }
  await addSavedContact(profile.id);
  await cacheProfile(profile).catch(() => undefined);

  if (!supabaseConfigured) return;
  const { error } = await supabase.from('contacts').upsert({
    owner_id: ownerId,
    contact_id: profile.id,
  });
  if (error && !/schema cache|does not exist|relation/i.test(error.message)) {
    throw error;
  }
}
