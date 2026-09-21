export type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  instagram?: string | null;
  phone?: string | null;
  created_at?: string;
  updated_at?: string;
};

export const PROFILE_COLUMNS =
  'id, username, display_name, avatar_url, first_name, last_name, email, instagram, phone, created_at, updated_at';

export type ProfileFormValues = {
  first_name: string;
  last_name: string;
  email: string;
  instagram: string;
  phone: string;
  username: string;
};
