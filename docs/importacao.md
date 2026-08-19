# Pipeline de importação

Esta página descreve o que **toda fonte** faz quando dados oficiais são trazidos para o cache do Supabase. Particularidades de cada fonte ficam em [`fontes/`](./fontes/).

## Quem dispara

Sempre o admin, pela tela [`/admin/dados`](./admin.md). Nenhum usuário comum dispara importação, nenhuma página pública chama API oficial ao vivo.

## Etapas comuns

1. **Validação de janela** — se o período pedido está fora da [janela conhecida](./conceitos/janelas-de-disponibilidade.md) daquela fonte (definida em `src/lib/data/janelas.ts`), a requisição é pulada.
2. **Chamada HTTP** — com retries exponenciais e backoff em erros 429/5xx.
3. **Parse** — números brasileiros (com vírgula) e datas DD/MM/AAAA são normalizados (ver `portal-client.ts`).
4. **Sanitização de PII** — textos livres (objeto do contrato, justificativas) passam por `src/lib/sanitize.ts` antes de gravar. CPF, e-mail, telefone com DDD entre parênteses e CEP viram máscara. CNPJ permanece (dado empresarial público). Veja [LGPD e dados públicos](./conceitos/lgpd-e-dados-publicos.md).
5. **Conferência de valores (Portal CGU, contratos)** — a varredura confere cada contrato da listagem contra o endpoint de detalhe (`/contratos/id`); quando as leituras divergem em ≥ 100× (bug de escala ÷10000 da API), grava o valor **não-truncado** e registra o alerta `valor_corrigido_listagem` (`info`, já resolvido, com evidência bruta). Entidades sem detalhe por item (licitações, convênios, emendas) apenas sinalizam valores ínfimos (`valor_truncado_suspeito`). Ver [qualidade-dados](./qualidade-dados.md#valores-suspeitos-do-portal-cgu).
6. **Upsert em lote** — grava em tabelas `*_cache` em blocos de ~200 registros (contratos do Portal CGU usam blocos de 500).
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

Duas garantias que a limpeza precisa manter, ambas aprendidas na prática:

- **Tamanho não pode derrubar a operação.** Apagar cada fonte com um `DELETE` único pelo PostgREST estourava o `statement_timeout` (492 mil candidaturas do TSE já bastavam). O caminho hoje são as RPCs `truncar_cache` e `limpar_cache_por_ano` (migration `20260808140000`), com orçamento de tempo próprio de 55 s — abaixo do corte do gateway HTTP, para que o erro chegue nomeando a fonte em vez de virar um 504 de desfecho desconhecido. `TRUNCATE` não percorre linhas, então "apagar tudo" independe do volume. Continuam no `DELETE` direto os casos que a RPC não cobre: `importacoes` (filtros de sub-modo), fontes com `extraEq` e recortes por data. **A RPC é preferência, não dependência**: se ela ainda não existe no banco (`PGRST202`), a limpeza cai no `DELETE` e avisa no resultado que as migrations estão pendentes. Sem isso, a janela entre o merge do código e o `db push` deixaria a manutenção inteira quebrada — foi o que aconteceu na primeira versão desta mudança.
- **Apagar o cache tem que apagar o que foi derivado dele.** Sinais (`qa_findings` + `lacunas`), estado de varredura e tabelas derivadas viram lixo silencioso se sobrarem — uma limpeza completa do TSE deixava 319 vínculos em `tse_parlamentar_candidato` apontando para candidaturas inexistentes e 167 sinais vivos, entre eles 147 `ponte_baixa_confianca` gerados por esses mesmos vínculos. Ao adicionar uma fonte, verifique os três: `QA_FONTE_MAP`, o reset de varredura e eventuais tabelas derivadas.
- **Uma fonte que falha não leva as outras.** Cada fonte roda dentro do próprio `try`, e a resposta traz `falhas` por fonte além de `removed`. Antes, o primeiro erro abortava a função inteira: as fontes seguintes da seleção nunca rodavam, as anteriores já estavam commitadas (cada `DELETE` do PostgREST é uma transação própria) e o admin via um toast citando uma tabela só. `resumirLimpeza` (`src/lib/admin-import/logic.ts`) monta a mensagem com as falhas em primeiro plano.

## Para detalhes de contratos, parsers e tipos

Veja [`importacao.ia.md`](./importacao.ia.md).