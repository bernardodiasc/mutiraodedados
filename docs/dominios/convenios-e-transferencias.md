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
- `/convenios` — convênios e contratos de repasse de uma tabela única (`convenios_cache`), em duas abas sobre os mesmos registros:
  - **Execução federal · Portal CGU** (padrão) — filtros por UF, ano, situação, valor e convenente (nome ou CNPJ, `?convenente=`).
  - **Por ente beneficiário · Portal CGU** (`?fonte=transferegov`) — o mesmo acervo pelo ângulo do ente que recebe; filtros por UF, ano, valor e busca livre.
- `/convenios/$id` — detalhe (concedente, convenente, valores, vigência, link Portal). Quando o convênio foi enriquecido pela origem, mostra o bloco "Na origem (SICONV/Transferegov)" com situação, valor empenhado e desembolsado lidos no Transferegov, e um aviso quando a situação na origem difere da do espelho da CGU.
- `/transferencias` — prévia do endpoint `/transferencias` (repasses OB). Sem dados no acervo: a página mostra uma lacuna ("Ainda não temos esses dados no acervo" — o acesso depende de uma liberação da CGU), explica o que é uma Ordem Bancária e aponta para Emendas (EC 105), Convênios, Relatórios fiscais (SICONFI) e Transferegov.

## Padrão de card

Card de convênio mostra: número + SICONV se disponível, objeto sanitizado, concedente, convenente, valores, situação. Link interno + link externo Portal da Transparência.

Card de transferência mostra: tipo, ente recebedor, valor, autor (deputado/senador) quando aplicável.

## Admin

- `/admin/dados` — importar convênios por intervalo (botão da CGU) ou por ente na aba Estados/Municípios (UF/IBGE); as duas entradas gravam em `convenios_cache`. Na mesma aba, o enriquecimento pela origem lê situação e execução no Transferegov.
- `/admin/qualidade` — curar findings (ex.: `valor_truncado_suspeito` e `repasse_maior_global` — veja [`portal-cgu.ia.md`](../fontes/portal-cgu.ia.md)).

## Fontes

- Convênios: [Portal CGU](../fontes/portal-cgu.md) (endpoint `/convenios` → `convenios_cache`).
- Emendas (incl. EC 105 / Pix): [Portal CGU](../fontes/portal-cgu.md) (endpoint `/emendas` → `cgu_emendas_cache`). O [Transferegov](../fontes/transferegov.md) é o sistema-fonte que opera as EC 105 e fornece detalhe de execução (`cgu_transferegov_emendas_cache`).
- Transferências (Ordem Bancária): endpoint `/transferencias` do Portal — doc-only (403), ver [Transferegov](../fontes/transferegov.md) e [sanções e preços](../fontes/sancoes-precos-referencia.md).

## Conceitos relacionados

- [O que é convênio](../conceitos/o-que-e-convenio.md)
- [Emendas parlamentares](../conceitos/emendas-parlamentares.md)

## Limitações

- Concedente municipal/estadual de convênios entre entes nem sempre aparece — focamos em convênios da União.
- Plano de trabalho detalhado vem do Transferegov quando há código SICONV; do contrário, só o resumo do Portal.
