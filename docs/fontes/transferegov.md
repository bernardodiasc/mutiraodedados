# Transferegov

- **URL base (convênios)**: via Portal CGU `/convenios` — usa o mesmo cliente do [Portal CGU](./portal-cgu.md).
- **URL base (emendas Pix)**: API direta do Transferegov (`discricionarias.transferegov.sistema.gov.br`).
- **Janela**: convênios desde 2017 (consistência consolidada); emendas Pix desde 2020.
- **Documentação oficial**: <https://www.gov.br/transferegov/pt-br>

## Relação com o Portal CGU (dois eixos)

O endpoint `/convenios` do Portal CGU alimenta **dois lugares**, por decisão de projeto:

- **Eixo "Por fonte" (esta página)**: `transferegov_instrumentos_cache` + `transferegov_emendas_cache` (EC 105). O Transferegov é a fonte nativa dos instrumentos e das emendas Pix.
- **Eixo "Por tema"**: `cgu_convenios_cache` / `cgu_emendas_cache` (tabelas separadas, pipelines de QA/cobertura/limpeza próprios), exibido nas páginas-tópico [Convênios](../dominios/convenios-e-transferencias.md) e Emendas.

Há **sobreposição deliberada**: o mesmo `/convenios` e `/emendas` são ingeridos nas duas tabelas para isolar os dois eixos. A entidade-tópico **Transferências** (endpoint `/transferencias`) é **doc-only** — ver [sanções e preços](./sancoes-precos-referencia.md) (403 + sobreposição com EC 105).

## O que importamos

- **Convênios e contratos de repasse** (SICONV) via Portal CGU.
- **Transferências especiais** (EC 105/2019, conhecidas como "emendas Pix" sem finalidade definida).
- **Transferências com finalidade definida** (EC 105/2019).

## Peculiaridades

- Para emendas Pix, requisições usam User-Agent de navegador (o endpoint bloqueia clientes padrão).
- Paginação `offset/limit` no endpoint direto.
- Convênios usam o mesmo cliente e parser de valores do Portal CGU (`portal-client.ts`) — ver [`portal-cgu.ia.md`](./portal-cgu.ia.md).

## Quem consome

- [Convênios e transferências](../dominios/convenios-e-transferencias.md):
  - `/convenios`, `/convenios/$id`.
  - `/transferencias` — listagem unificada de emendas Pix.
  - `/transferencias/especiais/$id`, `/transferencias/finalidade/$id`.

## Links externos esperados

- Convênios: `https://portaldatransparencia.gov.br/convenios/<id>` ou consulta SICONV no Transferegov quando há código.
- Transferências especiais: página oficial no Transferegov.

## Conceitos relacionados

- [O que é convênio](../conceitos/o-que-e-convenio.md)
- [Emendas parlamentares](../conceitos/emendas-parlamentares.md)