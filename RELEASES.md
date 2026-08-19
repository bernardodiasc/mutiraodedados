# RELEASES — histórico de entregas

Só releases entregues e validadas, em ordem descendente. Planos futuros moram no [ROADMAP.md](./ROADMAP.md); o processo de fechamento no [WORKFLOW.md](./WORKFLOW.md).

<!--
Template de entrada (copiar para o topo ao fechar uma release):

## vX.Y.Z — AAAA-MM-DD

**Resumo:** o que foi entregue, em 2–4 frases.

**Checks executados:** apenas os realmente rodados, com resultado
(ex.: `bun run lint` ✓ · `bun run build` ✓ · `bun run test` — N suítes, M verdes).

**Plano:** docs/planos/vX.Y.Z-<slug>.md (se houver)

**PR de sync público:** link do PR `sync vX.Y.Z` no repositório público.

**Roadmap cidadão:** itens criados em /admin/roadmap (se houver impacto cidadão).

Regras de redação: referências por data e versão, nunca hash de commit
(este arquivo é espelhado no repositório público, cujo histórico não contém
os commits do privado); nada de vulnerabilidade não corrigida; nenhum segredo.
-->

## v0.1.0 — 2026-08-19

**Resumo:** implanta o processo de desenvolvimento do projeto em quatro documentos vivos (WORKFLOW, ROADMAP, RELEASES e AGENTS), com versionamento SemVer escopado pelo roadmap e releases sincronizadas entre o repositório privado e o espelho público. Destrava a suíte de testes, que existia mas não tinha runner configurado — 545 testes passaram a rodar por um comando padrão. Alinha a documentação ao comportamento real do código em seis pontos divergentes.

**Entregas**

- `WORKFLOW.md`, `ROADMAP.md`, `RELEASES.md` e `AGENTS.md` estendido; `docs/planos/` para planos de release; seção "Como seu PR é lançado" no `CONTRIBUTING.md`.
- `vitest.config.ts` standalone (evita o conflito Zod 4 × router-generator sem workaround manual) + scripts `test` e `test:watch`; `docs/padroes/debug-problemas.ia.md` §1 passa de contorno temporário a resolvido.
- Correções docs×código: severidade de `valor_corrigido_listagem` e semântica de `mes_referencia` (`docs/fontes/portal-cgu.ia.md`); política de retry real por fonte (`docs/importacao.ia.md`); exceção de lote de 500 dos contratos (`docs/importacao.md`); referência a `src/routes/api/public/` inexistente (`README.md` e `docs/padroes/server-functions.md`); janela do TSE em 1998 (`docs/fontes/README.md`); rota do Roadmap no `AdminNav`.
- ESLint passa a ignorar `.claude/`, `.wrangler/` e `.tanstack/` — metadata de tooling e caches, não código do produto.

**Checks executados**

- `bun run test` ✓ — 59 arquivos, 545 testes, todos verdes.
- `bun run build` ✓ — com `vitest.config.ts` presente, comprovando que não interfere no build de produção.
- `bunx eslint` ✓ — sem erros nos arquivos tocados pela release.
- Links relativos dos quatro documentos resolvem ✓ · `diff -rq .claude/skills .agents/skills` vazio ✓.
- Validação em staging pelo mantenedor ✓.
- Conhecido e triado: `bun run lint` completo ainda acusa ~4,9 mil erros `prettier/prettier` pré-existentes em `src/` — escopo da v0.2.0.

**Plano:** [docs/planos/v0.1.0-workflow.md](./docs/planos/v0.1.0-workflow.md)

**Roadmap cidadão:** sem item público — infraestrutura interna.

## Baseline (pré-versionamento) — 2026-08-19

O projeto adotou versionamento formal nesta data; todo o trabalho anterior é a baseline sem versão retroativa. O que existia:

- Plataforma no ar com 7 fontes de dados integradas (Portal da Transparência/CGU, TSE, Câmara, Senado, PNCP, Transferegov, SICONFI) e ~79 rotas públicas.
- Sistema de sinais com catálogo central de 45 regras em três tipos (qualidade, lacuna, investigativo), com teste-guarda.
- Admin de importação multi-fonte com orçamento de tempo e retomada (CGU e TSE), log de auditoria em `importacoes` e controles de limpeza.
- 59 arquivos de teste unitário existentes, ainda sem runner configurado.
- Espelhamento privado→público via `scripts/sync-opensource.mjs`.

A primeira release versionada é a **v0.1.0** ([escopo](./ROADMAP.md)).
