---
name: mutirao-de-dados-sinais
description: Sistema de sinais do Mutirão de Dados — os três tipos (alerta de qualidade, lacuna, sinal investigativo), onde as regras vivem no código e como criar/testar um sinal novo. Carregar ao criar ou alterar regras de detecção, findings, lacunas ou sinais investigativos de qualquer fonte.
---

# Sistema de sinais — os três tipos

**Definição de negócio (não duplicar aqui):** a taxonomia normativa dos três tipos de sinal e a regra de classificação moram em [`docs/qualidade-dados.md`](/docs/qualidade-dados.md). Onde cada tipo aparece nas páginas públicas e no admin está em [`docs/dominios/anomalias-e-sinais.md`](/docs/dominios/anomalias-e-sinais.md). Leia os dois antes de criar qualquer regra.

Resumo operacional da classificação (a fonte da verdade é o doc): cruzamento de dados → `investigativo`; ausência esperada → `lacuna`; inspeção do próprio registro/lote → `qualidade`.

## Problema da origem vira sinal; erro nosso se corrige

O projeto audita dados públicos. Na importação, um problema do dado na origem (a origem respondeu, mas o que publica está inconsistente ou falta — ex.: lista um registro cujo detalhe dá 404) **não é erro nosso**: vira alerta de qualidade ou lacuna, e a importação não reprova por ele. Erro nosso (parser, código, endpoint, contrato da API mal lido) se corrige no código. A regra completa, com o terceiro caso (origem indisponível), está em [`docs/qualidade-dados.md`](/docs/qualidade-dados.md#problema-da-origem--erro-nosso).

Uma janela reprovada por um problema do dado na origem é um **sinal que falta**. Antes de criar a regra, confirme que o problema é da origem (o id e a URL que chamamos são os que a própria origem devolveu). Depois, no ingest:

1. O registro afetado sai da importação com um aviso `info:` no log da rodada (não erro).
2. O sinal é gravado com `flagQA`, com a evidência em `detalhes` (URL chamada, status, o que a origem trouxe).
3. O registro conta como **descartado** no total da origem, para a conferência fechar (acumulado + descartados = total). Quando o problema só aparece por item, ao longo de várias rodadas, conte a partir dos sinais gravados — ver `descartesDaJanela` em `src/lib/data/camara/votacoes.functions.ts` e [`docs/importacao.md`](/docs/importacao.md#problema-da-origem-na-conferência).

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
