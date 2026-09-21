export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  peer_user_id TEXT,
  peer_display_name TEXT,
  peer_avatar_url TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  synced INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_conv_created
  ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS contacts_cache (
  user_id TEXT PRIMARY KEY,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  instagram TEXT,
  phone TEXT,
  cached_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS saved_contacts (
  contact_user_id TEXT PRIMARY KEY,
  added_at TEXT NOT NULL
);
`;

export const CONTACTS_CACHE_EXTRA_COLUMNS: [string, string][] = [
  ['first_name', 'TEXT'],
  ['last_name', 'TEXT'],
  ['email', 'TEXT'],
  ['instagram', 'TEXT'],
  ['phone', 'TEXT'],
];
