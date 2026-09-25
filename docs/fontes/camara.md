# Câmara dos Deputados

- **URL base**: `https://dadosabertos.camara.leg.br/api/v2`
- **Chave**: não exige.
- **Janela**: CEAP desde 2009, votações desde 2003.
- **Documentação oficial**: <https://dadosabertos.camara.leg.br/>

## O que importamos

- **Deputados** (cadastro da legislatura atual).
- **Despesas CEAP** (Cota para Exercício da Atividade Parlamentar) — mensal, por deputado.
  - Importação **retomável**: cada rodada processa um deputado por vez, limitada por tempo e por subrequisições, e retoma de onde parou (`importacao_varredura`). O painel repete as rodadas até o mês fechar.
- **Votações nominais** e **votos individuais** por período.
- **Proposições** (PLs, PECs, MPs).

## Peculiaridades

- Paginação `pagina` + `itens` — respeitar limite máximo de itens por página.
- **Votos de uma votação não paginam** (observado em 2026-09-25): `/votacoes/{id}/votos` responde 400 a `itens`/`pagina` e, sem eles, devolve todos os votos numa resposta só. Votação simbólica devolve lista vazia.
- **Listagem de votações ordena por `id` ASC**: ordenada por `dataHoraRegistro` a paginação não é estável — março de 2003 veio com 22 de 440 votações repetidas e 22 faltando; por `id` vieram as 440, o mesmo total do CSV em lote. O contrato está em `src/lib/data/camara/votacoes-api.ts`, com testes.
- API ocasionalmente retorna 429; cliente faz retry exponencial.
- Descrições de despesa podem conter PII em casos raros — sanitização aplicada.

## Quem consome

- [Parlamentares](../dominios/parlamentares.md):
  - `/camara` — hub.
  - `/camara/deputados` — lista, ranking de gastos.
  - `/camara/deputados/$id` — perfil + CEAP por mês + fornecedores.
  - `/camara/proposicoes`, `/camara/proposicoes/$id`.
  - `/camara/votacoes`, `/camara/votacoes/$id`.

## Links externos esperados

Cada deputado linka para `https://www.camara.leg.br/deputados/<id>`. Cada votação linka para a página da votação no portal da Câmara. Cada proposição idem.

## Conceitos relacionados

- [CEAP](../conceitos/ceap-e-ceaps.md)
- [Votações nominais](../conceitos/votacoes-nominais.md)
