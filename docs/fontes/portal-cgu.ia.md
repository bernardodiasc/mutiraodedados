# Portal CGU — referência técnica

## Cliente

`src/lib/data/real/portal-client.ts` — usado também pelo Transferegov (mesma autenticação).

## Parser

- `parseValorPortal(v)` devolve `number | null`. Aceita number (caminho direto), string pt-BR "1.234,56", decimal "1234.56", milhar pt-BR sem centavos "60.000". **Ausência vira `null`, nunca 0**: `"-"` (como a CGU marca valor não informado), vazio, null/undefined, NaN/Infinity e texto não numérico. Zero só quando a fonte informa zero (`0`, `"0,00"`).
- `somarValoresInformados(a, b)` agrega valores (ex.: planos de ação de uma emenda) somando só os informados; `null` quando nenhum foi informado.
- `valorAutoritativoCgu(listagem, detalhe)` aceita `null` nos dois lados e devolve `valor: null` quando nenhum endpoint informou.
- Test suite: `src/lib/data/real/portal.parsers.test.ts`.

## Varredura por Detalhe (`rodadaContratosCgu`)

O núcleo `rodadaContratosCgu` (em `portal.functions.ts`) é chamável sem sessão: a casca `fetchPortalOrgao` (painel) e o modo nomeado `cgu_contratos` (ferramenta) usam o mesmo, com o mesmo schema (`importarContratosCguSchema`). No painel, sem datas, a ingestão roda como **varredura completa por órgão**; com datas, e sempre no modo nomeado, numa **janela de um mês**, guardando só os contratos com início de vigência no mês. A paginação vai até o fim (última página = tamanho < 15). Para cada contrato na listagem:

1. Busca o endpoint autoritativo `/contratos/id?id=<id>` (detalhe por contrato).
2. Compara os valores da listagem com os do detalhe usando `valorAutoritativoCgu`.
3. Se o detalhe diverge com sinal de bug ÷10000 (ex: listagem=6.000, detalhe=60.000.000), **aplica a correção automática** e persiste o valor correto no cache.
4. Cria um QA finding `valor_corrigido_listagem` (severidade `info`, nasce resolvido) via `findingValorCorrigidoListagem`.

Orçamento, checkpoint e retomada são do runner genérico (`runner.ts`) sobre `cgu_varredura` (chave legada `<cod>` ou `<cod>#<ini>#<fim>`). Cada rodada tem dois tetos: tempo (`orcamentoMs`, padrão 3 min) e custo (`TETO_SUBREQUISICOES_PORTAL` subrequisições: listagem, um detalhe por contrato e uma estimativa das gravações por página). O progresso é salvo a cada página, e a próxima rodada retoma da seguinte — no painel, o cliente (`AdminImportContainer`) repete as rodadas; na ferramenta, o script. Detalhe com falha passageira (429 persistente, 5xx, rede) interrompe a rodada sem avançar a página; com erro definitivo, cai para o valor da listagem e registra o erro.

A linha de rodada vai para `importacoes` com `fonte = cgu`, `escopo` = código do órgão, `resultado` e, na janela de um mês, `ano`/`mes` — casando com a linha e a célula de `cobertura_cgu`.

### Parâmetros de `fetchPortalOrgao`

| Parâmetro     | Tipo    | Default | Descrição                                      |
| ------------- | ------- | ------- | ---------------------------------------------- |
| `codigoOrgao` | string  | —       | Código SIAFI do órgão (4–6 dígitos)            |
| `dataInicial` | string? | —       | ISO YYYY-MM-DD, filtra por vigência (opcional) |
| `dataFinal`   | string? | —       | ISO YYYY-MM-DD, filtra por vigência (opcional) |
| `maxPaginas`  | number  | 5000    | Teto de páginas por rodada (rede de segurança) |
| `delayMs`     | number  | 800     | Pausa entre requisições (páginas e detalhes)   |
| `orcamentoMs` | number  | 180000  | Orçamento de tempo por rodada (~3 min)         |

## Vigência vs. Assinatura

- `dataInicial`/`dataFinal` filtram por **vigência** (não assinatura) — opcionais, confirmado em `/v3/api-docs`. Page size fixo em 15.
- A ingestão roda sem janela (varredura completa) e aloca cada contrato ao mês pela `dataInicioVigencia` (`mes_referencia` = mês do início de vigência; fallback para o mês da `dataAssinatura` quando a vigência não veio).
- A matriz de cobertura mensal continua válida porque o RPC `cobertura_cgu` agrega por `EXTRACT(MONTH FROM data_inicio_vigencia)` (fallback `mes_referencia`).

## Tipos de QA Finding gerados

| Finding                              | Severidade               | Quando                                                                                                                                                   |
| ------------------------------------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `valor_corrigido_listagem`           | `info` (nasce resolvido) | Listagem diverge do detalhe ≥ 100× (truncamento ÷100/1000/10000); o valor não-truncado é gravado e as leituras cruas ficam em `detalhes.evidencia_bruta` |
| `fornecedor_ausente`                 | `aviso`                  | CNPJ/CPF do fornecedor está nulo — contrato salvo com placeholder `CNPJ_FORNECEDOR_AUSENTE`                                                              |
| `discrepancia_extrema_inicial_final` | `critico`/`aviso`        | inicial ≥ 1000× o final (aviso) ou final ≥ 1000× o inicial (crítico), sobre o cache pós-upsert                                                           |
| `valor_muito_baixo`                  | `aviso`                  | 0 < valor final < R$ 100 no cache pós-upsert                                                                                                             |

- Findings são reconciliados por `sincronizarQaCgu` após o upsert de cada página: se o cache já tem valor correto (upsert posterior), o finding é fechado como `corrigido_automaticamente`.
- `flagQA` é idempotente — não reabre findings já resolvidos.

## Autenticação

Header `chave-api-dados: <key>`. Sem a env var `PORTAL_TRANSPARENCIA_API_KEY`, todas as ingestões da CGU falham com erro explícito.

## Server functions relevantes

- `fetchPortalOrgao({ codigoOrgao, dataInicial?, dataFinal?, maxPaginas, delayMs, orcamentoMs })` — `src/lib/data/real/portal.functions.ts`. Sem `dataInicial`/`dataFinal`, varre o histórico completo do órgão (modo padrão); com janela, filtra por vigência. Casca de `rodadaContratosCgu`.
- `sincronizarOrgaosSIAFI` e `verificarAtividadeOrgaos` — `src/lib/data/real/orgaos-siafi.functions.ts`. Cascas de `rodadaCatalogoSiafi` (uma página de `/orgaos-siafi` por passo) e `rodadaAtividadeOrgaos` (um órgão por passo na sonda de `/despesas/por-orgao`), retomáveis em `importacao_varredura` (`orgaos_siafi#nomes`, `orgaos_siafi#atividade`); o painel repete as rodadas até o fim. `orgaosAtivosDoCatalogo` lista os órgãos ativos já sondados — o padrão das tarefas por órgão na ferramenta.
- `importarConveniosTransferegov(...)` — `src/lib/data/transferegov/ingest.functions.ts`.
- `listHistoricoUnificado()` — log unificado de importações.
