# SICONFI — Sistema de Informações Contábeis e Fiscais

- **URL base**: `https://apidatalake.tesouro.gov.br/ords/siconfi/tt`
- **Chave**: não exige.
- **Janela**: 2013.
- **Documentação oficial**: <https://apidatalake.tesouro.gov.br/docs/siconfi>
- **Mantenedor**: Secretaria do Tesouro Nacional (STN).

## Páginas (dois eixos)

- **`/siconfi`** — é o **hub da fonte** (eixo "Por fonte de dados"): descreve o SICONFI, dá o contador e a seção "Como o SICONFI se conecta" (vs Portal CGU, fratura Fundo a Fundo, granularidade). Linka adiante para a página-tipo.
- **`/relatorios-fiscais`** — é a **página-tipo** (eixo "Por tipo de dados"): a listagem dos dados (RREO/RGF/DCA) com filtros UF/exercício/tipo/busca e exportação CSV. É para onde aponta a `rota` da fonte em `cobertura-publica`.

## Relação com o Portal CGU (eixo "Por fonte")

O SICONFI **permanece fonte nativa** e só vive no eixo "Por fonte": RREO/RGF/DCA **não existem** no Portal CGU. Os dois medem coisas diferentes — SICONFI dá a visão contábil consolidada (empenhado/liquidado, todos os entes, mesma metodologia), o [Portal CGU](./portal-cgu.md) dá a execução de pagamentos contrato a contrato. Use SICONFI para **comparar entes** e o Portal para **rastrear contratos**. Ver [SICONFI e relatórios fiscais](../conceitos/siconfi-e-relatorios-fiscais.md).

## O que importamos

- **RREO** — Relatório Resumido da Execução Orçamentária (bimestral).
- **RGF** — Relatório de Gestão Fiscal (quadrimestral/semestral).
- **DCA** — Declaração de Contas Anuais.

## Peculiaridades

- Endpoints segmentados por tipo de relatório e por anexo (ex: Anexo 1 do RREO = Balanço Orçamentário).
- Identificação dos entes via código IBGE: 2 dígitos = estado, 7 dígitos = município.
- Volume grande quando se importa todos os anexos — preferimos importar sob demanda por ente/ano.

## Quem consome

- [Finanças públicas](../dominios/financas-publicas.md):
  - `/siconfi` — hub da fonte.
  - `/relatorios-fiscais` — consulta por ente, exercício e tipo de relatório.

## Links externos esperados

Cada relatório linka para a consulta oficial em `https://siconfi.tesouro.gov.br/siconfi/pages/public/consulta_finbra/finbra_list.jsf`.

## Conceitos relacionados

- [SICONFI e relatórios fiscais](../conceitos/siconfi-e-relatorios-fiscais.md)