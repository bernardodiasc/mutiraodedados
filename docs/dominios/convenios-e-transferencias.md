# Convênios e transferências

## Propósito

Acompanhar repasses do governo federal para estados, municípios e entidades — incluindo convênios tradicionais e emendas Pix.

## Modelo: página ↔ endpoint do Portal CGU

Cada página-tópico do eixo "Por tema" corresponde a um endpoint `/api-de-dados/*`:

- `/emendas` ↔ `/emendas` (origem das emendas — **inclui as EC 105 / "emendas Pix"** via `tipoEmenda`).
- `/convenios` ↔ `/convenios` (instrumentos de cooperação).
- `/transferencias` ↔ `/transferencias` (repasses no nível de **Ordem Bancária** — execução).

As **EC 105 ("emendas Pix")** são um _tipo de emenda_, não uma fonte à parte: vivem em `/emendas` (filtre por tipo "Finalidade Definida" ou "Especial"). O Transferegov é o _sistema-fonte_ que as opera e fornece detalhe de execução.

## Páginas públicas

- `/emendas` e `/emendas/$id` — **emendas parlamentares** (endpoint `/emendas`, `cgu_emendas_cache`, varredura por ano). 3 fases da despesa (empenhado/liquidado/pago) + restos. Filtro por tipo (incl. EC 105). Eixo "Por tema".
- `/convenios` — convênios e contratos de repasse pelo endpoint `/convenios` (`cgu_convenios_cache`). Filtros por UF, ano, situação, valor.
- `/convenios/$id` — detalhe (concedente, convenente, valores, vigência, link Portal).
- `/transferencias` — página do endpoint `/transferencias` (repasses OB). **Doc-only:** o endpoint retorna 403 com a chave atual; a página explica o conceito, a "fratura Fundo a Fundo" e aponta para Emendas (EC 105), Convênios e SICONFI.
- `/transferencias/especiais/$id` e `/transferencias/finalidade/$id` — detalhe legado de uma EC 105 vinda do Transferegov (`transferegov_emendas_cache`). Mantidos para links antigos; a navegação primária da EC 105 é via `/emendas`.

## Padrão de card

Card de convênio mostra: número + SICONV se disponível, objeto sanitizado, concedente, convenente, valores, situação. Link interno + link externo Portal da Transparência.

Card de transferência mostra: tipo, ente recebedor, valor, autor (deputado/senador) quando aplicável.

## Admin

- `/admin/dados` — disparar ingestão por intervalo + UF/IBGE.
- `/admin/qualidade` — curar findings (ex.: `valor_truncado_suspeito` e `repasse_maior_global` — veja [`portal-cgu.ia.md`](../fontes/portal-cgu.ia.md)).

## Fontes

- Convênios: [Portal CGU](../fontes/portal-cgu.md) (endpoint `/convenios` → `cgu_convenios_cache`).
- Emendas (incl. EC 105 / Pix): [Portal CGU](../fontes/portal-cgu.md) (endpoint `/emendas` → `cgu_emendas_cache`). O [Transferegov](../fontes/transferegov.md) é o sistema-fonte que opera as EC 105 e fornece detalhe de execução (`transferegov_emendas_cache`).
- Transferências (Ordem Bancária): endpoint `/transferencias` do Portal — doc-only (403), ver [Transferegov](../fontes/transferegov.md) e [sanções e preços](../fontes/sancoes-precos-referencia.md).

## Conceitos relacionados

- [O que é convênio](../conceitos/o-que-e-convenio.md)
- [Emendas parlamentares](../conceitos/emendas-parlamentares.md)

## Limitações

- Concedente municipal/estadual de convênios entre entes nem sempre aparece — focamos em convênios da União.
- Plano de trabalho detalhado vem do Transferegov quando há código SICONV; do contrário, só o resumo do Portal.
