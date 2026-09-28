export type Conversation = {
  id: string;
  title: string | null;
  peer_user_id: string | null;
  peer_display_name: string | null;
  peer_avatar_url: string | null;
  updated_at: string;
  last_message_body?: string | null;
  last_message_sender_id?: string | null;
  last_read_at?: string | null;
  unread_count?: number;
  kind?: 'dm' | 'group';
  description?: string | null;
};
