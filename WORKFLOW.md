# WORKFLOW — processo de desenvolvimento e releases

Este documento define **como o projeto evolui**: versionamento, ritmo de trabalho, fechamento de release e a relação entre os dois repositórios. Como o projeto **funciona** está em [`docs/`](./docs/README.md) — nada daqui duplica aquilo.

| Documento                    | Fonte de verdade sobre                            | Nunca contém        |
| ---------------------------- | ------------------------------------------------- | ------------------- |
| [ROADMAP.md](./ROADMAP.md)   | Futuro: visão, release em andamento, backlog      | Trabalho entregue   |
| [RELEASES.md](./RELEASES.md) | Passado: releases entregues e validadas           | Planos futuros      |
| WORKFLOW.md (este)           | Processo, convenções, estado atual                | Changelog detalhado |
| [AGENTS.md](./AGENTS.md)     | Índice para agentes + diretrizes de comportamento | —                   |

## 1. Processo de release

- **Versões seguem SemVer completo** (`vMAJOR.MINOR.PATCH`) e são escopadas pelo **conteúdo do roadmap, não por sessão de trabalho** — uma release atravessa quantas sessões precisar.
  - `MINOR` — incremento de escopo planejado no ROADMAP.md.
  - `PATCH` — correção sobre release já publicada (hotfix).
  - `MAJOR` — chega a `v1.0.0` apenas quando os critérios de primeira versão estável, documentados no ROADMAP.md, forem atendidos.
- O ROADMAP.md mantém **uma única "release em andamento"** com escopo e critérios de aceite. Cada sessão de trabalho consulta essa seção, avança o escopo e registra progresso na seção "Estado atual" abaixo.
- **Commits usam a convenção vigente** (`feat:`, `fix:`, `docs:`, `test:`…), sem número de versão na mensagem. Versões existem apenas em **tags git e no RELEASES.md**. O `package.json` **não** é fonte de versão.
- Release com mais de ~3 frentes, ou que toca migrations, ganha plano detalhado em `docs/planos/vMAJOR.MINOR.0-<slug>.md`.
- **Trunk-based no privado:** o trabalho entra direto na `main` do privado, em commits pequenos — não há PRs internos. PR existe apenas no repositório público, no sync de release (seção 5).
- **Fechamento de release** (nesta ordem):
  1. Critérios de aceite do ROADMAP.md verificados (checks da seção 2).
  2. Push para a `main` remota do privado — é o que dispara o deploy — e **validação em staging** dos fluxos afetados.
  3. **Confirmação explícita do mantenedor**, depois de ver funcionando em staging — sem ela a release não fecha.
  4. **Commit de fechamento**: escopo migra do ROADMAP.md para uma entrada nova no topo do RELEASES.md, e a seção "Estado atual" é atualizada. Push para a `main` do privado.
  5. Tag `vX.Y.Z` **nesse commit de fechamento** — a tag precisa apontar para um estado em que os documentos já dizem que a release foi entregue; taggear antes marcaria um commit que ainda lista a release como em andamento.
  6. Publicação no repositório público com a **mesma versão** (seção 5) — o sync leva os documentos já fechados.
  7. Bloco JSON da skill `mutirao-de-dados-features-roadmap` emitido para itens com impacto cidadão (seção 4).
- **Invariante: fechar = publicar.** O privado nunca acumula releases fechadas sem sync. Se um dia acontecer (emergência), o caminho degradado é um único PR de catch-up nomeando o intervalo (ex.: `sync v0.3.0–v0.5.0`) e taggeando no público apenas a versão mais recente — as intermediárias não têm commit correspondente no espelho. Evite.

## 2. Checks proporcionais

| Escopo da release        | Checks obrigatórios                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Toda release             | `bun run lint` · `bun run build` · `bun run test`                                     |
| Toca importação de dados | Rodada real da fonte afetada em `/admin/dados`, conferindo o log `importacoes`        |
| Contém migration         | Migration aplicada + `GRANT`/RLS conferidos ([padrões](./docs/padroes/migrations.md)) |
| Muda UI                  | Fluxos afetados testados no preview; screenshots quando visual                        |

Registre em RELEASES.md **apenas os checks realmente executados**, com resultado.

## 3. Guardrails do projeto

Uma linha por regra; o detalhe mora no doc canônico — não duplique aqui.

- Limites do Cloudflare Workers: importações longas usam orçamento de tempo + retomada — [`debug-problemas.ia.md` §2](./docs/padroes/debug-problemas.ia.md).
- Server functions são sempre declarações estáticas, nunca criadas por factory — [`debug-problemas.ia.md` §5](./docs/padroes/debug-problemas.ia.md).
- `client.server` (service role) jamais importado em `.tsx` que renderiza no cliente — [`debug-problemas.ia.md` §3](./docs/padroes/debug-problemas.ia.md).
- Migrations são imutáveis: sempre uma nova, nunca editar existente — [`docs/padroes/migrations.md`](./docs/padroes/migrations.md).
- Toda server function autenticada: `.middleware([requireSupabaseAuth])` + validação Zod; tabela nova = `GRANT` + RLS.
- Texto de fonte externa exibido publicamente passa por `sanitizarTextoPublico()` (LGPD).
- Runtime e gerenciador: **bun** (`bun run`, `bunx`) — nunca npm/npx.
- Skills espelhadas: alterar `.claude/skills/<x>` exige a cópia idêntica em `.agents/skills/<x>`.
- Sem segredos em código, commits ou docs — e docs são públicos por padrão (seção 5).
- Sem force push, rebase, amend ou squash de commits publicados (o repositório sincroniza com o Lovable).

## 4. Os dois roadmaps

| Onde                                                           | Papel                                                                            | Audiência                           |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------- |
| [ROADMAP.md](./ROADMAP.md) / [RELEASES.md](./RELEASES.md)      | Planejamento e histórico de **engenharia** (releases SemVer, critérios técnicos) | Mantenedor, contribuidores, agentes |
| Tabela `roadmap_itens` (páginas `/roadmap` e `/admin/roadmap`) | Comunicação **pública cidadã** (o que o cidadão pode fazer agora)                | Visitantes do site                  |

Os dois convivem: ao fechar uma release, os itens com impacto cidadão viram bloco JSON da skill [`mutirao-de-dados-features-roadmap`](./.claude/skills/mutirao-de-dados-features-roadmap/SKILL.md), colado em `/admin/roadmap`. Itens de infraestrutura interna não vão ao roadmap público.

## 5. Os dois repositórios

O repositório **privado é a fonte da verdade**; o público ([github.com/bernardodiasc/mutiraodedados](https://github.com/bernardodiasc/mutiraodedados)) é espelho gerado por `scripts/sync-opensource.mjs` (rsync com sanitização — veja o cabeçalho do script).

**Publicação de release** (continuação do fechamento da seção 1):

1. `bun run sync:opensource -- <caminho-do-repo-público>` — o script cria branch, copia, sanitiza e deixa staged; **não commita sozinho**.
2. Revisar o diff staged no destino.
3. Commit e PR no público nomeado `sync vX.Y.Z` — **1 release = 1 PR**, com a descrição do PR carregando o texto da entrada correspondente do RELEASES.md (o que está sendo incluído e os checks validados).
4. Após o merge: tag `vX.Y.Z` no público + GitHub Release com o mesmo texto.

Assim privado e público carregam sempre as mesmas versões.

**Regras de redação da fronteira** — tudo em `docs/`, nos 4 documentos e em `.agents/` é público por padrão:

- Vulnerabilidade de segurança **não corrigida** nunca entra em documento — segue o canal privado do [CONTRIBUTING.md](./CONTRIBUTING.md). Correção de segurança só é descrita em RELEASES.md **depois** de o fix estar publicado nos dois repositórios.
- Referências primárias por **data e versão, nunca hash de commit** — hashes do privado não existem no histórico do público.
- Nenhum segredo, URL interna ou dado pessoal. O sanitizador do sync cobre padrões conhecidos, mas a regra é não depender dele.
- Conteúdo que deve **permanecer privado** não tem lugar em `docs/` — mora em `.claude/` ou `.lovable/`, que o sync exclui (junto com `.workspace/`, `.env*`, `.mcp.json` e o próprio `scripts/sync-opensource.mjs`; a lista completa está no cabeçalho do script).

## 6. Contribuições externas

Contribuidores enxergam apenas o repositório público e **não precisam conhecer este workflow** — para eles vale só o [CONTRIBUTING.md](./CONTRIBUTING.md).

**Invariante do espelho: nada vive no `main` público sem existir no privado.** O próximo sync (`rsync --delete`) reverte silenciosamente qualquer diferença.

Fluxo do mantenedor para um PR externo:

1. Revisão no próprio repositório público (lint/build/testes do CONTRIBUTING).
2. Merge no público.
3. **Port imediato ao privado preservando autoria** — `git am` do patch do PR (`curl -L <url-do-pr>.patch | git am`) ou cherry-pick, mantendo o author original.
4. A mudança entra na release em andamento e sai na próxima publicação — o sync encontra conteúdo idêntico e não a reverte.

**Nunca rodar `sync:opensource` com contribuição mergeada no público ainda não portada ao privado.** O script verifica isso sozinho: se o `main` público tiver commits posteriores à última tag de release que não vieram de uma sincronização, ele aborta e lista os commits (a flag `--allow-unported` força, assumindo a reversão).

Contribuidores nunca editam ROADMAP.md, RELEASES.md ou tags — isso é papel do mantenedor.

## 7. Estado atual

- **Release em andamento:** nenhuma. O ciclo autônomo v0.7.0–v0.11.0 foi entregue e publicado em 2026-08-20; o modo autônomo autorizado pelo mantenedor **encerrou** com a v0.11.0.
- **Próximo passo:** rodada única de testes manuais e ajustes do mantenedor (roteiros em `.claude/roteiro-testes-v0.7.0.md` e nas entregas das releases seguintes), que abrirá a próxima versão.
- **Última release fechada:** v0.11.0, em 2026-08-20 ([RELEASES.md](./RELEASES.md)).
- **Pendências conhecidas:** ativação da automação (CRON_SECRET + linha de config — papel do mantenedor, ver docs/automacao.md); decisão de endurecimento em `.claude/decisoes-pendentes.md`; 16 warnings de lint do padrão shadcn/ui.
