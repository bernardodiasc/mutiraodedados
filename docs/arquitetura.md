# Arquitetura

Visão geral em linguagem natural. Detalhes técnicos (env vars, RLS, deploy) ficam em [`arquitetura.ia.md`](./arquitetura.ia.md).

## Stack

- **Frontend e servidor**: TanStack Start v1 (React 19 + roteamento file-based em `src/routes/`).
- **Build**: Vite 7 — deploy em Cloudflare Workers via `wrangler.jsonc`.
- **Banco e auth**: Lovable Cloud (Supabase gerenciado).
- **UI**: Tailwind CSS v4 com tokens em `src/styles.css`, componentes shadcn em `src/components/ui/`.
- **Cliente HTTP / cache de dados**: TanStack Query.

## Como uma página pública é montada

1. O usuário acessa uma URL (ex: `/orgaos`).
2. O TanStack Router resolve o arquivo de rota correspondente em `src/routes/`.
3. O `loader` (quando existe) chama uma **server function** (`createServerFn`) que consulta o Supabase.
4. O componente renderiza usando `useSuspenseQuery` ou `Route.useLoaderData`.
5. Cards e listagens seguem os padrões descritos em [`padroes-ui.md`](./padroes-ui.md).

Dados consumidos pelas páginas **vêm sempre do cache no Supabase** (tabelas `*_cache`), não diretamente das APIs oficiais. O cache é populado pelo [pipeline de importação](./importacao.md), disparado a partir do painel admin.

## Como uma página admin é montada

Mesma estrutura, mas dentro do grupo de rotas `_authenticated/`:

- O layout `src/routes/_authenticated.tsx` exige sessão.
- Cada server function chamada confere se o usuário tem papel `admin` (ver [`admin.md`](./admin.md)).
- O primeiro usuário a se cadastrar vira admin automaticamente (definido em migration).

## Pastas principais

- `src/routes/` — páginas (file-based routing).
- `src/components/` — componentes de aplicação.
- `src/components/ui/` — biblioteca shadcn.
- `src/lib/data/` — server functions e regras por fonte/domínio.
- `src/lib/data/<fonte>/` — uma pasta por fonte oficial (ver [`fontes/`](./fontes/)).
- `src/lib/data/real/portal-client.ts` — cliente HTTP compartilhado entre Portal CGU e Transferegov.
- `src/integrations/supabase/` — clientes Supabase (browser, admin, middleware) — **não editar manualmente**.
- `supabase/migrations/` — esquema do banco.
- `scripts/sync-opensource.mjs` — script de espelhamento para o repositório público.

## Princípios

- **Cache primeiro**: páginas públicas nunca chamam APIs oficiais ao vivo.
- **Admin é a única fonte de escrita**: usuários comuns só leem (RLS).
- **Auditável**: toda ingestão registra log em `importacoes` e qualquer divergência vira `qa_findings`.
- **LGPD por padrão**: textos livres passam por sanitização antes de gravar (ver [`importacao.md`](./importacao.md)).
