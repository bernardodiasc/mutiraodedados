# Câmara dos Deputados

- **URL base**: `https://dadosabertos.camara.leg.br/api/v2`
- **Chave**: não exige.
- **Janela**: CEAP desde 2009, votações desde 2003.
- **Documentação oficial**: <https://dadosabertos.camara.leg.br/>

## O que importamos

- **Deputados** (cadastro da legislatura atual).
- **Despesas CEAP** (Cota para Exercício da Atividade Parlamentar) — mensal, por deputado.
- **Votações nominais** e **votos individuais** por período.
- **Proposições** (PLs, PECs, MPs).

## Peculiaridades

- Paginação `pagina` + `itens` — respeitar limite máximo de itens por página.
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