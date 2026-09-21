import { missingSupabaseEnvMessage, supabase, supabaseConfigured, supabaseStorageBucket } from './supabase';
import { cacheProfile, getCachedProfile } from './db/profiles';
import type { Profile, ProfileFormValues } from '../types/profile';

function isMissingColumnError(error: { message?: string; code?: string } | null | undefined) {
  const message = error?.message ?? '';
  return (
    error?.code === 'PGRST204' ||
    /PGRST204/i.test(message) ||
    /could not find the ['"].+['"] column/i.test(message) ||
    /column .+ does not exist/i.test(message)
  );
}

export function mapProfileRow(row: Record<string, unknown>, fallbackId: string): Profile {
  return {
    id: String(row.id ?? fallbackId),
    username: (row.username as string | null) ?? null,
    display_name: (row.display_name as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    first_name: (row.first_name as string | null) ?? null,
    last_name: (row.last_name as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    instagram: (row.instagram as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  };
}

export function profileFromAuthUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): Profile {
  const meta = user.user_metadata ?? {};
  const fullName =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    null;
  const given = typeof meta.given_name === 'string' ? meta.given_name : null;
  const family = typeof meta.family_name === 'string' ? meta.family_name : null;
  const username =
    (typeof meta.preferred_username === 'string' && meta.preferred_username) ||
    (typeof meta.user_name === 'string' && meta.user_name) ||
    user.email?.split('@')[0] ||
    null;
  const avatar =
    (typeof meta.avatar_url === 'string' && meta.avatar_url) ||
    (typeof meta.picture === 'string' && meta.picture) ||
    null;
  return {
    id: user.id,
    username,
    display_name: fullName,
    avatar_url: avatar,
    first_name: given,
    last_name: family,
    email: user.email ?? null,
  };
}

async function readCache(userId: string): Promise<Profile | null> {
  try {
    return await getCachedProfile(userId);
  } catch {
    return null;
  }
}

async function writeCache(profile: Profile): Promise<void> {
  try {
    await cacheProfile(profile);
  } catch {
    // cache local é best-effort
  }
}

async function resolveAvatarFromStorage(userId: string): Promise<string | null> {
  if (!supabaseConfigured) return null;
  try {
    const { data: files, error } = await supabase.storage.from(supabaseStorageBucket).list(userId);
    if (error || !files?.length) return null;
    const file = files.find((f) => /^avatar\./i.test(f.name)) ?? files[0];
    if (!file?.name) return null;
    const { data } = supabase.storage
      .from(supabaseStorageBucket)
      .getPublicUrl(`${userId}/${file.name}`);
    return data.publicUrl || null;
  } catch {
    return null;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9._]{3,24}$/;
const INSTAGRAM_RE = /^[a-zA-Z0-9._]{1,30}$/;

export type ProfileValidation = {
  ok: boolean;
  error?: string;
  values?: {
    first_name: string;
    last_name: string;
    email: string;
    instagram: string | null;
    phone: string | null;
    username: string;
    display_name: string;
  };
};

export function normalizeInstagram(raw: string): string {
  return raw.trim().replace(/^@+/, '').replace(/\s+/g, '');
}

export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const plus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  return plus ? `+${digits}` : digits;
}

export function validateProfileForm(input: ProfileFormValues): ProfileValidation {
  const first_name = input.first_name.trim();
  const last_name = input.last_name.trim();
  const email = input.email.trim();
  const username = input.username.trim().replace(/^@+/, '');
  const instagram = normalizeInstagram(input.instagram);
  const phone = normalizePhone(input.phone);

  if (!username) {
    return { ok: false, error: 'O nome de usuário é obrigatório.' };
  }
  if (!USERNAME_RE.test(username)) {
    return { ok: false, error: 'Usuário: 3–24 caracteres (letras, números, . ou _).' };
  }
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: 'Informe um e-mail válido.' };
  }
  if (instagram && !INSTAGRAM_RE.test(instagram)) {
    return { ok: false, error: 'Instagram inválido. Use só o @, sem URL.' };
  }
  if (phone) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) {
      return { ok: false, error: 'Telefone inválido. Use DDD + número.' };
    }
  }

  const display_name = [first_name, last_name].filter(Boolean).join(' ') || username;

  return {
    ok: true,
    values: {
      first_name,
      last_name,
      email,
      instagram: instagram || null,
      phone: phone || null,
      username,
      display_name,
    },
  };
}

export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  const cached = await readCache(userId);
  if (!supabaseConfigured) {
    return cached;
  }
  try {
    // select('*') não quebra se a migration 002 ainda não rodou.
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) {
      if (cached) return cached;
      throw error;
    }
    if (!data) return cached;
    const profile = mapProfileRow(data as Record<string, unknown>, userId);
    if (!profile.avatar_url) {
      const fromStorage = await resolveAvatarFromStorage(userId);
      if (fromStorage) {
        profile.avatar_url = fromStorage;
        await updateMyAvatarUrl(userId, fromStorage).catch(() => undefined);
      }
    }
    await writeCache(profile);
    return profile;
  } catch (e) {
    if (cached) return cached;
    throw e;
  }
}

export async function fetchContactProfile(userId: string): Promise<Profile | null> {
  const cached = await readCache(userId);
  if (!supabaseConfigured) return cached;
  try {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) {
      if (cached) return cached;
      throw error;
    }
    if (!data) return cached;
    const profile = mapProfileRow(data as Record<string, unknown>, userId);
    await writeCache(profile);
    return profile;
  } catch (e) {
    if (cached) return cached;
    throw e;
  }
}

export async function upsertMyProfile(
  userId: string,
  values: NonNullable<ProfileValidation['values']>,
  extras?: { avatar_url?: string | null },
) {
  if (!supabaseConfigured) {
    throw new Error(missingSupabaseEnvMessage);
  }
  const fullRow: Record<string, unknown> = {
    id: userId,
    first_name: values.first_name || null,
    last_name: values.last_name || null,
    email: values.email,
    instagram: values.instagram,
    phone: values.phone,
    username: values.username,
    display_name: values.display_name,
    updated_at: new Date().toISOString(),
  };
  if (extras?.avatar_url) {
    fullRow.avatar_url = extras.avatar_url;
  }
  const basicRow: Record<string, unknown> = {
    id: userId,
    username: values.username,
    display_name: values.display_name,
    updated_at: fullRow.updated_at,
  };
  if (extras?.avatar_url) {
    basicRow.avatar_url = extras.avatar_url;
  }

  // defaultToNull: false evita apagar avatar_url (e outros campos omitidos).
  let { data, error } = await supabase
    .from('profiles')
    .upsert(fullRow, { defaultToNull: false })
    .select('*')
    .single();
  if (error && isMissingColumnError(error)) {
    const fallback = await supabase
      .from('profiles')
      .upsert(basicRow, { defaultToNull: false })
      .select('*')
      .single();
    data = fallback.data;
    error = fallback.error;
  }
  if (error) {
    if (error.code === '23505') {
      throw new Error('Esse nome de usuário já está em uso.');
    }
    throw error;
  }
  const profile = mapProfileRow((data ?? fullRow) as Record<string, unknown>, userId);
  if (!profile.avatar_url && extras?.avatar_url) {
    profile.avatar_url = extras.avatar_url;
  }
  if (!profile.avatar_url) {
    profile.avatar_url = await resolveAvatarFromStorage(userId);
  }
  await writeCache(profile);
  return profile;
}

export async function updateMyAvatarUrl(userId: string, avatarUrl: string): Promise<Profile> {
  if (!supabaseConfigured) {
    throw new Error(missingSupabaseEnvMessage);
  }
  const cleanUrl = avatarUrl.replace(/[?&]t=\d+/g, '').replace(/\?$/, '');
  const { data, error } = await supabase
    .from('profiles')
    .update({ avatar_url: cleanUrl, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('*')
    .maybeSingle();
  if (error || !data) {
    const upserted = await supabase
      .from('profiles')
      .upsert({ id: userId, avatar_url: cleanUrl, updated_at: new Date().toISOString() }, { defaultToNull: false })
      .select('*')
      .maybeSingle();
    if (upserted.error) throw upserted.error;
    const profile = mapProfileRow(
      (upserted.data as Record<string, unknown> | null) ?? { id: userId, avatar_url: cleanUrl },
      userId,
    );
    profile.avatar_url = cleanUrl;
    await writeCache(profile);
    return profile;
  }
  const cached = await readCache(userId);
  const profile = mapProfileRow(
    (data as Record<string, unknown> | null) ?? {
      ...(cached as unknown as Record<string, unknown> | null),
      id: userId,
      avatar_url: cleanUrl,
    },
    userId,
  );
  profile.avatar_url = cleanUrl;
  await writeCache(profile);
  return profile;
}

export function friendlyProfileError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (isMissingColumnError({ message })) {
    return 'O banco ainda não tem os campos de perfil. Rode supabase/migrations/002_profile_fields.sql no SQL Editor do Supabase.';
  }
  if (/relation|table|schema cache/i.test(message) && /profiles/i.test(message)) {
    return 'A tabela de perfis ainda não existe. Rode supabase/migrations/001_profiles.sql e em seguida 002_profile_fields.sql no SQL Editor do Supabase.';
  }
  return message;
}
