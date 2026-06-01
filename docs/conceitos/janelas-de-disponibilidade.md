# Janelas de disponibilidade

Cada fonte oficial publica dados a partir de uma data específica — antes disso, **simplesmente não existe**. O sistema usa esse conhecimento para não desperdiçar requisições e não inferir "zero dados" quando na verdade a fonte ainda nem começava.

## Tabela

| Fonte                                | Início | Razão                                                                  |
| ------------------------------------ | ------ | ---------------------------------------------------------------------- |
| Portal CGU (contratos)               | 2013   | Início da publicação consolidada via API                               |
| Câmara — CEAP                        | 2009   | Início da Cota substituindo o "verbão"                                 |
| Câmara — Votações                    | 2003   | Início da publicação eletrônica                                        |
| Senado — CEAPS                       | 2008   | Início da Cota                                                         |
| Senado — Votações                    | 2003   | Idem Câmara                                                            |
| PNCP                                 | 2021   | Criação do portal (Lei 14.133)                                         |
| Transferegov — convênios via CGU     | 2017   | Consolidação dos dados consistentes no espelho CGU                     |
| Transferegov — emendas especiais     | 2020   | EC 105/2019 regulamentada em 2020                                      |
| Transferegov — emendas finalidade    | 2020   | EC 105/2019                                                            |
| SICONFI                              | 2013   | Início da publicação via API                                           |

## Como é usado

- `src/lib/data/janelas.ts` define `ANO_INICIO_POR_FONTE`.
- `dentroDaJanela(fonte, ano, mes)` rejeita anos anteriores ao início e meses no futuro.
- A página `/cobertura` usa essa info para diferenciar **"não temos dado"** de **"a fonte não tinha dado"**.
- Os jobs de ingestão (`/admin/dados`) recusam períodos fora da janela antes de gastar requisição.

## Atualização

Quando uma fonte avança ou descobrimos que a janela de início era mais ampla, basta atualizar `janelas.ts`. Não precisa migration.