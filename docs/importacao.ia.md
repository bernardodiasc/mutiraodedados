# Pipeline de importação — referência técnica

## `portal-client.ts` (compartilhado CGU + Transferegov)

- `portalGet(path, params)` — wrapper com retry/backoff, autenticação via header `chave-api-dados`.
- `preservarNumerosBR(json)` — pré-processa JSON antes de `JSON.parse` para preservar precisão de números grandes (evita perda de centavos).
- `parseValorPortal(v)` — normaliza valores: aceita number, string "1.234,56" e string "1234.56".
- `valorPortalSuspeito(v)` — `true` se `v > 0 && v < 100` (limiar `PORTAL_LIMIAR_SUSPEITA`).
- `corrigirComDetalhe({ id, endpointDetalhe, valoresLista, extrairDoDetalhe })` — busca detalhe, compara, retorna `{ ok, corrigido, valores, valoresOriginais }`. Se `ok=false` o chamador deve pular o registro.

## Contrato de QA finding (`src/lib/data/qa.ts`)

```ts
type QaFinding = {
  fonte: 'cgu' | 'camara' | 'senado' | 'pncp' | 'transferegov' | 'siconfi';
  entidade_tipo: 'contrato' | 'instrumento' | 'despesa' | 'votacao' | 'relatorio';
  entidade_id: string;
  regra: string;                           // ex: 'valor_corrigido_via_detalhe'
  severidade: 'critico' | 'aviso' | 'info';
  origem?: 'heuristica' | 'auto_correcao' | 'denuncia';
  status?: 'aberto' | 'corrigido_origem' | 'falso_positivo' | 'resolvido';
  valor_armazenado?: number | null;
  valor_esperado?: number | null;
  detalhes?: Record<string, unknown>;
};
```

- `flagQA(findings)` é idempotente — não reabre o que já foi resolvido.
- Findings de `origem='auto_correcao'` têm `status='corrigido_origem'` e severidade `aviso`. São visíveis em `/qualidade` apenas para auditoria.

## Retries

- 3 tentativas com backoff 500ms → 1500ms → 4500ms.
- 429 e 5xx fazem retry; 4xx (exceto 429) propaga erro.

## Upsert

- Lotes de 200 registros via `supabaseAdmin.from('<cache>').upsert(rows)`.
- Conflito por `id` (chave primária natural quando existe; senão construída como `<entidade>-<numero>`).

## Sanitização (`src/lib/sanitize.ts`)

- `sanitizarTextoPublico(s)` aplica todas as máscaras; idempotente.
- `contemPII(s)` — usado em badges visuais e em `ressanitizarContratosCache`.
- Telefone só é mascarado quando o padrão é inequívoco (DDD entre parênteses ou +55) para evitar falsos positivos com matrículas.

## Janelas

`ANO_INICIO_POR_FONTE` em `src/lib/data/janelas.ts`. `dentroDaJanela(fonte, ano, mes)` rejeita anos anteriores ao início e meses no futuro.