export type ChatGroupRole = 'owner' | 'member';

export type ChatGroup = {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  created_by: string;
  created_at?: string;
  updated_at?: string;
};

export type ChatGroupMember = {
  group_id: string;
  user_id: string;
  role: ChatGroupRole;
  joined_at?: string;
  profile?: import('./profile').Profile | null;
};
