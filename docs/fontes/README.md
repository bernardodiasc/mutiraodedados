# Fontes oficiais

Cada fonte tem um arquivo próprio descrevendo **só o que é específico** dela. Regras gerais de ingestão (retries, sanitização, QA, janelas) vivem em [`../importacao.md`](../importacao.md).

## Dois eixos de navegação

A plataforma organiza os dados em **dois eixos** (em `src/lib/nav-groups.ts`):

- **Por tema** — o que o cidadão investiga: **Contratos, Licitações, Emendas, Convênios** (e, futuramente, Transferências/Despesas). Alimentados principalmente pelo Portal CGU, com cross-link para a fonte autoritativa.
- **Por fonte** — as plataformas: **Portal CGU, PNCP, SICONFI, Transferegov, TSE**. Descrevem o que cada API cobre e fazem deep-link para os temas.

Um mesmo tema pode vir de mais de uma fonte (ex.: contratos existem no Portal CGU _e_ no PNCP), e uma mesma fonte alimenta vários temas (o Portal CGU é multi-entidade — ver [portal-cgu.md](./portal-cgu.md)).

## Comparativo

| Fonte                                              | Quem mantém                 | Janela | Chave API | Cobre                                                                                | Domínios que consomem                             |
| -------------------------------------------------- | --------------------------- | ------ | --------- | ------------------------------------------------------------------------------------ | ------------------------------------------------- |
| [Portal CGU](./portal-cgu.md)                      | CGU                         | 2013   | sim       | Contratos, licitações, emendas, convênios (Executivo Federal)                        | contratos, órgãos, fornecedores, convênios, busca |
| [Câmara](./camara.md)                              | Câmara dos Deputados        | 2003   | não       | Deputados, CEAP, votações, PLs                                                       | parlamentares                                     |
| [Senado](./senado.md)                              | Senado Federal              | 2003   | não       | Senadores, CEAPS, votações, matérias                                                 | parlamentares                                     |
| [PNCP](./pncp.md)                                  | Governo Federal             | 2021   | não       | Contratos sob Lei 14.133                                                             | contratos                                         |
| [Transferegov](./transferegov.md)                  | Plataforma+ / CGU           | 2017   | parcial   | Convênios, emendas Pix                                                               | convênios e transferências                        |
| [SICONFI](./siconfi.md)                            | Tesouro Nacional            | 2013   | não       | RREO, RGF, DCA                                                                       | finanças públicas                                 |
| [TSE](./tse.md)                                    | Tribunal Superior Eleitoral | 1998   | não       | Candidatos, bens, votação, contas de campanha                                        | eleições, parlamentares, fornecedores             |
| [Sanções e preços](./sancoes-precos-referencia.md) | — (roadmap)                 | —      | —         | CEIS/CNEP, TCU, Receita/QSA, Painel de Preços, NF-e, SICAF, despesas, transferências | _doc-only_                                        |

## Princípio

Toda informação importada **é cacheada** no Supabase. Páginas públicas leem do cache, nunca da API oficial. Isso garante latência baixa, auditabilidade e independência de quedas das APIs governamentais.

Quando há divergência entre o cache e a fonte oficial (detectada por heurística ou por cidadão), abre-se um [QA finding](../qualidade-dados.md) — nunca silenciosamente.
