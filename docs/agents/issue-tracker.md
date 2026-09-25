# Issue tracker: GitHub

Planejamento e implementação vivem como issues e pull requests do GitHub do repositório do clone — o `gh` infere o repositório pelo `git remote`. Para o mantenedor, é o repositório **privado**; issues não são espelhadas no público. Processo, milestones e PRs estão na seção 1 do [WORKFLOW.md](../../WORKFLOW.md); este arquivo só descreve as operações que as skills de engenharia (`wayfinder` e afins) executam.

Tudo em português: títulos, corpos, comentários e nomes de branch.

## Convenções

- **Criar issue:** `gh issue create --title "..." --body-file <arquivo>` (corpo multilinha em arquivo).
- **Ler issue:** `gh issue view <n> --comments`.
- **Listar:** `gh issue list --state open --json number,title,labels,milestone,assignees` com filtros `--label`/`--milestone`.
- **Comentar:** `gh issue comment <n> --body-file <arquivo>`.
- **Labels:** `gh issue edit <n> --add-label "..."` / `--remove-label "..."`.
- **Fechar:** `gh issue close <n> --comment "..."`.
- **Milestone da release:** `gh issue edit <n> --milestone vX.Y.Z`.

## Versão e milestone

Regras de qual versão cada issue recebe, promoção e fechamento: seção 1 do [WORKFLOW.md](../../WORKFLOW.md) ("Versão de cada trabalho"). Operações:

- **Listar milestones:** `gh api repos/<dono>/<repo>/milestones --jq '.[] | "\(.title) — \(.open_issues) abertas"'`.
- **Última release fechada:** `git tag --sort=-v:refname | head -1`.
- **Criar milestone:** `gh api -X POST repos/<dono>/<repo>/milestones -f title=vX.Y.Z -f description="..."`.
- **Atribuir:** `gh issue edit <n> --milestone vX.Y.Z`; PR: `gh pr create --milestone vX.Y.Z`.
- **Fechar milestone:** `gh api -X PATCH repos/<dono>/<repo>/milestones/<número> -f state=closed`.

## Começar e terminar uma issue

1. Reivindicar: `gh issue edit <n> --add-assignee @me`.
1. Branch: `git switch -c issue-<n>-<slug> origin/main` (várias issues: `issue-41-42-43-44-<slug>`) — regra na seção 1 do [WORKFLOW.md](../../WORKFLOW.md).
1. Milestone: conferir; se faltar, atribuir pelas regras do WORKFLOW (e promover a release no ROADMAP se for a primeira issue dela).
1. Implementar e rodar os checks da seção 2 do WORKFLOW.
1. PR para a `main` com `Closes #<n>`, o mesmo milestone e os checks no corpo. Parar: merge só a pedido do mantenedor.

## Pull requests

- **PRs como superfície de triagem: não.** PR externo segue a seção 6 do WORKFLOW, no repositório público.
- Toda fatia de implementação sai de uma issue do milestone da release e volta como PR para a `main` com `Closes #<n>` no corpo. Ler PR: `gh pr view <n> --comments` e `gh pr diff <n>`.
- Issues e PRs compartilham a numeração: `#42` pode ser qualquer um dos dois — resolver com `gh pr view 42` e, se falhar, `gh issue view 42`.

## Quando uma skill disser "publicar no issue tracker"

Criar uma issue no GitHub.

## Quando uma skill disser "buscar o ticket"

`gh issue view <n> --comments`.

## Operações do wayfinder

Usadas por `/wayfinder`. O **mapa** é uma issue; os **tickets** são sub-issues dela.

- **Mapa:** issue com label `wayfinder:map`, corpo com Destination / Notes / Decisions so far / Not yet specified / Out of scope (títulos de seção em inglês, exigidos pela skill; conteúdo em português).
- **Ticket:** sub-issue do mapa (`gh api -X POST repos/<dono>/<repo>/issues/<mapa>/sub_issues -F sub_issue_id=<id-do-banco>`), label `wayfinder:<tipo>` (`research`, `prototype`, `grilling`, `task`). O `<id-do-banco>` é `gh api repos/<dono>/<repo>/issues/<n> --jq .id`, não o número nem o `node_id`.
- **Bloqueio:** dependência nativa do GitHub — `gh api -X POST repos/<dono>/<repo>/issues/<bloqueado>/dependencies/blocked_by -F issue_id=<id-do-banco-do-bloqueador>`. Um ticket está desbloqueado quando todos os bloqueadores estão fechados (`issue_dependencies_summary.blocked_by` = 0).
- **Fronteira:** sub-issues abertas do mapa, sem bloqueador aberto e sem responsável; a primeira na ordem do mapa vence.
- **Reivindicar:** `gh issue edit <n> --add-assignee @me` — a primeira escrita da sessão.
- **Resolver:** comentário com a resposta, `gh issue close <n>` e uma linha (resumo + link) em Decisions so far do mapa. Se a decisão muda escopo, sequência ou critério de aceite, atualizar também o plano completo (issue ligada ao mapa) e o resumo público no `ROADMAP.md` — o repositório público não enxerga issues (seção 1 do WORKFLOW).
- **Pesquisas:** os achados completos vão num comentário do próprio ticket; nada de arquivos em `.claude/` ou `docs/`. Fatos duráveis sobre uma fonte entram em `docs/fontes/` quando a release que a usa for implementada.
