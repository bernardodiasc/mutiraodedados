# Senado Federal

- **URL base**: `https://legis.senado.leg.br/dadosabertos`
- **Chave**: não exige.
- **Janela**: CEAPS desde 2008, votações desde 2003.
- **Documentação oficial**: <https://www12.senado.leg.br/dados-abertos>

## Matérias: servidas por `/processo`

Desde a v0.8.0 as matérias vêm de `legis.senado.leg.br/dadosabertos/processo?ano=&sigla=` — o substituto oficial do descontinuado `materia/pesquisa/lista` (desativação anunciada para 2026-02-01, formato quebrado uma vez sem aviso). Uma chamada devolve o ano inteiro de uma sigla; `identificacao` ("PL 8/2025") carrega sigla, número e ano, e `autoria` vem como texto único.

Se um dia for preciso autoria estruturada (lista de autores com tipo e ordem), o detalhe `/processo/{id}` a expõe — ao custo de uma chamada por matéria.

## O que importamos

- **Senadores** em exercício.
- **Despesas CEAPS** (Cota para Exercício da Atividade Parlamentar dos Senadores).
  - Fonte: portal administrativo (`adm.senado.gov.br/adm-dadosabertos`), que entrega o ano inteiro numa chamada. A API antiga em `legis.senado.leg.br` saiu do ar (404) e fazia toda importação voltar vazia.
  - Importação **retomável**: cada rodada grava o mês em lotes, limitada por tempo e por subrequisições, e retoma de onde parou (`importacao_varredura`). O painel repete as rodadas até o mês fechar.
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
