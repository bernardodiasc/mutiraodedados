# Órgãos

## Propósito

Mapear quanto cada órgão federal gasta, com quem e em que.

## Páginas públicas

- `/orgaos` — lista todos os órgãos catalogados (Ministérios, autarquias, fundações, etc.). Busca por nome/sigla.
- `/orgaos/$cod` — painel do órgão: série anual de gastos, principais fornecedores, contratos recentes, link para Portal da Transparência.

## Catálogo

`src/lib/data/catalog.ts` traz a base estática de órgãos com:

- Código SIAFI, nome, sigla, função.
- Poder (executivo, legislativo, judiciário, MPU, outros).
- `disponivelPortal` — `true` se o endpoint `/contratos` da CGU cobre. Quando `false`, indicamos a fonte alternativa (ex: Câmara tem API própria).
- `rotaPropria` — rota interna alternativa (ex: Câmara → `/camara`).

## Padrão de card

Card de órgão mostra: sigla, nome, poder, total gasto no período visível, link para `/orgaos/$cod`.

## Admin

- `/admin/dados` — disparar ingestão de contratos por órgão.
- Não há tela de edição de catálogo de órgãos — vive em código (`catalog.ts`).

## Limitações

- Cobertura completa só do Executivo Federal via CGU. Legislativo, Judiciário e MPU aparecem no catálogo mas dependem de fontes próprias.
- A página `/orgaos/$cod` mostra dados consolidados a partir do cache; meses sem ingestão aparecem vazios — checar `/cobertura`.
