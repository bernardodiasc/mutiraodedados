# AGENTS

Este repositório usa um workflow de 4 documentos vivos. **Comece pelo [WORKFLOW.md](./WORKFLOW.md)** — ele define versionamento, ritmo de trabalho, fechamento de release e a relação entre os repositórios privado e público.

| Documento                    | Papel                                                 |
| ---------------------------- | ----------------------------------------------------- |
| [WORKFLOW.md](./WORKFLOW.md) | Processo, convenções, guardrails e estado atual       |
| [ROADMAP.md](./ROADMAP.md)   | Só futuro: release em andamento e backlog sequenciado |
| [RELEASES.md](./RELEASES.md) | Só passado: releases entregues e validadas            |
| AGENTS.md (este)             | Índice + diretrizes de comportamento do agente        |

Ponteiros do projeto:

- [`docs/`](./docs/README.md) é a fonte única de verdade sobre **como o projeto funciona** — leia [`docs/padroes/debug-problemas.ia.md`](./docs/padroes/debug-problemas.ia.md) antes de depurar build, rotas, banco ou testes.
- Skills em `.claude/skills/` e `.agents/skills/` são **cópias idênticas** — alterar uma exige espelhar a outra.
- Tudo em `docs/`, nos 4 documentos e em `.agents/` é **público por padrão** (espelhado no repositório open source), assim como o código — regras de redação (inclusive a de não citar issues e PRs) na seção 5 do WORKFLOW.md.

## Skills de engenharia

### Issue tracker

Planejamento (mapas e tickets do `wayfinder`) e implementação (issues por milestone, PRs para a `main`) vivem no GitHub do repositório privado. Operações em [`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md); processo na seção 1 do [WORKFLOW.md](./WORKFLOW.md). Push ou merge na `main` só a pedido do mantenedor. Antes de começar qualquer issue, aplicar "Versão de cada trabalho" (seção 1 do WORKFLOW): reivindicar, dar milestone e, se for a primeira issue do milestone, promover a release no ROADMAP — sem precisar pedir.

O repositório público não enxerga issues, PRs nem `.claude/`: o que alguém de fora precisa saber do que está planejado vai, resumido, para o ROADMAP.md, e o que foi entregue para o RELEASES.md. Nunca guardar informação de projeto (decisões, planos, pesquisas, pendências, roteiros) em `.claude/` — isso vive nas issues.

### Idioma

Projeto, documentação, código, issues, PRs e comentários em português, mesmo quando o pedido chegar em outro idioma.

## Agent behavior guidelines

### Act decisively

When you have enough information to act, act. Do not re-derive facts already established in the conversation, re-litigate a decision the user has already made, or narrate options you will not pursue in user-facing messages. If you are weighing a choice, give a recommendation, not an exhaustive survey. This does not apply to thinking blocks.

### Keep changes minimal

Don't add features, refactor, or introduce abstractions beyond what the task requires. A bug fix doesn't need surrounding cleanup and a one-shot operation usually doesn't need a helper. Don't design for hypothetical future requirements: do the simplest thing that works well. Avoid premature abstraction and half-finished implementations. Don't add error handling, fallbacks, or validation for scenarios that cannot happen. Trust internal code and framework guarantees. Only validate at system boundaries (user input, external APIs). Don't use feature flags or backwards-compatibility shims when you can just change the code.

### Assess before fixing

When the user is describing a problem, asking a question, or thinking out loud rather than requesting a change, the deliverable is your assessment. Report your findings and stop. Don't apply a fix until they ask for one. Before running a command that changes system state (restarts, deletes, config edits), check that the evidence actually supports that specific action. A signal that pattern-matches to a known failure may have a different cause.

### Pause only when necessary

Pause for the user only when the work genuinely requires them: a destructive or irreversible action, a real scope change, or input that only they can provide. If you hit one of these, ask and end the turn, rather than ending on a promise.

### Report faithfully

Before reporting progress, audit each claim against a tool result from this session. Only report work you can point to evidence for; if something is not yet verified, say so explicitly. Report outcomes faithfully: if tests fail, say so with the output; if a step was skipped, say that; when something is done and verified, state it plainly without hedging.

### Lead with the outcome

Lead with the outcome. Your first sentence after finishing should answer "what happened" or "what did you find": the thing the user would ask for if they said "just give me the TLDR." Supporting detail and reasoning come after. Being readable and being concise are different things, and readability matters more. The way to keep output short is to be selective about what you include (drop details that don't change what the reader would do next), not to compress the writing into fragments, abbreviations, arrow chains like A → B → fails, or jargon.

### Use your context and delegate

You have ample context remaining. Do not stop, summarize, or suggest a new session on account of context limits. Continue the work.

Delegate independent subtasks to subagents and keep working while they run. Intervene if a subagent goes off track or is missing relevant context.
