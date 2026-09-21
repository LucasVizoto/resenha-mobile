# Soft Messenger — modelagem inicial

## Supabase (remoto) — auth + perfis

### auth.users
Gerenciado pelo Supabase Auth (email/senha + Google OAuth).

### public.profiles
| coluna | tipo | notas |
|--------|------|-------|
| id | uuid PK | = auth.users.id |
| username | text unique | |
| display_name | text | |
| avatar_url | text null | |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | |

RLS: user lê todos os profiles (lista de contatos); user só UPDATE o próprio.

Trigger: on auth.users insert → insert profiles.

### public.conversations (fase 2, opcional remoto)
| id | uuid PK |
| is_group | bool |
| created_at | timestamptz |

### public.conversation_members
| conversation_id | user_id | role | joined_at |

### public.messages (fase 2 sync)
| id | uuid PK |
| conversation_id | uuid |
| sender_id | uuid |
| body | text |
| created_at | timestamptz |
| client_id | text unique | idempotência com SQLite |

Escopo inicial: Auth + profiles. Mensagens ficam no SQLite; sync remoto depois.

## SQLite (local) — cache de mensagens

```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  peer_user_id TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent', -- pending|sent|failed
  synced INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

CREATE INDEX idx_messages_conv_created ON messages(conversation_id, created_at);
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
```
