# Padrões de UI

## Tokens

Definidos em `src/styles.css` (Tailwind v4, formato OKLCH):

- **Fontes**: `--font-display` (Archivo Black), `--font-sans` (IBM Plex Sans), `--font-mono` (IBM Plex Mono).
- **Cores semânticas**: `--background`, `--foreground`, `--primary`, `--accent`, `--destructive`, `--muted`, `--border`.
- **Radius base**: `--radius: 0.625rem`.

**Regra**: nunca usar classes Tailwind de cor direta (`bg-white`, `text-black`). Sempre tokens semânticos (`bg-background`, `text-foreground`). Adicione novo token em `src/styles.css` antes de usar.

## Cards

Todo card de registro (contrato, convênio, deputado, etc.) deve:

1. Mostrar o identificador legível (número do contrato, nome do deputado).
2. Linkar para a **página interna** daquele item (ex: `/contratos/$id`).
3. Linkar para o **registro oficial externo** (ex: Portal da Transparência) — texto: "Ver na fonte oficial".
4. Quando relevante, mostrar `badge` de QA finding (cor por severidade) e/ou badge de anomalia.

Os links externos por fonte estão padronizados em `src/lib/transparencia.ts`.

## Badges

- **Severidade QA**: `critico` (vermelho/destructive), `aviso` (laranja/accent), `info` (cinza/muted).
- **PII detectada**: badge cinza com tooltip explicando que o texto contém possível dado pessoal mascarado.
- **Anomalia**: badge `accent` com a regra resumida.

## Estados vazios

Componente `EmptyState` em `src/components/EmptyState.tsx`. Sempre explicar **por que** está vazio (ex: "Nenhuma importação realizada neste mês — veja `/cobertura`").

## Avisos metodológicos

`AvisoMetodologico` aparece em páginas onde o dado tem ressalva (ex: PNCP cobre apenas Lei 14.133, não substitui CGU para Executivo Federal). Toda página pública que mostra agregados deve ter um.

## Sanitização visual

Textos vindos das APIs oficiais já chegam sanitizados do banco (ver [`importacao.md`](./importacao.md)). O frontend **não re-sanitiza** — confia no cache.

## Acessibilidade e SEO

- Um `<h1>` por página.
- `head()` por rota com `title`, `description`, `og:title`, `og:description`.
- `og:image` só em rotas leaf, nunca no root.
- Cards de listagem usam `<article>`; navegação principal em `<nav>`.

## Convenções de navegação

- Header e footer vivem em `src/components/SiteHeader.tsx` e `SiteFooter.tsx`.
- Grupos do menu definidos em `src/lib/nav-groups.ts`.
- Admin tem nav própria em `src/components/AdminNav.tsx`.

## Container × View × logic.ts

Padrão de arquitetura aplicado a componentes com estado, efeitos ou queries.

```text
src/
  containers/<Feature>Container.tsx   # estado, queries, handlers, server-fns
  components/<Feature>View.tsx        # stateless, depende só de props
  lib/<feature>/
    logic.ts                          # funções puras (sem React/I/O)
    logic.test.ts                     # vitest
    mocks.ts                          # variantes para /estilo
    types.ts                          # props da View
```

Regras:

- **View** não importa `useQuery`, `useServerFn`, `useState`, `useEffect`,
  `supabase`, server-fns, `toast`. Recebe tudo (dados + callbacks) via props.
- **Container** importa exatamente uma View e funções puras. JSX limitado a
  `<View …props />` + wrappers triviais (Dialog root, fragmentos).
- **logic.ts**: funções puras (entrada → saída). Quando precisarem de `now`
  ou aleatoriedade, recebem como argumento. Cada export tem teste em
  `logic.test.ts` com 1 happy path + 1 borda + erros conhecidos.
- **Rotas** renderizam o Container correspondente; mantêm apenas
  `createFileRoute`, `head()` e guards.
- **Style guide**: cada feature exporta `<feature>Variants` em `mocks.ts` e
  se registra em `src/lib/style-guide/registry.ts`. A aba Composições em
  `/estilo` itera o registry automaticamente.

UI components do shadcn (`src/components/ui/*`) já são stateless e não
entram neste padrão — são primitivas usadas pelas Views.

## Mesmo tipo de dado em mais de uma fonte

Vários tipos de dado existem em fontes diferentes — contratos no Portal CGU **e** no PNCP; convênios no Portal CGU **e** no Transferegov. A regra é **uma página por tipo de dado**, com a fonte escolhida no [`SeletorFonte`](../../src/components/SeletorFonte.tsx) e refletida na URL (`?fonte=`), o que mantém a busca compartilhável e "salvável" no caderno. A fonte histórica do projeto (CGU) é o default e não aparece na URL.

Junto do seletor, o texto da página **explica por que existem duas fontes** e o que distingue cada uma — em contratos, "Portal CGU, só Executivo Federal" contra "PNCP, Lei 14.133, todos os entes"; em convênios, "Transferegov, onde os convênios nascem, por ente beneficiário" contra "CGU, espelho do Executivo Federal com recorte de execução orçamentária". O recorte de cada fonte é **informação cívica**: é o que explica ao visitante por que os números diferem sem que nenhum esteja errado.

Não crie rota nova por fonte. Foi o que fez os 747 convênios do Transferegov ficarem invisíveis até a v0.6.0: existiam no banco, mas a página de convênios lia só a tabela da CGU e devolvia o visitante para a página da fonte, num laço.
