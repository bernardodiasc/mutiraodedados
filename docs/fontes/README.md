# Fontes oficiais

Cada fonte tem um arquivo próprio descrevendo **só o que é específico** dela. Regras gerais de ingestão (retries, sanitização, QA, janelas) vivem em [`../importacao.md`](../importacao.md).

## Comparativo

| Fonte                                       | Quem mantém       | Janela | Chave API | Cobre                            | Domínios que consomem |
| ------------------------------------------- | ----------------- | ------ | --------- | -------------------------------- | --------------------- |
| [Portal CGU](./portal-cgu.md)               | CGU               | 2013   | sim       | Contratos do Executivo Federal   | contratos, órgãos, fornecedores |
| [Câmara](./camara.md)                       | Câmara dos Deputados | 2003 | não      | Deputados, CEAP, votações, PLs   | parlamentares         |
| [Senado](./senado.md)                       | Senado Federal    | 2003   | não       | Senadores, CEAPS, votações, matérias | parlamentares     |
| [PNCP](./pncp.md)                           | Governo Federal   | 2021   | não       | Contratos sob Lei 14.133         | contratos             |
| [Transferegov](./transferegov.md)           | Plataforma+ / CGU | 2017   | parcial   | Convênios, emendas Pix           | convênios e transferências |
| [SICONFI](./siconfi.md)                     | Tesouro Nacional  | 2013   | não       | RREO, RGF, DCA                   | finanças públicas     |

## Princípio

Toda informação importada **é cacheada** no Supabase. Páginas públicas leem do cache, nunca da API oficial. Isso garante latência baixa, auditabilidade e independência de quedas das APIs governamentais.

Quando há divergência entre o cache e a fonte oficial (detectada por heurística ou por cidadão), abre-se um [QA finding](../qualidade-dados.md) — nunca silenciosamente.