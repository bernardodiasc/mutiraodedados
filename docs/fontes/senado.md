# Senado Federal

- **URL base**: `https://legis.senado.leg.br/dadosabertos`
- **Chave**: não exige.
- **Janela**: CEAPS desde 2008, votações desde 2003.
- **Documentação oficial**: <https://www12.senado.leg.br/dados-abertos>

## O que importamos

- **Senadores** em exercício.
- **Despesas CEAPS** (Cota para Exercício da Atividade Parlamentar dos Senadores).
  - Importação **retomável**: cada rodada processa um senador por vez, limitada por tempo e por subrequisições, e retoma de onde parou (`importacao_varredura`). O painel repete as rodadas até o mês fechar.
- **Votações** plenárias e votos individuais.
- **Matérias legislativas**.

## Peculiaridades

- Respostas costumam vir em formato derivado de XML convertido para JSON — campos podem ser objeto ou array do mesmo tipo dependendo do volume. O parser do ingest normaliza para array sempre.
- Números em pt-BR — `parseValorPortal` (compartilhado) cobre.

## Quem consome

- [Parlamentares](../dominios/parlamentares.md):
  - `/senado` — hub.
  - `/senado/senadores`, `/senado/senadores/$id`.
  - `/senado/votacoes`, `/senado/votacoes/$id`.
  - `/senado/materias`, `/senado/materias/$id`.

## Links externos esperados

Cada senador linka para `https://www25.senado.leg.br/web/senadores/senador/-/perfil/<codigo>`. Votações e matérias linkam para suas páginas oficiais.

## Conceitos relacionados

- [CEAPS](../conceitos/ceap-e-ceaps.md)
- [Votações nominais](../conceitos/votacoes-nominais.md)
