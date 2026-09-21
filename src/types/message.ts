export type MessageStatus = 'pending' | 'sent' | 'failed';

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  status: MessageStatus;
  synced: boolean;
};
