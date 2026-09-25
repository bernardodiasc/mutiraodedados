# WORKFLOW — processo de desenvolvimento e releases

Este documento define **como o projeto evolui**: versionamento, ritmo de trabalho, fechamento de release e a relação entre os dois repositórios. Como o projeto **funciona** está em [`docs/`](./docs/README.md) — nada daqui duplica aquilo.

**Dois repositórios, duas audiências.** O trabalho acontece no repositório **privado**, fonte da verdade. O **público** ([github.com/bernardodiasc/mutiraodedados](https://github.com/bernardodiasc/mutiraodedados)) é um espelho gerado a cada release (seção 5): recebe código e documentos, mas **não enxerga as issues, os PRs nem a pasta `.claude/` do privado**. Por isso, tudo o que alguém de fora precisa para entender o que está planejado e o que foi entregue vive nos documentos públicos; as issues guardam a versão completa, para quem trabalha no privado.

| Onde                                        | Audiência            | Guarda                                                                                                                             | Nunca guarda                                                          |
| ------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [ROADMAP.md](./ROADMAP.md)                  | público              | Futuro: visão, release em andamento (escopo e aceite), backlog e resumo dos programas planejados                                   | Trabalho entregue                                                     |
| [RELEASES.md](./RELEASES.md)                | público              | Passado: entregas validadas, com as decisões relevantes tomadas no caminho                                                         | Planos futuros                                                        |
| WORKFLOW.md (este)                          | público              | Processo, convenções, estado atual                                                                                                 | Changelog detalhado                                                   |
| [AGENTS.md](./AGENTS.md)                    | público              | Índice para agentes + diretrizes de comportamento                                                                                  | —                                                                     |
| [`docs/`](./docs/README.md)                 | público              | Como o projeto funciona (fontes, domínios, padrões), atualizado conforme é implementado                                            | Planos, pesquisas, trabalho em andamento                              |
| Issues, milestones e PRs do privado         | mantenedor e agentes | Versão completa do planejamento e da execução: mapas e tickets do `wayfinder`, pesquisas, planos detalhados, fatias, revisão de PR | Algo que o público precisa saber e que não esteja no ROADMAP/RELEASES |
| `.claude/` (privado) e `.agents/` (público) | agentes              | Configuração de ferramentas e skills espelhadas                                                                                    | Informação de projeto: decisões, planos, pendências, roteiros         |

## 1. Processo de release

- **Versões seguem SemVer completo** (`vMAJOR.MINOR.PATCH`) e são escopadas pelo **conteúdo do roadmap, não por sessão de trabalho** — uma release atravessa quantas sessões precisar.
  - `MINOR` — incremento de escopo planejado no ROADMAP.md.
  - `PATCH` — correção sobre release já publicada (hotfix).
  - `MAJOR` — chega a `v1.0.0` apenas quando os critérios de primeira versão estável, documentados no ROADMAP.md, forem atendidos.
- O ROADMAP.md mantém **uma única "release em andamento"** com escopo e critérios de aceite. Cada sessão de trabalho consulta essa seção, avança o escopo e registra progresso na seção "Estado atual" abaixo.
- **Commits usam a convenção vigente** (`feat:`, `fix:`, `docs:`, `test:`…), sem número de versão na mensagem. Versões existem apenas em **tags git e no RELEASES.md**. O `package.json` **não** é fonte de versão.
- **Ciclo de uma release** — vale com ou sem `wayfinder`; o que muda é só onde mora o detalhe:
  1. **Planejar.** Escopo claro, que cabe em poucas sessões: escopo e critérios de aceite vão direto para o ROADMAP. Esforço grande demais para uma sessão, ou com decisões de design em aberto: mapa `wayfinder` no privado (issue `wayfinder:map` com tickets de decisão como sub-issues e bloqueio nativo) e plano completo numa issue ligada ao mapa — operações em [`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md). **Toda decisão que muda escopo, sequência ou critério de aceite atualiza no mesmo passo o resumo público no ROADMAP**; o mapa só termina quando o ROADMAP diz, em versão resumida, o que ele decidiu.
  2. **Promover.** Uma release por vez vira "release em andamento" no ROADMAP (escopo e aceite, versão pública) e ganha o milestone `vX.Y.Z` com as fatias de implementação como issues (versão completa).
  3. **Implementar** pelo fluxo padrão (PR por fatia) ou, a pedido, pelo alternativo (commit direto) — abaixo.
  4. **Fechar e publicar:** o escopo sai do ROADMAP e vira entrada no RELEASES, com as decisões relevantes que só estavam nas issues; depois o sync leva tudo ao público — passos abaixo e na seção 5.
- **Versão de cada trabalho — decidida pelo agente, sem pedir ao mantenedor.** Toda issue que vai gerar código tem milestone antes de o trabalho começar. Regras, na ordem:
  1. A issue já tem milestone: vale ele.
  2. Correção sem escopo novo (bug, dado errado, endpoint depreciado): entra na release em andamento, se houver; senão, no **PATCH seguinte à última release fechada** (`vX.Y.Z+1`), criando o milestone se ainda não existir.
  3. Escopo novo já planejado no ROADMAP: milestone da MINOR em que o ROADMAP o coloca.
  4. Escopo novo fora do ROADMAP, ou regras que dão duas respostas: **parar e perguntar ao mantenedor** — mudar escopo é decisão dele.

  Issues de decisão (tickets do `wayfinder`, perguntas) e tarefas sem código (rodadas de teste, homologação) não têm milestone; o código que nascer delas vira issue própria, com milestone por estas regras. Commits diretos na `main`, inclusive os do Lovable, entram na release em andamento ou, se não houver, no próximo PATCH. Mudança só de documentação de planejamento (ROADMAP, WORKFLOW, resumo vindo do mapa) não abre release sozinha: vai no PR de docs sem milestone, ou junto de outra fatia, e chega ao público no próximo sync.

- **Promoção automática.** Continua valendo uma única release em andamento, e ela **continua em andamento até o merge do seu PR `fecha vX.Y.Z`**: correções que surgirem antes entram nela, e o PR de fechamento é atualizado. Ao começar a primeira issue de um milestone que ainda não é o em andamento:
  - sem release em andamento, o agente promove o milestone: o PR dessa issue atualiza a "Release em andamento" do ROADMAP (MINOR: escopo e aceite do resumo do programa; PATCH: a lista das correções) e o Estado atual deste documento;
  - com outra release em andamento, correção entra nela (regra 2) e escopo novo espera o fechamento. Hotfix urgente em produção com uma MINOR aberta: perguntar ao mantenedor se abre um PATCH em paralelo.
  - PATCH não renumera as MINOR planejadas. Inserir uma MINOR antes das planejadas renumera a sequência (ROADMAP, milestones, mapa) e é decisão do mantenedor.
- **Começar uma issue:** reivindicar (`gh issue edit <n> --add-assignee @me`) antes de qualquer trabalho; conferir ou atribuir o milestone pelas regras acima.
- **Terminar uma issue (fluxo padrão, PR):** checks da seção 2 → PR para a `main` com `Closes #<n>`, **o mesmo milestone da issue** e os checks executados no corpo → parar. Revisão e discussão acontecem nos comentários do PR. **O merge só acontece quando o mantenedor pede** — merge na `main` dispara o deploy. **Nome de branch:** todo branch novo criado a partir de issue se chama `issue-<n>-<slug>` (ex.: `issue-23-valor-ausente`); com várias issues, todos os números em ordem crescente, separados por hífen (ex.: `issue-41-42-43-44-divergencias-qa`). Branch criado automaticamente com outro nome (ex.: `claude/...` do app) é renomeado para esse padrão antes do primeiro push.
- **Commit direto na `main` (fluxo alternativo):** só quando o mantenedor pede explicitamente — hotfix, ajuste pequeno sem issue, trabalho feito fora do fluxo de issues. Nenhum agente faz push para a `main` por conta própria. Commits do Lovable são revisados no fechamento, com atenção a migrations e dependências novas.
- **Fechamento puxado pelo agente.** Quando o último PR do milestone em andamento é mergeado, o agente que fez o merge a pedido do mantenedor — ou a primeira sessão que encontrar o milestone completo — prepara o PR `fecha vX.Y.Z` (passo 4 abaixo) e pede ao mantenedor a validação em staging e a confirmação — as únicas etapas que dependem dele. Depois do merge desse PR, pedido pelo mantenedor, o agente segue sem novo pedido: tag, fechamento do milestone, sync público e bloco do roadmap cidadão (passos 5–7).
- **Com `wayfinder`:** mapa e tickets de decisão não têm milestone; as Notes do mapa registram as versões que ele cobre. Quando o mapa deixa uma release sem decisão em aberto, a sessão cria as issues de implementação dela no milestone correspondente (criando-o se faltar) e confere o resumo no ROADMAP; a promoção acontece pela regra acima quando a primeira dessas issues começar. Decisão que move escopo entre releases move também as issues entre milestones e atualiza o ROADMAP.
- PR no repositório público continua existindo só no sync de release (seção 5).
- **Fechamento de release** (nesta ordem):
  1. Critérios de aceite do ROADMAP.md verificados (checks da seção 2); issues do milestone fechadas ou movidas explicitamente para outro milestone.
  2. PRs da release mergeados na `main` do privado a pedido do mantenedor — o merge dispara o deploy — e **validação em staging** dos fluxos afetados.
  3. **Confirmação explícita do mantenedor**, depois de ver funcionando em staging — sem ela a release não fecha.
  4. **Fechamento documental** em um PR `fecha vX.Y.Z` (ou commit direto, se o mantenedor pedir): escopo migra do ROADMAP.md para uma entrada nova no topo do RELEASES.md, levando junto as decisões relevantes que estavam só nas issues, e a seção "Estado atual" é atualizada. Merge na `main` do privado.
  5. Tag `vX.Y.Z` **no commit de fechamento que ficou na `main`** — a tag precisa apontar para um estado em que os documentos já dizem que a release foi entregue; taggear antes marcaria um commit que ainda lista a release como em andamento. Fechar o milestone.
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

Os roteiros de como cumprir cada check manual estão em [`docs/qa/`](./docs/qa/README.md).

Registre em RELEASES.md **apenas os checks realmente executados**, com resultado.

## 3. Guardrails do projeto

Uma linha por regra; o detalhe mora no doc canônico — não duplique aqui.

- Limites do Cloudflare Workers: importações longas usam orçamento de tempo + retomada — [`debug-problemas.ia.md` §2](./docs/padroes/debug-problemas.ia.md).
- Server functions são sempre declarações estáticas, nunca criadas por factory — [`debug-problemas.ia.md` §5](./docs/padroes/debug-problemas.ia.md).
- `client.server` (service role) jamais importado em `.tsx` que renderiza no cliente — [`debug-problemas.ia.md` §3](./docs/padroes/debug-problemas.ia.md).
- Migrations são imutáveis e nascem em `drizzle/migrations/`, criadas e aplicadas pelo Lovable — [`docs/padroes/migrations.md`](./docs/padroes/migrations.md).
- Toda server function autenticada: `.middleware([requireSupabaseAuth])` + validação Zod; tabela nova = `GRANT` + RLS.
- Texto de fonte externa exibido publicamente passa por `sanitizarTextoPublico()` (LGPD).
- Runtime e gerenciador: **bun** (`bun run`, `bunx`) — nunca npm/npx.
- Skills espelhadas: alterar `.claude/skills/<x>` exige a cópia idêntica em `.agents/skills/<x>`.
- Sem segredos em código, commits ou docs — e docs são públicos por padrão (seção 5).
- Sem force push, rebase, amend ou squash de commits publicados (o repositório sincroniza com o Lovable) — PRs entram na `main` com merge commit, nunca squash ou rebase.

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

**Regras de redação da fronteira** — tudo em `docs/`, nos 4 documentos, em `.agents/` e no código é público por padrão:

- Vulnerabilidade de segurança **não corrigida** nunca entra em documento — segue o canal privado do [CONTRIBUTING.md](./CONTRIBUTING.md). Correção de segurança só é descrita em RELEASES.md **depois** de o fix estar publicado nos dois repositórios.
- Referências primárias por **data e versão, nunca hash de commit** — hashes do privado não existem no histórico do público.
- **Nenhuma referência a issue ou PR do privado** (`#<n>`, "issue <n>", link para `/issues/` ou `/pull/`) em arquivo que vai para o público — documentos, `docs/`, `.agents/`, código, comentários e migrations. O público não enxerga esses números. Descreva a pendência ou a decisão pelo conteúdo, com data e versão; o número fica no commit, no PR e na issue, que não são espelhados.
- Nenhum segredo, URL interna ou dado pessoal. O sanitizador do sync cobre padrões conhecidos, mas a regra é não depender dele.
- Conteúdo que deve **permanecer privado** não tem lugar em `docs/` nem nos 4 documentos — mora nas issues do privado. O sync exclui `.claude/`, `.lovable/`, `.workspace/`, `.env*`, `.mcp.json` e o próprio `scripts/sync-opensource.mjs` (lista completa no cabeçalho do script), mas essas pastas guardam só configuração de ferramenta, não informação de projeto.

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

- **Release em andamento:** nenhuma. A próxima é a v0.14.0 (UX de `/buscar`), que já tem milestone e é promovida quando a primeira issue dela começar.
- **Última release fechada:** v0.13.0, em 2026-09-25 ([RELEASES.md](./RELEASES.md)).
- **Em paralelo, fora de release:**
  - Rodada de testes manuais do mantenedor pelos roteiros de [`docs/qa/`](./docs/qa/README.md), inclusive as rodadas reais de Câmara, Senado e SICONFI que saíram do aceite da v0.13.0.
  - Planejamento de testes automatizados (evals de dados e e2e de UI) e tickets de decisão do programa v0.14.0–v0.22.0, nas issues do privado; resumos no ROADMAP.
- **Outras pendências:**
  - Registrar em `drizzle/migrations/`, pelo Lovable, as quatro alterações da v0.13.0 aplicadas direto no banco (SQL idempotente, então rodar de novo é seguro).
  - Ativação da automação (CRON_SECRET + linha de config — papel do mantenedor, ver docs/automacao.md).
  - 17 warnings de lint do padrão shadcn/ui.
