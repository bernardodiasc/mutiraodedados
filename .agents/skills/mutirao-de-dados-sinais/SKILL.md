---
name: mutirao-de-dados-sinais
description: Sistema de sinais do Mutirão de Dados — os três tipos (alerta de qualidade, lacuna, sinal investigativo), onde as regras vivem no código e como criar/testar um sinal novo. Carregar ao criar ou alterar regras de detecção, findings, lacunas ou sinais investigativos de qualquer fonte.
---

# Sistema de sinais — os três tipos

**Definição de negócio (não duplicar aqui):** a taxonomia normativa dos três tipos de sinal e a regra de classificação moram em [`docs/qualidade-dados.md`](/docs/qualidade-dados.md). Onde cada tipo aparece nas páginas públicas e no admin está em [`docs/dominios/anomalias-e-sinais.md`](/docs/dominios/anomalias-e-sinais.md). Leia os dois antes de criar qualquer regra.

Resumo operacional da classificação (a fonte da verdade é o doc): cruzamento de dados → `investigativo`; ausência esperada → `lacuna`; inspeção do próprio registro/lote → `qualidade`.

## Onde as regras vivem no código

- **Contrato de dados:** `QaFinding` em `src/lib/data/qa.ts`, com campo `tipo: QaTipoSinal` (`'qualidade' | 'lacuna' | 'investigativo'`, default `'qualidade'`). Persistência idempotente via `flagQA` na tabela `qa_findings` (coluna `tipo`, migration `20260706120000`).
- **Fontes legadas (só qualidade):** funções `regras<Fonte>(rows)` em `src/lib/data/qa.ts`.
- **Fontes com catálogo completo (padrão para fontes novas):** um arquivo por tipo em `src/lib/data/<fonte>/`:
  - `qualidade.ts` — roda durante a importação, sobre o lote.
  - `lacunas.ts` — roda pós-importação (a ausência só é detectável com o conjunto carregado).
  - `investigativos.ts` — cruzamentos; roda ao fim de importações relacionadas + server fn admin de re-execução em lote. **Nunca** nomear arquivo de cruzamento como "qa".

## Como criar um sinal novo

1. Classifique pelo doc (`docs/qualidade-dados.md`). Se a detecção cruza tabelas/fontes/anos, é `investigativo` — mesmo que "pareça" defeito.
2. Escreva a regra como função pura que recebe linhas e devolve `QaFinding[]` com `tipo` explícito. Severidade: investigativos nascem sempre `aviso`.
3. Persista com `flagQA` (não inserir direto na tabela).
4. Exposição pública: finding visível em `/qualidade`; investigativos exigem `AvisoMetodologico` no card; lacunas podem ser promovidas à curadoria via `converterFindingEmLacuna`.
5. Card de triagem no admin correspondente (`/admin/qualidade` ou `/admin/sinais`).
6. Documente a regra na página `/metodologia` e no doc da fonte (`docs/fontes/<fonte>.md`).

## Como testar

- Teste unitário vitest junto da regra (`src/lib/data/<fonte>/*.test.ts`) com fixtures reduzidas reais.
- Guarda de taxonomia: todo arquivo `investigativos.ts` deve ter teste garantindo que **nenhum** finding sai com `tipo='qualidade'` (ver `src/lib/data/tse/investigativos.test.ts` como referência).
