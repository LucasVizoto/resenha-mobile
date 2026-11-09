export type MessageStatus = 'pending' | 'sent' | 'failed';

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  image_url?: string | null;
  created_at: string;
  status: MessageStatus;
  synced: boolean;
};
