# Documentação do Auditoria Cidadã

Esta pasta é a fonte única de verdade sobre como o projeto funciona. Foi escrita para ser lida por humanos (colaboradores, jornalistas, cidadãos curiosos) e também usada por agentes de IA que vão modificar o código no futuro.

Arquivos com sufixo `.ia.md` são referências técnicas mais densas, voltadas para IA — humanos podem pular.

## Sumário

### Visão geral

- [Arquitetura](./arquitetura.md) — stack, organização de pastas, fluxo de página.
  - [`arquitetura.ia.md`](./arquitetura.ia.md) — server functions, auth, RLS, env vars, deploy.
- [Pipeline de importação](./importacao.md) — como dados oficiais entram no banco.
  - [`importacao.ia.md`](./importacao.ia.md) — contratos de QA, portal-client, retries.
- [Qualidade de dados](./qualidade-dados.md) — QA findings, severidades, fluxo cidadão de denúncia.
- [Padrões de UI](./padroes-ui.md) — tokens, cards, badges, links externos/internos.
- [Painel admin](./admin.md) — o que cada aba do `/admin` faz.
- [Guia: adicionar uma nova fonte](./guia-nova-fonte.md) — checklist humano.
  - [`guia-nova-fonte.ia.md`](./guia-nova-fonte.ia.md) — passo-a-passo técnico.
- [`modelo-dados.ia.md`](./modelo-dados.ia.md) — tabelas principais e relações.

### Fontes oficiais

Veja o índice em [`fontes/README.md`](./fontes/README.md). Cada arquivo explica **só o que é específico** daquela fonte — janelas, throttling e QA estão centralizados em [`importacao.md`](./importacao.md).

- [Portal da Transparência (CGU)](./fontes/portal-cgu.md)
- [Câmara dos Deputados](./fontes/camara.md)
- [Senado Federal](./fontes/senado.md)
- [PNCP — Portal Nacional de Contratações Públicas](./fontes/pncp.md)
- [Transferegov](./fontes/transferegov.md)
- [SICONFI — Tesouro Nacional](./fontes/siconfi.md)

### Domínios temáticos

Cada arquivo agrupa páginas públicas + telas do admin do mesmo assunto.

- [Contratos e fornecedores](./dominios/contratos.md)
- [Órgãos](./dominios/orgaos.md)
- [Convênios e transferências](./dominios/convenios-e-transferencias.md)
- [Parlamentares](./dominios/parlamentares.md)
- [Finanças públicas](./dominios/financas-publicas.md)
- [Anomalias e sinais](./dominios/anomalias-e-sinais.md)
- [Artigos e aprendizado](./dominios/artigos-e-aprendizado.md)
- [Busca e exploração](./dominios/busca-e-exploracao.md)
- [Páginas institucionais](./dominios/institucional.md)
- [Laboratório cívico (perguntas, caderno, lacunas)](./dominios/laboratorio-civico.md)

### Conceitos do mundo real

Por que esses dados existem, o que significam na prática, qual a lei por trás. Veja [`conceitos/README.md`](./conceitos/README.md).

## Como navegar

- **Quero entender o que o site faz** → comece pelos [domínios](./dominios/).
- **Quero entender de onde vêm os dados** → [fontes](./fontes/) + [pipeline](./importacao.md).
- **Vou contribuir com código** → [arquitetura](./arquitetura.md) + [guia de nova fonte](./guia-nova-fonte.md).
- **Vou alterar regra de qualidade ou anomalia** → [qualidade-dados](./qualidade-dados.md) + [anomalias-e-sinais](./dominios/anomalias-e-sinais.md).

## Regra de ouro

**Nada se duplica.** Se a regra vale para todas as fontes, mora em `importacao.md`. Se vale só para uma, mora em `fontes/<nome>.md`. Arquivos de domínio descrevem páginas e fluxos, não regras de ingestão.