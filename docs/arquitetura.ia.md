# Arquitetura — referência técnica

## Server functions

- Todas as operações server-side vivem em arquivos `*.functions.ts` ou `*.functions.tsx` em `src/lib/`.
- Criadas com `createServerFn({ method: "POST" })` de `@tanstack/react-start`.
- Middleware padrão: `requireSupabaseAuth` (em `src/integrations/supabase/auth-middleware.ts`) injeta `context.userId` e cliente Supabase autenticado.
- Para operações administrativas, a função chama `ensureAdmin(userId)` que consulta `user_roles`.
- `src/start.ts` registra `attachSupabaseAuth` como `functionMiddleware` global — sem ele, o token JWT não viaja nas chamadas.

## Clientes Supabase

- `src/integrations/supabase/client.ts` — browser, chave anon, sujeita a RLS.
- `src/integrations/supabase/auth-middleware.ts` — server, com bearer do usuário.
- `src/integrations/supabase/client.server.ts` — `supabaseAdmin`, chave service-role, **bypass de RLS**. Usar apenas em código server confiável.

## Auth e permissões

- Auth via Supabase (email/senha + Google OAuth).
- Papéis em `user_roles` (enum `app_role`: `admin`, `user`).
- Função SQL `has_role(user_id, role)` é `security definer` — usada em policies para evitar recursão.
- Frontend: `useIsAdmin()` lê o papel; `ensureAdminBeforeLoad` em `src/lib/admin-guard.ts` protege rotas `/admin/*`.
- Primeiro signup vira admin via trigger (migration `20260528141547`).

## Env vars

Browser (`import.meta.env`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Server (`process.env`):

- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `PORTAL_TRANSPARENCIA_API_KEY` — chave da API CGU.

## Deploy

- Cloudflare Workers (configuração em `wrangler.jsonc`).
- `nodejs_compat` ativo; evite pacotes que exijam binários nativos (sharp, canvas, puppeteer) ou subprocessos.
- Migrations rodam automaticamente quando aplicadas via ferramenta de migração do Lovable.

## RLS

- Tabelas `*_cache` permitem `SELECT` para `anon` e `authenticated` (dados públicos).
- `INSERT/UPDATE/DELETE` restritos a `service_role` (via server functions admin).
- `user_roles`: leitura só `authenticated`, escrita só via funções admin.
- `qa_findings`, `importacoes`: leitura pública, escrita server-only.

## Routing

- `routeTree.gen.ts` é auto-gerado pelo plugin do TanStack — **nunca editar**.
- Convenção de nomes: `nome.subnome.tsx` → `/nome/subnome`; `$param` para dinâmico; `_layout` para rotas pathless.
- `_authenticated.tsx` é o layout que protege admin e área do usuário.

## Repositório open source

- `scripts/sync-opensource.mjs` espelha o projeto privado para um diretório público via rsync.
- README, LICENSE, CONTRIBUTING, `.env.example` e `.gitignore` vêm do privado (privado é fonte da verdade).
- Migrations completas são copiadas; nenhum dado de produção vai junto.
