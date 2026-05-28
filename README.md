# Auditoria Cidadã

> Plataforma open source para tornar gastos públicos brasileiros legíveis,
> auditáveis e contestáveis por qualquer cidadão.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](./LICENSE)
[![TanStack Start](https://img.shields.io/badge/TanStack-Start-FF6B6B)](https://tanstack.com/start)
[![Supabase](https://img.shields.io/badge/Supabase-Cloud-3ECF8E)](https://supabase.com)

Produção: <https://auditoriacidada.ia.br>

---

## O que é

Auditoria Cidadã é um portal de **transparência de segunda ordem**: em vez de
republicar dados crus, ele cruza, valida e contextualiza informações de fontes
oficiais brasileiras — CGU (contratos), PNCP, Câmara/Senado (CEAP/CEAPS e
votações), Transferegov (convênios e emendas), Siconfi — e expõe **anomalias,
divergências e suspeitas de erro de origem** num formato auditável.

Cada suspeita pode ser inspecionada, re-validada contra a fonte oficial e,
quando confirmada, reportada ao órgão responsável com protocolo.

### Princípios

- **Dado bruto importa menos que dado confiável.** Toda métrica exposta
  tem origem, data de captura e link para reprodução via `curl`.
- **Privacidade respeitada mesmo com dados públicos.** CPFs, e-mails e
  telefones de pessoas físicas são mascarados antes da exibição, conforme a
  LGPD — mesmo quando o portal de origem expõe abertamente.
- **Aberto a contestação.** Qualquer pessoa pode contestar um dado e o fluxo
  de revisão é público.

---

## Stack

- **Frontend + Server**: [TanStack Start](https://tanstack.com/start) v1
  (React 19, SSR, server functions) sobre Vite 7
- **UI**: Tailwind CSS v4 + shadcn/ui + Radix
- **Estado/data fetching**: TanStack Query
- **Backend gerenciado**: Supabase (Postgres + Auth + RLS)
- **Runtime de deploy**: Cloudflare Workers (`nodejs_compat`)
- **Type-safety end-to-end**: TypeScript strict + Zod

---

## Setup local

### Pré-requisitos

- [Bun](https://bun.sh) ≥ 1.1 (recomendado) ou Node ≥ 20
- Um projeto Supabase (gratuito serve) — ou uma instância local via
  [Supabase CLI](https://supabase.com/docs/guides/cli)
- Chave da [API do Portal da Transparência](https://api.portaldatransparencia.gov.br/swagger-ui.html)
  (opcional, mas a maior parte da ingestão depende dela)

### Passos

```bash
# 1. Clone
git clone https://github.com/bernardodiasc/auditoriacidada.git
cd auditoriacidada

# 2. Instale dependências
bun install

# 3. Configure variáveis de ambiente
cp .env.example .env
# edite .env com as credenciais do seu projeto Supabase

# 4. Aplique as migrations no seu Supabase
#    (usa o schema em supabase/migrations/)
supabase link --project-ref <seu-project-ref>
supabase db push

# 5. Rode em dev
bun run dev
```

O app sobe em <http://localhost:3000>. **O primeiro usuário que se
cadastrar é promovido automaticamente a admin** — abra `/login`, crie sua
conta, e você terá acesso a `/admin`.

### Variáveis de ambiente

Veja [`.env.example`](./.env.example) para a lista completa. As mínimas para
rodar:

| Variável | Descrição |
|---|---|
| `VITE_SUPABASE_URL` / `SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY` | Anon key (pública, ok no client) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only**. Necessária para server functions admin |
| `PORTAL_TRANSPARENCIA_API_KEY` | Para ingerir dados da CGU/Transferegov |
| `LOVABLE_API_KEY` | Opcional — só se for usar o gateway de IA da Lovable |

---

## Scripts

| Comando | Descrição |
|---|---|
| `bun run dev` | Servidor de desenvolvimento (HMR) |
| `bun run build` | Build de produção |
| `bun run preview` | Preview do build |
| `bun run lint` | ESLint |
| `bun run format` | Prettier |

---

## Estrutura

```
src/
├── routes/                # File-based routing do TanStack Router
│   ├── _authenticated/    # Rotas que exigem login
│   └── api/public/        # Endpoints HTTP públicos (webhooks etc.)
├── components/            # UI compartilhada (shadcn em ui/)
├── lib/
│   ├── data/              # Server functions por fonte (cgu, pncp, camara, ...)
│   └── sanitize.ts        # Máscaras de PII conforme LGPD
└── integrations/supabase/ # Clientes (client / admin / auth middleware)
supabase/
└── migrations/            # Schema versionado
```

---

## Contribuindo

Veja [CONTRIBUTING.md](./CONTRIBUTING.md). Em resumo:

1. Abra uma issue antes de PRs grandes — alinhar escopo poupa retrabalho.
2. PRs pequenos e focados são revisados muito mais rápido.
3. Mantenha o estilo existente (Prettier + ESLint passando).
4. Para mudanças no schema, gere uma nova migration — **nunca edite as
   existentes**.
5. Não inclua dados sensíveis (e-mails reais, chaves, dumps de dados) nos
   commits.

---

## Licença

Distribuído sob a **GNU Affero General Public License v3.0** (AGPL-3.0).
Veja [LICENSE](./LICENSE) para o texto completo.

Em termos práticos:

- ✅ Você pode usar, estudar, modificar e redistribuir o código.
- ✅ Você pode rodar uma instância própria.
- ⚠️ Se você modificar o código e **disponibilizar o serviço via rede**
  (mesmo sem distribuir binários), precisa publicar o código-fonte das suas
  modificações sob a mesma AGPL.
- ⚠️ Qualquer trabalho derivado precisa permanecer AGPL.

Essa cláusula de rede (a diferença entre GPL e AGPL) existe para impedir que
um terceiro pegue o projeto, melhore só pra si, suba como SaaS fechado e
devolva nada à comunidade.

### Marca e identidade

O nome **"Auditoria Cidadã"**, o logotipo e a identidade visual associada
**não** estão cobertos pela AGPL — são reservados ao mantenedor. Forks
devem escolher um nome próprio.

---

## Créditos

Mantido por [@bernardodiasc](https://github.com/bernardodiasc). Construído
inicialmente com auxílio da plataforma [Lovable](https://lovable.dev).

Dados oficiais: Portal da Transparência (CGU), PNCP, Câmara dos Deputados,
Senado Federal, Transferegov, Siconfi.