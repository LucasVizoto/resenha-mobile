# Resenha

Expo + expo-router, Soft UI, Supabase Auth (email + Google) e SQLite offline-first para mensagens.

## Setup

1. `npm install`
2. Copie `.env.example` para `.env` e preencha (Dashboard do Supabase ? **Project Settings ? API**):
   - `EXPO_PUBLIC_SUPABASE_URL` � Project URL (`https://xxxx.supabase.co`)
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` � chave **anon public**
3. **N�o** coloque a `service_role` no app. Ela � secreta, ignora RLS e s� deve existir no servidor.
   As vari�veis `EXPO_PUBLIC_*` entram no bundle (Expo SDK 57 faz inline de `process.env.EXPO_PUBLIC_...` a partir do `.env`). A seguran�a no cliente � o **Row Level Security**.
4. Rode os SQL no SQL Editor (`supabase/001_profiles.sql` e as migrations, inclusive `supabase/migrations/008_messages_push.sql` para chat sincronizado + notifica��es)
5. `npx expo start` � depois de alterar o `.env`, recarregue o app (`npx expo start --clear`)

O arquivo `.env` est� no `.gitignore`. Nunca commite chaves reais.

## Estrutura

- `app/` � rotas (auth stack + tabs Contatos/Chat)
- `src/soft-ui/` � design system Soft UI
- `src/lib/` � supabase, auth, SQLite
- `docs/architecture.md` � fonte da verdade
- `assets/logo-resenha.png` � marca da tela de login

Entry: `expo-router/entry` � scheme: `mensagens-mobile`
