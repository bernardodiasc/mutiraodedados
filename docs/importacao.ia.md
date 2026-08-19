# Pipeline de importação — referência técnica

## `portal-client.ts` (compartilhado CGU + Transferegov)

- `portalGet(path, params)` — wrapper com retry/backoff, autenticação via header `chave-api-dados`.
- `portalGetComTexto(path, params)` — como `portalGet`, mas devolve também o body bruto (antes do `JSON.parse`), usado para auditar valores com ponto-fixo no JSON.
- `parseValorPortal(v)` — normaliza valores: number (direto), string pt-BR "1.234,56", decimal "1234.56", milhar "60.000", null/undefined → 0.

> A varredura de contratos confere cada item da listagem contra o detalhe (`fetchDetalheContrato` + `valorAutoritativoCgu` em `qa.ts`): divergência ≥ 100× → grava o valor não-truncado + finding `valor_corrigido_listagem` (`info`, resolvido, com `detalhes.evidencia_bruta`). As heurísticas antigas só-listagem (`possivel_ponto_fixo` etc.) foram aposentadas.

## Contrato de QA finding (`src/lib/data/qa.ts`)

```ts
type QaFinding = {
  fonte: 'cgu' | 'camara' | 'senado' | 'pncp' | 'transferegov' | 'siconfi';
  entidade_tipo: 'contrato' | 'instrumento' | 'despesa' | 'votacao' | 'relatorio';
  entidade_id: string;
  regra: string;                           // ex: 'valor_corrigido_listagem'
  severidade: 'critico' | 'aviso' | 'info';
  origem?: 'heuristica' | 'auto_correcao' | 'denuncia';
  status?: 'aberto' | 'corrigido_origem' | 'falso_positivo' | 'resolvido';
  valor_armazenado?: number | null;
  valor_esperado?: number | null;
  detalhes?: Record<string, unknown>;
};
```

- `flagQA(findings)` é idempotente — não reabre o que já foi resolvido.
- Contratos CGU: divergência listagem×detalhe vira `valor_corrigido_listagem` (`info`, resolvido); regras sobre o cache pós-upsert (`regrasCgu`) são reconciliadas por `sincronizarQaCgu`. Visíveis em `/qualidade`.

## Retries

A política varia por fonte (não há wrapper comum):

- CGU e Transferegov (`real/portal-client.ts`): 2 tentativas, espera fixa de 1500ms entre elas.
- PNCP (`pncp/ingest.functions.ts`): 2 tentativas, espera fixa de 1500ms.
- TSE/CKAN (`ckan/client.ts`): 4 tentativas, backoff 500ms → 1500ms → 4500ms.
- Câmara e Senado (`camara/ingest.functions.ts`, `senado/ingest.functions.ts`): 4 tentativas, backoff 500ms → 1500ms → 4500ms.
- SICONFI (`siconfi/ingest.functions.ts`): sem retry — uma única tentativa; qualquer erro propaga.

Nos clientes com retry: 429, 5xx e erro de rede fazem retry; 4xx (exceto 429) propaga erro.

## Upsert

- Lotes de 200 registros via `supabaseAdmin.from('<cache>').upsert(rows)`.
- Conflito por `id` (chave primária natural quando existe; senão construída como `<entidade>-<numero>`).

## Sanitização (`src/lib/sanitize.ts`)

- `sanitizarTextoPublico(s)` aplica todas as máscaras; idempotente.
- `contemPII(s)` — usado em badges visuais e em `ressanitizarContratosCache`.
- Telefone só é mascarado quando o padrão é inequívoco (DDD entre parênteses ou +55) para evitar falsos positivos com matrículas.

## Janelas

`ANO_INICIO_POR_FONTE` em `src/lib/data/janelas.ts`. `dentroDaJanela(fonte, ano, mes)` rejeita anos anteriores ao início e meses no futuro.

**Fonte anual usa `dentroDaJanelaAnual(fonte, ano)`, não a mensal.** Hoje só o TSE, cujo arquivo é por ano. Representar o ano como `(ano, mês 12)` parece inofensivo e não é: faz o ano CORRENTE ser recusado até dezembro. Foi o que aconteceu com 2026 em agosto — a eleição em curso já tinha candidatos e bens no CDN e a importação recusava o ano inteiro, alegando "fora da janela (2014 em diante)". Ambas as funções aceitam `hoje` como último parâmetro, para os testes não dependerem do relógio (`janelas.test.ts`).