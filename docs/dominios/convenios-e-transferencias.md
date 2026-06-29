# Convênios e transferências

## Propósito

Acompanhar repasses do governo federal para estados, municípios e entidades — incluindo convênios tradicionais e emendas Pix.

## Páginas públicas

- `/convenios` — lista de convênios e contratos de repasse (SICONV). Filtros por UF, município, modalidade, situação.
- `/convenios/$id` — detalhe de um convênio: concedente, convenente, valores (global/repasse/contrapartida), vigência, plano de trabalho, link para Portal da Transparência e Transferegov.
- `/transferencias` — emendas Pix (transferências especiais e com finalidade definida, EC 105/2019).
- `/transferencias/especiais/$id` — detalhe de transferência especial: ente recebedor, valor, autor da emenda.
- `/transferencias/finalidade/$id` — detalhe de transferência com finalidade definida.

## Padrão de card

Card de convênio mostra: número + SICONV se disponível, objeto sanitizado, concedente, convenente, valores, situação. Link interno + link externo Portal da Transparência.

Card de transferência mostra: tipo, ente recebedor, valor, autor (deputado/senador) quando aplicável.

## Admin

- `/admin/dados` — disparar ingestão por intervalo + UF/IBGE.
- `/admin/qualidade` — curar findings (ex.: valores suspeitos `possivel_ponto_fixo` do Portal CGU — veja [`portal-cgu.ia.md`](../fontes/portal-cgu.ia.md)).

## Fontes

- Convênios: [Portal CGU](../fontes/portal-cgu.md) (via `/convenios`).
- Emendas Pix: [Transferegov](../fontes/transferegov.md).

## Conceitos relacionados

- [O que é convênio](../conceitos/o-que-e-convenio.md)
- [Emendas parlamentares](../conceitos/emendas-parlamentares.md)

## Limitações

- Concedente municipal/estadual de convênios entre entes nem sempre aparece — focamos em convênios da União.
- Plano de trabalho detalhado vem do Transferegov quando há código SICONV; do contrário, só o resumo do Portal.