# Contratos e fornecedores

## Propósito

Permitir ao cidadão investigar **um contrato específico** ou **uma empresa contratada**, com histórico, valores e links para fontes oficiais.

## Páginas públicas

- `/contratos/$id` — detalhe de um contrato (Executivo Federal). Mostra órgão, fornecedor, objeto sanitizado, valor, datas, modalidade, link para Portal da Transparência. Dados de [Portal CGU](../fontes/portal-cgu.md).
- `/fornecedores/$cnpj` — perfil de uma empresa contratada. Histórico de contratos, órgãos com quem mais contrata, série anual.
- `/pncp` — busca de contratos sob a Lei 14.133 (qualquer ente federado). Dados do [PNCP](../fontes/pncp.md).

## Padrão de card

Card de contrato deve mostrar:

- Número do contrato + órgão contratante.
- Fornecedor (nome + CNPJ).
- Valor total.
- Datas (assinatura / vigência).
- Modalidade (pregão, dispensa, etc.).
- Badge de [QA finding](../qualidade-dados.md) se houver inconsistência.
- Link interno: `/contratos/$id` (CGU) ou rota PNCP equivalente.
- Link externo: registro na fonte oficial.

## Admin

- `/admin/dados` — disparar ingestão de contratos por órgão e período (CGU) ou por intervalo de publicação (PNCP).
- `/admin/qualidade` — curar findings de contratos suspeitos.

## Conceitos relacionados

- [O que é um contrato público](../conceitos/o-que-e-contrato-publico.md)
- [PNCP e a Nova Lei de Licitações](../conceitos/pncp-e-nova-lei-licitacoes.md)
- [LGPD e dados públicos](../conceitos/lgpd-e-dados-publicos.md) — por que CNPJ aparece e CPF é mascarado no campo "objeto".

## Limitações

- Página de contrato CGU não traz empenhos/liquidações detalhados — apenas resumo do contrato.
- Não há cruzamento automático entre CGU e PNCP (universos diferentes).