# Containers

Camada responsável por **estado, efeitos, queries, mutações e handlers**.

Regras:

- Um container importa exatamente uma View (`src/components/<Nome>View.tsx`)
  e funções puras de `src/lib/<feature>/logic.ts`.
- O JSX de um container se limita a `<View …props />` + wrappers triviais
  (ex.: `<Dialog>` root, fragmentos para combinar Views).
- Toda lógica condicional, parsing, formatação, derivação ou redução fica em
  `lib/<feature>/logic.ts` (puro, sem React, sem I/O) e tem teste em
  `logic.test.ts`.
- Containers expõem `displayName` e repassam `ref` quando o componente
  original tinha.

Rotas em `src/routes/...` renderizam o `Container` correspondente; mantêm
`createFileRoute`, `head()`, guards e nada mais.

Ver também `docs/padroes-ui.md` (seção "Container × View × logic.ts").