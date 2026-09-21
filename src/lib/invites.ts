import { missingSupabaseEnvMessage, supabase, supabaseConfigured } from './supabase';
import { addSavedContact } from './db/contacts';
import { cacheProfile } from './db/profiles';
import { mapProfileRow } from './profile';
import type { Profile } from '../types/profile';
import type { ContactInvite, InviteStatus, ProfileSearchHit } from '../types/invite';

function asProfile(row: Record<string, unknown>): Profile {
  return mapProfileRow(row, String(row.id ?? ''));
}

function asInvite(row: Record<string, unknown>): ContactInvite {
  const fromRow = row.from_profile ?? row.from;
  const toRow = row.to_profile ?? row.to;
  return {
    id: String(row.id),
    from_id: String(row.from_id),
    to_id: String(row.to_id),
    status: (row.status as InviteStatus) ?? 'pending',
    created_at: String(row.created_at ?? ''),
    responded_at: (row.responded_at as string | null) ?? null,
    from_profile:
      fromRow && typeof fromRow === 'object'
        ? asProfile(fromRow as Record<string, unknown>)
        : null,
    to_profile:
      toRow && typeof toRow === 'object' ? asProfile(toRow as Record<string, unknown>) : null,
  };
}

async function hydrateInviteProfiles(invites: ContactInvite[]): Promise<ContactInvite[]> {
  const ids = [
    ...new Set(invites.flatMap((i) => [i.from_id, i.to_id].filter(Boolean))),
  ];
  if (ids.length === 0) return invites;
  const { data, error } = await supabase.from('profiles').select('*').in('id', ids);
  if (error || !data) return invites;
  const map = new Map(data.map((row) => [String((row as { id: string }).id), asProfile(row as Record<string, unknown>)]));
  return invites.map((i) => ({
    ...i,
    from_profile: i.from_profile ?? map.get(i.from_id) ?? null,
    to_profile: i.to_profile ?? map.get(i.to_id) ?? null,
  }));
}

export async function listIncomingInvites(userId: string): Promise<ContactInvite[]> {
  if (!supabaseConfigured) return [];
  const { data, error } = await supabase
    .from('contact_invites')
    .select('*')
    .eq('to_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return hydrateInviteProfiles((data ?? []).map((row) => asInvite(row as Record<string, unknown>)));
}

export async function listOutgoingPending(userId: string): Promise<ContactInvite[]> {
  if (!supabaseConfigured) return [];
  const { data, error } = await supabase
    .from('contact_invites')
    .select('*')
    .eq('from_id', userId)
    .eq('status', 'pending');
  if (error) throw error;
  return (data ?? []).map((row) => asInvite(row as Record<string, unknown>));
}

export async function sendContactInvite(fromId: string, toProfile: Profile): Promise<ContactInvite> {
  if (!supabaseConfigured) {
    throw new Error(missingSupabaseEnvMessage);
  }
  if (toProfile.id === fromId) {
    throw new Error('Você não pode adicionar a si mesmo.');
  }

  const incoming = await supabase
    .from('contact_invites')
    .select('*')
    .eq('from_id', toProfile.id)
    .eq('to_id', fromId)
    .eq('status', 'pending')
    .maybeSingle();
  if (!incoming.error && incoming.data) {
    const accepted = await respondToInvite(String((incoming.data as { id: string }).id), 'accepted');
    return accepted;
  }

  const { data, error } = await supabase
    .from('contact_invites')
    .upsert(
      {
        from_id: fromId,
        to_id: toProfile.id,
        status: 'pending',
        responded_at: null,
      },
      { onConflict: 'from_id,to_id' },
    )
    .select('*')
    .single();
  if (error) {
    if (/schema cache|does not exist|relation/i.test(error.message)) {
      throw new Error(
        'A tabela de convites ainda não existe. Rode supabase/migrations/004_contact_invites.sql no SQL Editor do Supabase.',
      );
    }
    throw error;
  }
  return asInvite({ ...(data as Record<string, unknown>), to_profile: toProfile });
}

export async function respondToInvite(inviteId: string, status: 'accepted' | 'declined'): Promise<ContactInvite> {
  if (!supabaseConfigured) {
    throw new Error(missingSupabaseEnvMessage);
  }
  const { data, error } = await supabase
    .from('contact_invites')
    .update({ status })
    .eq('id', inviteId)
    .select('*')
    .single();
  if (error) throw error;
  const invite = asInvite(data as Record<string, unknown>);
  if (status === 'accepted') {
    const otherId = invite.from_id;
    await addSavedContact(otherId).catch(() => undefined);
    if (invite.from_profile) {
      await cacheProfile(invite.from_profile).catch(() => undefined);
    }
  }
  return invite;
}

export function displayNameFor(profile?: Profile | null) {
  if (!profile) return 'este usuário';
  if (profile.username) return `@${profile.username.replace(/^@/, '')}`;
  if (profile.display_name) return profile.display_name;
  if (profile.email) return profile.email;
  return 'este usuário';
}

export async function searchProfilesToAdd(
  query: string,
  myId: string,
  alreadyIds: string[],
  outgoingPendingIds: string[],
): Promise<ProfileSearchHit[]> {
  if (!supabaseConfigured) {
    throw new Error(missingSupabaseEnvMessage);
  }
  const q = query.trim().replace(/^@+/, '').replace(/[%(),]/g, '').trim();
  if (q.length < 2) {
    throw new Error('Digite pelo menos 2 caracteres para buscar.');
  }

  const isEmail = q.includes('@');
  const like = `%${q}%`;
  const base = supabase.from('profiles').select('*').neq('id', myId).limit(20);
  const { data, error } = isEmail
    ? await base.or(`email.ilike."${q}",email.eq."${q}"`)
    : await base.or(`username.ilike."${like}",username.eq."${q}",email.ilike."${like}"`);

  let rows = data;
  if (error) {
    const fallback = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, email')
      .neq('id', myId)
      .ilike(isEmail ? 'email' : 'username', isEmail ? q : like)
      .limit(20);
    if (fallback.error) throw fallback.error;
    rows = fallback.data;
  }

  const already = new Set(alreadyIds);
  const pending = new Set(outgoingPendingIds);
  return (rows ?? []).map((row) => {
    const profile = asProfile(row as Record<string, unknown>);
    return {
      ...profile,
      alreadyContact: already.has(profile.id),
      outgoingStatus: pending.has(profile.id) ? 'pending' : null,
    };
  });
}
