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