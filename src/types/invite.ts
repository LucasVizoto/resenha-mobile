import type { Profile } from './profile';

export type InviteStatus = 'pending' | 'accepted' | 'declined';

export type ContactInvite = {
  id: string;
  from_id: string;
  to_id: string;
  status: InviteStatus;
  created_at: string;
  responded_at?: string | null;
  from_profile?: Profile | null;
  to_profile?: Profile | null;
};

export type ProfileSearchHit = Profile & {
  alreadyContact?: boolean;
  outgoingStatus?: InviteStatus | null;
};
