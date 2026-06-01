# SICONFI — Sistema de Informações Contábeis e Fiscais

- **URL base**: `https://apidatalake.tesouro.gov.br/ords/siconfi/tt`
- **Chave**: não exige.
- **Janela**: 2013.
- **Documentação oficial**: <https://apidatalake.tesouro.gov.br/docs/siconfi>
- **Mantenedor**: Secretaria do Tesouro Nacional (STN).

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
  - `/siconfi` — consulta por ente, exercício e tipo de relatório.

## Links externos esperados

Cada relatório linka para a consulta oficial em `https://siconfi.tesouro.gov.br/siconfi/pages/public/consulta_finbra/finbra_list.jsf`.

## Conceitos relacionados

- [SICONFI e relatórios fiscais](../conceitos/siconfi-e-relatorios-fiscais.md)