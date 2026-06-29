# Portal da Transparência (CGU)

API oficial da Controladoria-Geral da União. É a principal fonte de dados do Executivo Federal.

- **URL base**: `https://api.portaldatransparencia.gov.br/api-de-dados`
- **Chave**: `PORTAL_TRANSPARENCIA_API_KEY` (registro em [api.portaldatransparencia.gov.br](https://api.portaldatransparencia.gov.br/swagger-ui.html))
- **Janela**: contratos a partir de 2013.
- **Documentação oficial**: <https://api.portaldatransparencia.gov.br/swagger-ui.html>

## O que importamos

- **Contratos** do Executivo Federal — endpoint `/contratos`.
- **Órgãos** SIAFI — catálogo usado pelas páginas de órgão.
- **Convênios** (via `/convenios`) — alimentam o domínio [Transferegov](./transferegov.md).

## Peculiaridades

- **Filtro por vigência, não por assinatura**: no endpoint `/contratos`, os parâmetros `dataInicial`/`dataFinal` filtram pela **vigência** do contrato (são opcionais) — não pela data de assinatura/criação. Consultar mês a mês não devolve "contratos do mês": devolve contratos com vigência ativa na janela, então um contrato plurianual reaparece em todos os meses da sua vigência. Por isso a ingestão roda em **varredura completa por órgão** (sem janela) e aloca cada contrato ao mês/ano pela própria `dataAssinatura`. Detalhes em [`portal-cgu.ia.md`](./portal-cgu.ia.md).
- **Parser de valores BR**: a API às vezes retorna número com vírgula e às vezes com ponto. O cliente compartilhado `portal-client.ts` normaliza tudo via `parseValorPortal`.
- **Varredura por detalhe e correção automática**: para cada contrato, a ingestão consulta o endpoint `/contratos/id` (autoritativo) e compara o valor com a listagem. Se a listagem está truncada (bug ÷10000 da CGU), **a correção é aplicada automaticamente** e registrada como QA finding `valor_corrigido_listagem`. Heurísticas simples de anomalia (`possivel_ponto_fixo`, valor < R$ 100) continuam gerando findings separados sem alterar o valor. Detalhes técnicos em [`portal-cgu.ia.md`](./portal-cgu.ia.md).
- **Varredura retomável**: cada rodada roda até esgotar um orçamento de tempo (~3 min), salvando o progresso na tabela `cgu_varredura`. A próxima rodada retoma de onde parou.
- **Throttling/resiliência**: retry com backoff em erros transitórios (5xx / 429 / rede).

## Quem consome

- [Contratos e fornecedores](../dominios/contratos.md): `/contratos/$id`, `/fornecedores/$cnpj`.
- [Órgãos](../dominios/orgaos.md): `/orgaos`, `/orgaos/$cod`.
- [Convênios e transferências](../dominios/convenios-e-transferencias.md): `/convenios`, `/convenios/$id`.

## Links externos esperados em cards

Cada contrato e convênio do site linka para o respectivo registro em `https://portaldatransparencia.gov.br/...`. Mapeamento de URLs em `src/lib/transparencia.ts`.

## Limites conhecidos

- Cobre apenas Executivo Federal — Legislativo, Judiciário e MPU têm APIs próprias.
- Atraso típico de 1 a 2 meses entre publicação e disponibilização na API.
- Detalhes técnicos sobre parser e cliente: [`portal-cgu.ia.md`](./portal-cgu.ia.md).