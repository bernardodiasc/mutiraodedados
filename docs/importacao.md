# Pipeline de importação

Esta página descreve o que **toda fonte** faz quando dados oficiais são trazidos para o cache do Supabase. Particularidades de cada fonte ficam em [`fontes/`](./fontes/).

## Quem dispara

Sempre o admin, pela tela [`/admin/dados`](./admin.md). Nenhum usuário comum dispara importação, nenhuma página pública chama API oficial ao vivo.

## Etapas comuns

1. **Validação de janela** — se o período pedido está fora da [janela conhecida](./conceitos/janelas-de-disponibilidade.md) daquela fonte (definida em `src/lib/data/janelas.ts`), a requisição é pulada.
2. **Chamada HTTP** — com retries exponenciais e backoff em erros 429/5xx.
3. **Parse** — números brasileiros (com vírgula) e datas DD/MM/AAAA são normalizados (ver `portal-client.ts`).
4. **Sanitização de PII** — textos livres (objeto do contrato, justificativas) passam por `src/lib/sanitize.ts` antes de gravar. CPF, e-mail, telefone com DDD entre parênteses e CEP viram máscara. CNPJ permanece (dado empresarial público). Veja [LGPD e dados públicos](./conceitos/lgpd-e-dados-publicos.md).
5. **Sinalização de valores suspeitos (Portal CGU)** — valores anômalos na listagem (< R$ 100, ou inicial ≥ 1000× o final) são **gravados como recebidos** e sinalizados como QA findings (`possivel_ponto_fixo`) para revisão manual. O ingest não consulta endpoint de detalhe nem corrige valores automaticamente.
6. **Upsert em lote** — grava em tabelas `*_cache` em blocos de ~200 registros.
7. **QA findings** — regras por fonte (em `src/lib/data/qa.ts`) detectam valores inconsistentes, datas absurdas, etc., e gravam em `qa_findings`. Veja [qualidade-dados](./qualidade-dados.md).
8. **Log de auditoria** — cada chamada à API oficial vira uma linha em `importacoes`.

## Quem é cliente HTTP

- **Portal CGU e Transferegov** usam o cliente compartilhado em `src/lib/data/real/portal-client.ts` (mesma autenticação e parser de valores).
- **Câmara, Senado, PNCP, SICONFI** têm clientes próprios em `src/lib/data/<fonte>/ingest.functions.ts`, com retry/backoff equivalentes.

## Throttling

- Portal CGU: retry com backoff em 5xx/429/rede. A ingestão de contratos varre o histórico completo do órgão (paginação de 15 em 15).
- Câmara/Senado: paginação respeitando limites da API; retries em 429.
- PNCP: 500 registros por página; sem chave de API.

## Cobertura

A tela [`/cobertura`](./dominios/busca-e-exploracao.md) cruza o log de `importacoes` com os caches para mostrar: meses sincronizados, meses com dados, meses sem dados confirmados, meses ainda não consultados.

## Limpeza

`src/lib/data/limpeza.ts` cataloga rotinas de limpeza seletiva — usadas quando o admin precisa rederivar uma fonte. Não apaga `qa_findings` resolvidos.

## Para detalhes de contratos, parsers e tipos

Veja [`importacao.ia.md`](./importacao.ia.md).