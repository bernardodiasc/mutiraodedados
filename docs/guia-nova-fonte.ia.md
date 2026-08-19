# Guia técnico: adicionar nova fonte

## Estrutura mínima

```
src/lib/data/<fonte>/
  ingest.functions.ts      // server fn de importação (admin-only)
  queries.functions.ts     // server fns de leitura para páginas públicas
  types.ts                 // tipos do domínio dessa fonte
```

## ingest.functions.ts — esqueleto

1. `createServerFn({ method: 'POST' })` + `.middleware([requireSupabaseAuth])`.
2. `inputValidator` com Zod validando datas, UF, IBGE.
3. `await ensureAdmin(context.userId)`.
4. Loop de paginação respeitando `dentroDaJanela` de `janelas.ts`.
5. Cliente HTTP: reusar `portalGet` se a fonte for compatível CGU; senão criar wrapper próprio sobre `fetchComRetry` (`src/lib/data/http-retry.ts`) — a política de retry é única e não se reimplementa; o wrapper da fonte só monta URL/headers e traduz o erro (ver `## Retries` em `importacao.ia.md`).
6. Parse: usar `parseValorPortal` para valores BR; datas via helper `isoDate`/`brDate`.
7. Sanitização: `sanitizarTextoPublico` em todo campo livre antes do upsert.
8. Upsert em lotes de 200 em `<fonte>_<entidade>_cache`.
9. Log em `importacoes` (uma linha por requisição feita).
10. `flagQA(regrasNovaFonte(rows))` ao final do lote.

## Multi-entidade: uma fonte, várias entidades

Quando uma mesma API expõe vários endpoints com a mesma mecânica de paginação (caso do Portal CGU: `/contratos`, `/licitacoes`, `/emendas`, `/convenios`), **não** duplique o loop de varredura por entidade. Reaproveite o motor genérico:

- **`src/lib/data/real/sweep.ts`** — `varrerPaginado({ entidade, fonte, endpoint, montarParams, mapPagina, upsertBatch, … })`: loop retomável por orçamento de tempo, upsert + QA + log por página, registro de rodada em `importacoes`. Cada entidade só fornece `montarParams(pagina)` (dimensão da varredura: órgão, ano ou janela) e `mapPagina` (campos → linha).
- **Chave de varredura composta** em `cgu_varredura` (`montarVarreduraKey`/`parseVarreduraKey`): `<entidade>#<cod|ano>#<ini>#<fim>`. Contratos mantêm o formato legado (sem prefixo) para não invalidar varreduras em andamento.
- **Uma fonte declara vários literais** nos registros: cada entidade vira um literal em `FonteJanela` (`janelas.ts`), `QaFonte` (`qa.ts`), `FONTES_LIMPEZA` (`limpeza.ts`), `Fonte["fonte"]` (`cobertura.functions.ts`) + um `case` no job-builder (`cobertura-jobs.ts`) e uma RPC `cobertura_<fonte>_<entidade>`.
- **Trave os nomes de campo antes do mapper** com `diagnosticarPortalEndpoint` — eles diferem por endpoint e a inspeção ao vivo evita mappers errados.

## Tabela de cache — padrão

- `id` PK (natural ou composto).
- `updated_at timestamptz default now()`.
- Campos derivados (UF, código IBGE, esfera) normalizados.
- `GRANT SELECT ... TO anon, authenticated`; `GRANT ALL ... TO service_role`.
- RLS enabled; policy `SELECT` `using (true)`; sem policy de write.

## Sinais — os três tipos

Taxonomia normativa em [`qualidade-dados.md`](./qualidade-dados.md) (cruzamento → `investigativo`; ausência esperada → `lacuna`; próprio registro → `qualidade`). Todo finding carrega `tipo` (`QaTipoSinal` em `src/lib/data/qa.ts`; default `'qualidade'`).

- **Qualidade** — fonte simples: `regras<NovaFonte>(rows)` em `src/lib/data/qa.ts` retornando `QaFinding[]`. Fonte com catálogo completo: `src/lib/data/<fonte>/qualidade.ts`. Padrões: valores zerados/negativos onde não deveriam; datas absurdas (futuro > 5 anos, passado < 1988); inconsistência entre campos relacionados (ex: valor_global < valor_repasse); sentinelas não tratadas; duplicatas do lote.
- **Lacunas** — `src/lib/data/<fonte>/lacunas.ts`, rodando pós-importação (a ausência só é detectável com o conjunto no cache). Findings com `tipo='lacuna'`; promoção à curadoria via `converterFindingEmLacuna`.
- **Investigativos** — `src/lib/data/<fonte>/investigativos.ts` (nunca em arquivo "qa"). Findings com `tipo='investigativo'`, severidade `aviso`, e `AvisoMetodologico` obrigatório na exposição pública. Teste automatizado garantindo que cruzamento nunca grava `tipo='qualidade'`.

## Janela

Adicionar entrada em `ANO_INICIO_POR_FONTE` em `src/lib/data/janelas.ts`. Tipo `FonteJanela` precisa do novo literal.

## Cobertura

Em `src/lib/data/cobertura-jobs.ts`, registrar a função de ingestão e a tabela-alvo. Em `cobertura-publica.functions.ts`, incluir contagem.

## Limpeza

Em `src/lib/data/limpeza.ts`, catalogar entrada de reset seletivo.

## QA canais

Em `src/lib/data/qa-canais.ts`, adicionar canal oficial de denúncia para essa fonte.

## Admin UI

`src/components/AdminImportPanel.tsx` precisa receber form/botão para a nova fonte. Seguir o padrão das fontes existentes (intervalo de datas + filtros opcionais).

## Rota pública

Criar `src/routes/<dominio>.tsx` (ou rota dinâmica). `head()` obrigatório com title/description/og próprios. `loader` chama `queries.functions.ts` da nova fonte via TanStack Query.

## Tipos

Após a migration ser aplicada, `src/integrations/supabase/types.ts` é regenerado automaticamente — não editar à mão.
