# Transferegov

- **URL base (convênios)**: via Portal CGU `/convenios` — usa o mesmo cliente do [Portal CGU](./portal-cgu.md).
- **URL base (emendas Pix)**: API direta do Transferegov (`discricionarias.transferegov.sistema.gov.br`).
- **Janela**: convênios desde 2017 (consistência consolidada); emendas Pix desde 2020.
- **Documentação oficial**: <https://www.gov.br/transferegov/pt-br>

## O que importamos

- **Convênios e contratos de repasse** (SICONV) via Portal CGU.
- **Transferências especiais** (EC 105/2019, conhecidas como "emendas Pix" sem finalidade definida).
- **Transferências com finalidade definida** (EC 105/2019).

## Peculiaridades

- Para emendas Pix, requisições usam User-Agent de navegador (o endpoint bloqueia clientes padrão).
- Paginação `offset/limit` no endpoint direto.
- Convênios sofrem a mesma heurística de detalhe do Portal CGU — ver [`portal-cgu.ia.md`](./portal-cgu.ia.md).

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