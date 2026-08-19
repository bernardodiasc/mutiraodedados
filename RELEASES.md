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

## v0.4.0 — 2026-08-19

**Resumo:** resolve a fragilidade mais séria do diagnóstico. As despesas de gabinete (CEAP na Câmara, CEAPS no Senado) eram importadas percorrendo todos os parlamentares em cache dentro de uma única chamada — centenas deles, cada um com até 30 páginas, sem orçamento, sem retomada e sem teto de subrequisições. Com o histórico de várias legislaturas, era o candidato mais provável a estourar os limites de execução do Worker.

**Entregas**

- Cada passo passa a processar **um parlamentar**, com checkpoint por (casa, ano, mês). Erro de banco ou de rede interrompe a rodada sem avançar o cursor, então a seguinte refaz aquele parlamentar em vez de dá-lo por importado; a lista vem ordenada por id para a retomada não pular nem repetir ninguém.
- O runner ganhou **orçamento de subrequisições**: tempo sozinho não protege do limite por invocação do Workers, porque um passo pode ser rápido e caro. O passo reporta seu custo e a rodada para ao atingir o teto (45 na CEAP, com orçamento de 150s).
- Tabela `importacao_varredura`: o formato de checkpoint do runner genérico, para fonte nova não precisar de tabela própria. RLS ligada, só admin lê, escrita pelo servidor via `service_role` — mesma política das varreduras existentes.
- `src/lib/data/ceap-varredura.ts`: módulo puro com a chave de varredura e o mapeamento cursor→parlamentar, coberto por teste porque o erro que ele evita (pular um parlamentar por um off-by-one) é silencioso.
- O job builder e os botões do painel repetem as rodadas até o mês fechar, como já faziam com as varreduras da CGU.

**Checks executados**

- `bun run test` ✓ — 62 arquivos, 589 testes, todos verdes (13 novos).
- `bun run lint` ✓ 0 erros · `bunx tsc --noEmit` ✓ · `bun run build` ✓.
- Migration aplicada; RLS conferida contra o banco (política única de SELECT para admin, sem política de escrita) ✓.
- Round-trip do checkpoint testado contra o banco real, incluindo a segunda gravação sobre a mesma chave, e a linha de teste removida em seguida ✓.
- **Pendente:** a importação real de um mês de CEAP e CEAPS prevista nos critérios de aceite **não foi executada** — o mantenedor optou por verificar manualmente depois.

**Plano:** sem plano dedicado — escopo detalhado no ROADMAP.

**Roadmap cidadão:** sem item público — infraestrutura interna.

## v0.3.0 — 2026-08-19

**Resumo:** dá às importações a base de resiliência de que a carga histórica depende. Unifica a política de retry, que variava por fonte (e no SICONFI simplesmente não existia), e extrai a mecânica de orçamento, checkpoint e retomada num runner sem nenhuma fonte dentro — a mesma peça que a automação periódica vai consumir mais adiante.

**Entregas**

- `src/lib/data/http-retry.ts`: política única — 4 tentativas, backoff exponencial 500ms → 1,5s → 4,5s, teto de 10s, jitter de ±25% e precedência para o `Retry-After` do servidor. O wrapper devolve a `Response` mesmo com status ruim, para cada fonte manter sua mensagem e o prefixo `TRANSIENT:` que o painel admin usa no circuit breaker.
- Adotam a política: CGU, PNCP, SICONFI, TSE/CKAN e Transferegov (via `portalGet`). O SICONFI, que não tinha retry nenhum, deixa de perder a rodada inteira em qualquer 503 do Tesouro.
- `src/lib/data/runner.ts`: `rodarComOrcamento` roda passos até esgotar o orçamento, grava o checkpoint depois de cada passo e devolve `{concluido, proximoCursor}`. Passo interrompido não avança o cursor — a próxima rodada refaz a página que falhou em vez de dá-la por importada. Todo o estado vive no banco, nada em memória entre rodadas.
- `varrerPaginado` (CGU) delega orçamento, checkpoint e retomada ao runner, com um adaptador de `Checkpoint` sobre `cgu_varredura` — primeiro uso real do runner.
- `docs/importacao.ia.md` documenta a política única e o contrato do runner; o guia de nova fonte deixa de mandar criar wrapper de retry próprio.

**Checks executados**

- `bun run test` ✓ — 61 arquivos, 576 testes, todos verdes (31 novos: 18 do wrapper, 13 do runner, com fetch e relógio injetados).
- `bun run lint` ✓ 0 erros · `bunx tsc --noEmit` ✓ · `bun run build` ✓.
- Bundle do cliente conferido: sem `supabaseAdmin`, sem chave da CGU ✓.
- **Pendente:** a rodada real de importação em `/admin/dados` prevista nos critérios de aceite **não foi executada** — o mantenedor optou por verificar manualmente depois. Até lá, a ausência de regressão no caminho de ingestão está apoiada apenas na suíte e na revisão do código.

**Plano:** sem plano dedicado — escopo detalhado no ROADMAP.

**Roadmap cidadão:** sem item público — infraestrutura interna.

## v0.2.0 — 2026-08-19

**Resumo:** torna o `bun run lint` utilizável como sinal de regressão — ele falhava desde antes do versionamento, com milhares de erros de formatação que escondiam qualquer problema real. Remove duas server functions expostas sem uso e faz o espelhamento para o repositório público recusar-se a reverter contribuições externas.

**Entregas**

- Formatação da base com Prettier em commit mecânico isolado (327 arquivos), com o hash registrado em `.git-blame-ignore-revs` para não poluir o `git blame`. `.prettierignore` passa a ignorar a mesma lista de tooling e caches que o ESLint.
- Erros de lint remanescentes zerados: componentes nomeados nas rotas de artigo (mapas, notas, tutoriais), cast estrutural no lugar de `any` em fixture de teste, e justificativa explícita nos quatro escapes de tipo legítimos (nome de tabela dinâmico contra o `Database` gerado do Supabase, `.or()` fora do tipo do builder, registry heterogêneo).
- `aplicarHeuristicasFonte` e `revalidarFindingsCgu` removidas — endpoints sem caller no app (protegidos por auth de admin, não eram brecha). A re-checagem unitária `revalidarFindingCgu`, que tem UI, permanece.
- `scripts/sync-opensource.mjs` aborta se o `main` público tiver commits posteriores à última tag de release que não vieram de uma sincronização, listando-os — o `rsync --delete` os reverteria em silêncio. Flag `--allow-unported` para o caso deliberado.

**Checks executados**

- `bun run lint` ✓ — 0 erros (16 warnings do padrão shadcn/ui, que não bloqueiam).
- `bun run test` ✓ — 59 arquivos, 545 testes, todos verdes.
- `bun run build` ✓ · `bunx tsc --noEmit` ✓.
- `diff -rq .claude/skills .agents/skills` vazio ✓ — o reformat preservou os espelhos byte a byte.
- Detecção de commits não portados validada em cenário simulado ✓ (lógica de detecção; a integração com `origin/main` não foi exercida ponta a ponta para não escrever no repositório público).
- Validação em staging pelo mantenedor ✓.

**Plano:** [docs/planos/v0.2.0-lint-e-protecao-do-sync.md](./docs/planos/v0.2.0-lint-e-protecao-do-sync.md) — inclui o registro das decisões tomadas.

**Roadmap cidadão:** sem item público — infraestrutura interna.

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
