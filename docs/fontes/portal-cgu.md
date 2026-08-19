# Portal da Transparência (CGU)

API oficial da Controladoria-Geral da União. É a principal fonte de dados do Executivo Federal e, hoje, o **barramento multi-entidade** da plataforma: o mesmo cliente HTTP e a mesma mecânica de varredura alimentam contratos, licitações, emendas e convênios.

- **URL base**: `https://api.portaldatransparencia.gov.br/api-de-dados`
- **Chave**: `PORTAL_TRANSPARENCIA_API_KEY` (registro em [api.portaldatransparencia.gov.br](https://api.portaldatransparencia.gov.br/swagger-ui.html))
- **Documentação oficial**: <https://api.portaldatransparencia.gov.br/swagger-ui.html>

## O que importamos (eixo "Por tema")

| Tema       | Endpoint                         | Tabela cache           | Varredura                               | Janela | Página/rota                        |
| ---------- | -------------------------------- | ---------------------- | --------------------------------------- | ------ | ---------------------------------- |
| Contratos  | `/contratos` (+ `/contratos/id`) | `contratos_cache`      | por órgão (com conferência por detalhe) | 2013   | `/contratos`, `/contratos/$id`     |
| Licitações | `/licitacoes`                    | `cgu_licitacoes_cache` | por órgão + janela                      | 2013   | `/licitacoes`, `/licitacoes/$id`   |
| Emendas    | `/emendas`                       | `cgu_emendas_cache`    | **por ano**                             | 2014   | `/emendas`, `/emendas/$id`         |
| Convênios  | `/convenios`                     | `cgu_convenios_cache`  | por janela de referência                | 2017   | (repoint de `/convenios` pendente) |

Também importamos os **órgãos** SIAFI (catálogo das páginas de órgão).

> A máquina genérica de varredura vive em [`src/lib/data/real/sweep.ts`](../../src/lib/data/real/sweep.ts) (`varrerPaginado`): retomável por orçamento de tempo, progresso por página em `cgu_varredura` (chave composta `<entidade>#<cod|ano>#…`), upsert + QA + log por página. Contratos têm o ingest próprio (`real/portal.functions.ts`) por causa da conferência-por-detalhe; as demais entidades reaproveitam o motor.

## Campos por endpoint (travados por inspeção ao vivo)

Os nomes de campo abaixo foram confirmados inspecionando o JSON real de cada endpoint (ferramenta `diagnosticarPortalEndpoint`). **Diferem por endpoint** — não presuma.

- **`/licitacoes`** — `id`, `licitacao{numero, objeto, numeroProcesso}`, `dataAbertura`, `dataPublicacao`, `dataResultadoCompra`, `situacaoCompra`, `modalidadeLicitacao`, `valor` (number), `municipio{codigoIBGE, nomeIBGE, uf}`, `unidadeGestora{nome, orgaoMaximo.codigo, orgaoVinculado.cnpj}`. Datas em ISO. QA: `licitacao_sem_desfecho` (revogada/anulada/fracassada/deserta), `data_abertura_ausente`, `ano_invalido`, `valor_negativo`.
- **`/emendas`** — `codigoEmenda`, `ano`, `tipoEmenda` (inclui "Transferências com Finalidade Definida"), `autor`/`nomeAutor`, `numeroEmenda`, `localidadeDoGasto` (`"CIDADE - UF"`), `funcao`, `subfuncao`, `valorEmpenhado`/`valorLiquidado`/`valorPago`/`valorResto*` (**strings pt-BR** `"10.000,00"`). As 3 fases da despesa vêm na própria emenda. QA: `pago_maior_empenhado`, `liquidado_maior_empenhado`, `valor_negativo`.
- **`/convenios`** — `id`, `dataReferencia`, `dimConvenio{codigo, numero, objeto}`, `convenente{cnpjFormatado, nome}`, `municipioConvenente{codigoIBGE, nomeIBGE, uf}`, `orgao{codigoSIAFI, cnpj, nome}`, `situacao`, `tipoInstrumento{descricao}`, `valor`, `valorLiberado`, `valorContrapartida`, `dataInicioVigencia`, `dataFinalVigencia`. QA: `liberado_maior_global`, `valor_negativo`.
- **`/contratos`** — ver [`portal-cgu.ia.md`](./portal-cgu.ia.md) (já existia).

## Peculiaridades

- **Filtro por vigência, não por assinatura** (`/contratos`): `dataInicial`/`dataFinal` filtram pela vigência. Por isso contratos rodam em varredura completa por órgão e alocam pela `dataAssinatura`. (`/licitacoes` filtra por data de abertura; `/convenios` por `dataReferencia`; `/emendas` por `ano`.)
- **`uf` com sigla/nome trocados**: em `/licitacoes` e `/convenios`, o objeto `uf` vem como `{sigla: "RIO DE JANEIRO", nome: "RJ"}` — a sigla de 2 letras está em `uf.nome`. Os mappers pegam robustamente o valor que tiver 2 letras.
- **`/emendas` é por ano**, não por órgão. A varredura usa `ano` como dimensão. Há **sobreposição** com `transferegov_emendas_cache` (finalidade definida) — aceita por decisão de projeto para isolar pipelines.
- **Parser de valores BR**: `parseValorPortal` (em `portal-client.ts`) normaliza número/strings pt-BR; números com 4 casas decimais sinalizam o bug de escala ÷10000 da CGU (corrigido só em contratos, via conferência por detalhe).
- **Varredura retomável + throttling**: cada rodada roda ~3 min, salva progresso em `cgu_varredura`, retoma depois; retry com backoff em 5xx/429/rede.

## Acoplamento com o PNCP — a "fratura de ID"

⚠️ **A API da CGU NÃO expõe `numeroControlePNCP`/`idContratacaoPncp`.** Confirmado inspecionando `/contratos`, `/contratos/id` e `/licitacoes`: nenhum campo com "pncp". Os artigos de referência descrevem esse acoplamento de forma conceitual, mas ele **não está nos dados** desta API. Por isso o cross-link Contratos/Licitações → PNCP é um **link de busca** por CNPJ do órgão + número (ver [`src/lib/links-oficiais.ts`](../../src/lib/links-oficiais.ts)), não um deep-link determinístico. Para o ciclo completo até o edital/TR, o investigador parte daqui e busca no PNCP.

## Links externos esperados em cards

Cada contrato/licitação/convênio/emenda linka para o registro de **busca** no `https://portaldatransparencia.gov.br/...`. Os construtores de URL vivem em [`src/lib/links-oficiais.ts`](../../src/lib/links-oficiais.ts) (cross-fonte, client-safe) e em `src/lib/data/qa.functions.ts` (enriquecimento de findings). **Nota:** `src/lib/transparencia.ts` é o Índice de Transparência Institucional (ITI), não construtor de URL.

## Fora do escopo de código (doc-only)

Endpoints nativos do Portal que **ainda não ingerimos** — ver [sanções e preços de referência](./sancoes-precos-referencia.md):

- **`/despesas/*`** — execução orçamentária em 3 fases (empenho/liquidação/pagamento). É uma família de subendpoints com forma de "documento", não registro de entidade. Adiável; a anatomia das 3 fases já aparece nas emendas.
- **`/transferencias`** — repasses no nível de Ordem Bancária. Retornou **HTTP 403** com a chave atual (provável falta de permissão) e **sobrepõe** as transferências EC 105 já ingeridas em `transferegov_emendas_cache`. Doc-only por ora.
- **`/ceis` e `/cnep`** (sanções) — empresas inidôneas/punidas. São **endpoints nativos do Portal**, então adicionar depois é barato (mesmo `portalGet`, sem nova fonte/cliente).

## Quem consome

- [Contratos e fornecedores](../dominios/contratos.md), [Órgãos](../dominios/orgaos.md), [Convênios e transferências](../dominios/convenios-e-transferencias.md), [Busca e exploração](../dominios/busca-e-exploracao.md).

## Limites conhecidos

- Cobre apenas Executivo Federal — Legislativo, Judiciário e MPU têm APIs próprias.
- Atraso típico de 1 a 2 meses entre publicação e disponibilização na API.
- Detalhes técnicos sobre parser, cliente e conferência por detalhe: [`portal-cgu.ia.md`](./portal-cgu.ia.md).
