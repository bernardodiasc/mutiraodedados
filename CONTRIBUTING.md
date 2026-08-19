# Contribuindo

Obrigado pelo interesse em contribuir! Este guia cobre o essencial.

## Antes de começar

- **Issues primeiro.** Para qualquer mudança não-trivial (nova feature,
  refatoração, mudança de schema), abra uma issue descrevendo o problema e
  a abordagem. Isso evita PRs grandes que precisam ser refeitos.
- **Bugs:** inclua passos para reproduzir, comportamento esperado e
  comportamento observado. Se for relacionado a dados, inclua o `curl` que
  reproduz a inconsistência contra a fonte oficial.

## Fluxo de PR

1. Fork do repositório, branch a partir de `main`:
   `git checkout -b feat/minha-mudanca`
2. Garanta que o lint e o build passam:
   ```bash
   bun run lint
   bun run build
   ```
3. Commits pequenos e descritivos (português ou inglês, consistente dentro
   do PR).
4. Abra o PR contra `main`, referencie a issue (`Closes #123`).
5. Aguarde revisão. Para mudanças visuais, anexe screenshots.

## Como seu PR é lançado

Depois de aprovado e mergeado, seu PR entra na próxima release do projeto —
o escopo em andamento está sempre no [ROADMAP.md](./ROADMAP.md), e cada
release publicada aparece no [RELEASES.md](./RELEASES.md) e nas Releases do
GitHub, com sua autoria preservada. Você não precisa fazer nada além do PR:
versionamento, changelog e tags são papel do mantenedor (não edite
ROADMAP.md/RELEASES.md no seu PR).

## Estilo de código

- TypeScript estrito — sem `any` sem justificativa.
- Prettier + ESLint são fonte da verdade: `bun run format && bun run lint`.
- O histórico tem um commit de formatação em massa. Configure o `git blame`
  para ignorá-lo (uma vez por clone):
  `git config blame.ignoreRevsFile .git-blame-ignore-revs`
- Componentes pequenos e focados. Lógica de dados em `src/lib/data/`.
- Tokens semânticos do design system (`src/styles.css`) — evite cores
  hardcoded em componentes.

## Mudanças de banco

- **Nunca** edite migrations existentes em `supabase/migrations/`.
- Crie uma nova migration com timestamp.
- Toda tabela nova em `public` precisa de `GRANT` + `RLS` + políticas
  explícitas.
- Roles ficam em `user_roles` + função `has_role(...)` — nunca em `profiles`.

## Segurança e privacidade

- Dados pessoais (CPF, e-mail, telefone) devem passar por
  `sanitizarTextoPublico()` antes de exibição.
- Nunca commite chaves, dumps ou `.env`. Use `.env.example` como referência.
- Vulnerabilidades de segurança: reporte via e-mail privado ao mantenedor
  ao invés de issue pública.

## Código de conduta

Sejamos pessoas decentes. Discussões técnicas são bem-vindas; ataques
pessoais não. Discriminação de qualquer tipo resulta em ban imediato.

## Licença

Ao contribuir, você concorda em licenciar sua contribuição sob a
[AGPL-3.0](./LICENSE), nos mesmos termos do projeto.
