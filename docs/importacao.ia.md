# Pipeline de importação — referência técnica

## `portal-client.ts` (compartilhado CGU + Transferegov)

- `portalGet(path, params)` — wrapper com retry/backoff, autenticação via header `chave-api-dados`.
- `portalGetComTexto(path, params)` — como `portalGet`, mas devolve também o body bruto (antes do `JSON.parse`), usado para auditar valores com ponto-fixo no JSON.
- `parseValorPortal(v)` — normaliza valores: number (direto), string pt-BR "1.234,56", decimal "1234.56", milhar "60.000", null/undefined → 0.

> A heurística de auto-correção via endpoint de detalhe (`corrigirComDetalhe`, `valorPortalSuspeito`, `preservarNumerosBR`) foi removida. Valores suspeitos hoje são apenas **sinalizados** como QA finding `possivel_ponto_fixo` em `portal.functions.ts` (sem corrigir).

## Contrato de QA finding (`src/lib/data/qa.ts`)

```ts
type QaFinding = {
  fonte: 'cgu' | 'camara' | 'senado' | 'pncp' | 'transferegov' | 'siconfi';
  entidade_tipo: 'contrato' | 'instrumento' | 'despesa' | 'votacao' | 'relatorio';
  entidade_id: string;
  regra: string;                           // ex: 'possivel_ponto_fixo'
  severidade: 'critico' | 'aviso' | 'info';
  origem?: 'heuristica' | 'auto_correcao' | 'denuncia';
  status?: 'aberto' | 'corrigido_origem' | 'falso_positivo' | 'resolvido';
  valor_armazenado?: number | null;
  valor_esperado?: number | null;
  detalhes?: Record<string, unknown>;
};
```

- `flagQA(findings)` é idempotente — não reabre o que já foi resolvido.
- Valores suspeitos do Portal CGU geram findings `possivel_ponto_fixo` (severidade `critico`), reconciliados por `sincronizarQaCgu` contra o cache pós-upsert. Visíveis em `/qualidade`.

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