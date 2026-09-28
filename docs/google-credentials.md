# Credenciais Google: login e Agenda

O app **não** guarda Client ID/Secret no `.env`. Essas chaves ficam no **Google Cloud** e no **Dashboard do Supabase**. No Expo só entram `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Nunca use a `service_role` no aplicativo.

O login com Google e o lembrete no Agenda usam o **mesmo cliente OAuth Web**.

## A. Projeto no Google Cloud (serve para os dois)

1. Abra o [Google Cloud Console](https://console.cloud.google.com/) e crie ou selecione um projeto.
2. **APIs e serviços → Biblioteca** → busque **Google Calendar API** → **Ativar**.  
   (O login não precisa dessa API; o botão “Sim, criar no Agenda” precisa.)
3. **APIs e serviços → Tela de consentimento OAuth**:
   - Tipo de usuário: **Externo**.
   - Nome do app: Resenha.
   - E-mail de suporte e dados do desenvolvedor: o seu Gmail.
   - Escopos: `openid`, `email`, `profile` e  
     `https://www.googleapis.com/auth/calendar.events`  
     (na lista, o nome amigável é em geral *See, create, change, and delete events on all your calendars* — **não** marque o escopo completo `calendar`, só `calendar.events`).
   - Enquanto o app estiver em **Teste**, em **Usuários de teste** adicione todos os Gmails que vão logar ou receber convite.
   - Salve.
4. **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**:
   - Tipo: **Aplicativo da Web**.
   - Nome: `Resenha Supabase`.
   - **Origens JavaScript autorizadas**:
     - `https://SEU_REF.supabase.co`
   - **URIs de redirecionamento autorizados**:
     - `https://SEU_REF.supabase.co/auth/v1/callback`
   - Crie e copie o **ID do cliente** e o **Segredo do cliente**.

O `SEU_REF` é o Project URL em Supabase → **Project Settings → API** (exemplo: `abcdefghijkl`).

## B. Login com o Google (Supabase)

1. No Supabase: **Authentication → Providers → Google** → ligue o provider.
2. Cole o **Client ID** e o **Client Secret** do cliente Web do passo A.
3. A **Callback URL** que o Supabase mostra tem que ser **exatamente**  
   `https://SEU_REF.supabase.co/auth/v1/callback`  
   (a mesma URI cadastrada no Google).
4. **Authentication → URL Configuration** (no Expo Go o retorno não é `mensagens-mobile://`):
   - Ao tocar em **Login com o Google** ou **Sim, criar no Agenda**, o terminal do Expo imprime  
     `[Resenha] Redirect do Google para colar no Supabase: exp://SEU_IP:8081/--/auth/callback`
   - Cole **essa URL exata** no **Site URL** e em **Redirect URLs**.
   - Se o Wi-Fi mudar o IP, copie a URL nova. Um curinga `exp://**` também pode ser adicionado em Redirect URLs.
   - `mensagens-mobile://auth/callback` só funciona num app compilado (não no Expo Go). Se o Site URL for esse scheme, o Chrome fica carregando para sempre.
5. No app, o `.env` continua só com:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
6. Salve o `.env` e recarregue: `npx expo start --clear`.
7. Na tela de login, toque em **Login com o Google**. O fluxo abre o navegador, volta para o app e troca o `code` por sessão.

Se der “Código OAuth ausente” ou redirect inválido: confira o scheme `mensagens-mobile` em `app.json` e as Redirect URLs do Supabase.

## C. Google Agenda (depois do login funcionar)

1. Confirme que a **Google Calendar API** está ativada (A.2).
2. Confirme o escopo `https://www.googleapis.com/auth/calendar.events` na tela de consentimento (A.3).
3. No provider Google do Supabase, se houver campo **Additional Scopes** / escopos extras, inclua:
   `https://www.googleapis.com/auth/calendar.events`
4. Ao marcar uma resenha, o app pergunta se você quer o lembrete no Agenda:
   - **Sim:** pede autorização do Google (primeira vez, ou se o token não tiver o escopo), cria o evento na agenda **primary** com você como organizador e os participantes como convidados (`sendUpdates=all`). Duração: **2 horas**.
   - **Agora não:** só cria a resenha no app.
5. Quem **já tinha logado com Google** antes de ligar o escopo de agenda precisa autorizar de novo na primeira vez que tocar em Sim (`prompt=consent`).
6. Quem entrou com **e-mail e senha**: ao tocar Sim, o app abre o Google para conectar a agenda.

### O que o convite precisa

- O organizador precisa de uma **conta Google**.
- Cada convidado só recebe o e-mail do Agenda se tiver **e-mail no perfil** (`profiles.email`). Sem e-mail, a pessoa entra na resenha no app, mas não no convite do Google.
- No Expo Go o OAuth continua no navegador, igual ao login.

### Erros frequentes

| Sintoma | O que conferir |
| --- | --- |
| `accessNotConfigured` / Calendar API has not been used | Ativar Google Calendar API no projeto certo |
| 403 insufficient permissions | Escopo `calendar.events` na consent screen + novo consentimento |
| Token do Google Agenda ausente | Additional Scopes no Supabase; repetir o login Google |
| Convite não chega | E-mail no perfil do convidado; usuário de teste na consent screen |
| Login Google não volta ao app | Redirect `mensagens-mobile://auth/callback` no Supabase |
