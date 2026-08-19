# PNCP — Portal Nacional de Contratações Públicas

- **URL base**: `https://pncp.gov.br/api/consulta`
- **Chave**: não exige.
- **Janela**: 2021 (criação do portal).
- **Documentação oficial**: <https://pncp.gov.br/api/consulta/swagger-ui/index.html>

## Relação com o Portal CGU (eixo "Por fonte")

O PNCP é a **fonte autoritativa da camada jurídica** das contratações: edital, termo de referência, atas de lances e o contrato assinado. O [Portal CGU](./portal-cgu.md) traz o **resumo financeiro** de contratos e licitações (eixo "Por tema"), mas **não expõe a chave `numeroControlePNCP`** no JSON — confirmado por inspeção ao vivo. Por isso o cross-link das páginas de Contratos/Licitações para o PNCP é um **link de busca** por CNPJ do órgão + número, não um deep-link. O PNCP é o destino natural para baixar os documentos completos a partir do resumo da CGU.

## O que importamos

- **Contratos** publicados sob a [Lei 14.133/2021](../conceitos/pncp-e-nova-lei-licitacoes.md) — de **todos os entes federados** (União, estados, municípios), não só Executivo Federal.

## Peculiaridades

- Sem chave de API.
- Página padrão: até 500 registros.
- Filtro por UF é aplicado **pós-fetch** — o endpoint de publicação não suporta nativamente.
- Datas em formato `YYYYMMDD`.

## Quem consome

- [Contratos](../dominios/contratos.md):
  - `/pncp` — listagem e busca.

## Por que coexiste com o Portal CGU

- **Portal CGU** = Executivo Federal, ampla cobertura desde 2013.
- **PNCP** = todos os entes, mas só Lei 14.133 (a partir de 2021).

Cobrem universos diferentes. O cidadão precisa dos dois para visão completa, e o site explica isso via `AvisoMetodologico`.

## Links externos esperados

Cada contrato linka para `https://pncp.gov.br/app/contratos/<orgao>/<ano>/<seq>`.

## Conceitos relacionados

- [PNCP e a Nova Lei de Licitações](../conceitos/pncp-e-nova-lei-licitacoes.md)
