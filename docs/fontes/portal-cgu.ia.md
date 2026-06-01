# Portal CGU — referência técnica

## Cliente

`src/lib/data/real/portal-client.ts` — usado também pelo Transferegov (mesma autenticação).

## Parser

- `preservarNumerosBR(json)` é aplicado **antes** do `JSON.parse` para evitar perda de precisão em valores grandes (16+ dígitos).
- `parseValorPortal(v)` aceita: number, string "1.234,56", string "1234.56", null/undefined → 0.
- Test suite: `src/lib/data/real/portal.parsers.test.ts`.

## Heurística de detalhe

- Limiar: `PORTAL_LIMIAR_SUSPEITA = 100` (era 10_000 antes — gerava muitos falsos positivos).
- Tolerância de diferença: 5%.
- Fluxo: `corrigirComDetalhe({ id, endpointDetalhe, valoresLista, extrairDoDetalhe })`.
  - Retorna `{ ok: true, corrigido: false, valores }` se detalhe confirma listagem.
  - Retorna `{ ok: true, corrigido: true, valores, valoresOriginais }` se difere — chamador gera QA finding de auto-correção.
  - Retorna `{ ok: false }` se detalhe falhou em todas as tentativas — chamador pula o registro.

## Autenticação

Header `chave-api-dados: <key>`. Sem a env var, todas as ingestões da CGU falham com erro explícito.

## Casos conhecidos de QA auto-corrigida

Listagem trazia valor 1000× menor do que o detalhe (provavelmente bug de scale do lado deles): ids `720365306, 721767866, 722569338, 722569402, 722671482, 722832314`. Hoje esses casos disparam `valor_corrigido_via_detalhe` finding visível em `/qualidade`.

## Server functions

- `fetchPortalOrgao(orgaoCod, dataInicial, dataFinal)` — `src/lib/data/real/portal.functions.ts`.
- `importarConveniosTransferegov(...)` — `src/lib/data/transferegov/ingest.functions.ts`.
- `listHistoricoUnificado()` — log unificado de importações.