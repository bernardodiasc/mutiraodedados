---
name: mutirao-de-dados-fonte-tse
description: Operação da fonte TSE (dados eleitorais) no Mutirão de Dados — como rodar importações por (arquivo, ano, UF), a ponte parlamentar↔candidato, os sinais da fonte e onde ficam parsers e fixtures. Carregar ao mexer em qualquer código sob src/lib/data/tse ou src/lib/data/ckan, na aba TSE do admin ou nas páginas /eleicoes.
---

# Fonte TSE — operação

**Regras de negócio (não duplicar aqui):** o que a fonte cobre, as duas origens (CKAN × DivulgaCandContas) e o catálogo de sinais estão em [`docs/fontes/tse.md`](/docs/fontes/tse.md); layouts por ano, URLs, aliases de coluna, chunking e contratos das server functions em [`docs/fontes/tse.ia.md`](/docs/fontes/tse.ia.md). Regras gerais de importação: [`docs/importacao.md`](/docs/importacao.md). Taxonomia de sinais: [`docs/qualidade-dados.md`](/docs/qualidade-dados.md) (+ skill `mutirao-de-dados-sinais`).

## Como rodar uma importação

1. `/admin/dados` → aba **TSE**. Ordem recomendada: candidatos → bens → resultados → receitas → despesas (as demais entidades referenciam o catálogo de candidatos).
2. 1 rodada = 1 arquivo (ano × UF), streaming direto do CDN (HTTP Range — o zip nunca é baixado inteiro). Receitas/despesas grandes retomam por contagem de linhas — deixe **auto-continuar** ligado.
3. Depois de candidatos: rode a **ponte** (Vincular deputados/senadores). Depois de contas: rode **lacunas** e **sinais investigativos** (cards da mesma aba).
4. Progresso/retomada em `tse_varredura` (chave `tipo#ano#UF`); a limpeza seletiva em Manutenção zera as chaves da entidade limpa.

## Onde mexer

- Parser novo/coluna nova: `src/lib/data/tse/parsers.ts` — **sempre dirigido por cabeçalho** (alias em `idx.get(...)`), nunca por posição. Confirme o cabeçalho real baixando amostra do CDN antes (ver tse.ia.md) e adicione fixture reduzida em `__fixtures__/` + caso em `parsers.test.ts`.
- Sinal novo: classifique pela taxonomia e siga a skill `mutirao-de-dados-sinais` (qualidade.ts / lacunas.ts / investigativos.ts + runner em sinais.server.ts). Cruzamento NUNCA sai `tipo='qualidade'` (teste de guarda em `investigativos.test.ts`).
- Camada CKAN (`src/lib/data/ckan/client.ts`) é genérica — nada específico do TSE ali; reutilizável por outras fontes CKAN (dados.gov.br etc.).
- Limiar de sinal investigativo: `LIMIARES_INVESTIGATIVOS` em investigativos.ts; toda mudança de calibragem é registrada na seção Versionamento de `/metodologia`.

## Testes

`bunx vitest run src/lib/data/tse src/lib/data/ckan` — fixtures reais (Latin-1) de todos os anos; não substituir por fixtures sintéticas.
