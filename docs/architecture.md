# Soft Messenger — Plano de Arquitetura v1

**Repo:** `C:\Projects\mensagens-mobile`  
**Estado atual:** Expo blank-typescript (~57), só `App.tsx` placeholder.  
**Princípio:** offline-first nas mensagens; Supabase só auth + profiles na fase 1.

---

## 1. Plano de pastas (alvo)

Migrar blank → **expo-router** (file-based). Remover `App.tsx`/`index.ts` de entry clássica; entry via `expo-router/entry`.

```
mensagens-mobile/
├── app/
│   ├── _layout.tsx                 # root: providers (Auth, Theme, DB), Slot/Stack
│   ├── index.tsx                   # redirect: session? → /(app) : /(auth)/login
│   ├── (auth)/
│   │   ├── _layout.tsx             # Stack sem tabs
│   │   ├── login.tsx
│   │   └── register.tsx
│   └── (app)/
│       ├── _layout.tsx             # Tabs: Contacts | Chat (+ guard de sessão)
│       ├── contacts/
│       │   ├── index.tsx           # lista profiles (Supabase)
│       │   └── [userId].tsx        # opcional: perfil / iniciar chat
│       └── chat/
│           ├── index.tsx           # lista conversations (SQLite)
│           └── [conversationId].tsx
├── src/
│   ├── components/                 # Soft UI (UI Soft Messenger)
│   │   ├── ui/                     # ButtonPill, TextField, Avatar, SoftHeader…
│   │   ├── auth/                   # LoginForm, GoogleButton
│   │   └── chat/                   # Bubble, ConversationRow, ContactRow
│   ├── lib/
│   │   ├── supabase.ts             # createClient + SecureStore adapter
│   │   ├── auth.tsx                # AuthProvider, useSession, signIn/Up/OAuth/Out
│   │   ├── db/
│   │   │   ├── client.ts           # openDatabaseSync / migrations
│   │   │   ├── schema.ts           # CREATE TABLE…
│   │   │   ├── conversations.ts
│   │   │   └── messages.ts
│   │   ├── theme/
│   │   │   ├── tokens.ts           # dark-red gradient, radii, shadows, light/dark
│   │   │   └── ThemeProvider.tsx
│   │   └── sync/                   # fase 2: push/pull messages (stub)
│   └── types/
│       ├── profile.ts
│       ├── conversation.ts
│       └── message.ts
├── supabase/
│   └── 001_profiles.sql            # já draft em /workspace/soft-messenger/supabase
├── assets/
├── app.json                        # scheme, plugins (expo-router, secure-store…)
├── .env                            # EXPO_PUBLIC_SUPABASE_URL / ANON_KEY (gitignored)
└── package.json
```

### Deps a instalar (Lead)
- `expo-router`, `expo-linking`, `expo-constants`
- `@supabase/supabase-js`, `expo-secure-store`
- `expo-sqlite`
- `expo-auth-session`, `expo-web-browser`, `expo-crypto` (Google OAuth)
- `@react-navigation/native` (peer do router)
- Soft UI: o que UI Soft indicar (LinearGradient, etc.)

---

## 2. Navegação: auth stack vs app tabs

```
Root Stack
├── (auth) Stack          ← sem sessão
│   ├── login
│   └── register
└── (app) Tabs            ← com sessão
    ├── contacts (Stack)
    │   ├── index
    │   └── [userId]
    └── chat (Stack)
        ├── index
        └── [conversationId]
```

**Gate:** em `app/_layout.tsx` / `app/index.tsx`, observar `supabase.auth.onAuthStateChange`. Sem `session` → `/(auth)/login`; com session → `/(app)/contacts` (ou última tab).

**Contacts:** lê `public.profiles` no Supabase (lista de usuários). Tap → cria/abre conversation 1:1 no SQLite e navega para `chat/[id]`.

**Chat:** lista e thread 100% SQLite na fase 1 (escreve local imediato; `synced=0`).

---

## 3. Modelagem de dados

### 3.1 Supabase (remoto) — fase 1: auth + profiles

- `auth.users` — gerenciado pelo Auth (email/senha + Google).
- `public.profiles` — ver `supabase/001_profiles.sql`:
  - `id` uuid PK = `auth.users.id`
  - `username` text unique
  - `display_name` text
  - `avatar_url` text null
  - `created_at` / `updated_at` timestamptz
- RLS: SELECT authenticated (todos = contatos); UPDATE só próprio.
- Trigger `on_auth_user_created` → insert profile (meta Google: `full_name`, avatar se houver).

**Fora do escopo fase 1 (remoto):** `conversations` / `messages` no Postgres. Sync remoto = fase 2 (demo online pode espelhar depois se a rubrica exigir).

### 3.2 SQLite (local) — conversations / messages / cache

Arquivo: `soft_messenger.db` via `expo-sqlite`.

```sql
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,              -- uuid client-side
  title TEXT,
  peer_user_id TEXT,                -- profile.id do outro (DM)
  peer_display_name TEXT,
  peer_avatar_url TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,              -- uuid client (= client_id futuro remoto)
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,          -- auth user id
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',  -- pending|sent|failed
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
  cached_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

**Fluxo escrita mensagem:** insert local (`status=pending` ou `sent`, `synced=0`) → UI atualiza na hora → (fase 2) worker push Supabase.

**Demo rubrica:** mostrar SQLite com histórico offline; Supabase com login + lista de profiles.

---

## 4. Fluxo Google OAuth via Supabase

1. Supabase Dashboard → Authentication → Providers → **Google** (Client ID/Secret do Google Cloud).
2. Redirect URLs:
   - Dev Expo: `https://auth.expo.io/@<owner>/<slug>` **ou** scheme nativo `mensagens-mobile://**` (preferir scheme no `app.json`: `"scheme": "mensagens-mobile"`).
   - Adicionar em Supabase Auth → URL Configuration → Redirect URLs.
3. App:
   - `WebBrowser.maybeCompleteAuthSession()`
   - `makeRedirectUri({ scheme: 'mensagens-mobile', path: 'auth/callback' })`
   - `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } })`
   - Abrir `data.url` com `WebBrowser.openAuthSessionAsync`
   - Trocar código/session: `supabase.auth.exchangeCodeForSession` / parse tokens do redirect
4. Sessão persiste em **SecureStore** (adapter do supabase-js).
5. Trigger cria `profiles`; Contacts passa a listar o novo user.

Email/senha: `signInWithPassword` / `signUp` na mesma AuthProvider — mesma gate de navegação.

---

## 5. Contratos / handoffs

| Quem | Entrega |
|------|---------|
| **Arquiteto** (este doc) | Pastas, nav, SQL, OAuth — fonte da verdade v1 |
| **UI Soft Messenger** | Tokens Soft UI (dark red gradient, light/dark) + Login/Register + Bubble/Avatar |
| **Lead Messenger** | Scaffold expo-router, wire auth+SQLite, telas Contacts/Chat |

### DoD arquitetura (fase 1)
- [ ] Pastas acima materializadas
- [ ] Gate auth ↔ tabs funcionando
- [ ] SQL profiles no projeto Supabase + SQLite migrations no boot
- [ ] Login email + botão Google (OAuth) operacional em Expo Go/dev client
- [ ] Enviar mensagem grava no SQLite e aparece offline

### Fora agora
- Sync remoto de mensagens, groups, push notifications, CV/ML
