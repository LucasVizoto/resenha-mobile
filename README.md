# Resenha

Expo + expo-router, Soft UI, Supabase Auth (email + Google) e SQLite offline-first para mensagens.

## Setup

1. `npm install`
2. Copie `.env.example` para `.env` e preencha (Dashboard do Supabase ? **Project Settings ? API**):
   - `EXPO_PUBLIC_SUPABASE_URL` — Project URL (`https://xxxx.supabase.co`)
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` — chave **anon public**
3. **Não** coloque a `service_role` no app. Ela é secreta, ignora RLS e só deve existir no servidor.
   As variáveis `EXPO_PUBLIC_*` entram no bundle (Expo SDK 57 faz inline de `process.env.EXPO_PUBLIC_...` a partir do `.env`). A segurança no cliente é o **Row Level Security**.
4. Rode `supabase/001_profiles.sql` no SQL Editor
5. `npx expo start` — depois de alterar o `.env`, recarregue o app (`npx expo start --clear`)

O arquivo `.env` está no `.gitignore`. Nunca commite chaves reais.

## Estrutura

- `app/` — rotas (auth stack + tabs Contatos/Chat)
- `src/soft-ui/` — design system Soft UI
- `src/lib/` — supabase, auth, SQLite
- `docs/architecture.md` — fonte da verdade
- `assets/logo-resenha.png` — marca da tela de login

Entry: `expo-router/entry` · scheme: `mensagens-mobile`
