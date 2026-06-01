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

- **Parser de valores BR**: a API às vezes retorna número com vírgula e às vezes com ponto. O cliente compartilhado `portal-client.ts` normaliza tudo via `parseValorPortal` e preserva precisão de números grandes antes do `JSON.parse`.
- **Heurística de detalhe**: quando a listagem traz valor < R$ 100, consultamos o endpoint `/contratos/id` (ou `/convenios/id`) para confirmar. Se difere em >5%, corrigimos automaticamente e registramos um [QA finding](../qualidade-dados.md). Se o detalhe não responde, o registro é pulado.
- **Throttling**: ~8 req/s; pausa extra de 125ms quando há consulta a detalhe.

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