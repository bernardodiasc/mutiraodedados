# Pipeline de importação — referência técnica

## `portal-client.ts` (compartilhado CGU + Transferegov)

- `portalGet(path, params)` — wrapper com retry/backoff, autenticação via header `chave-api-dados`.
- `portalGetComTexto(path, params)` — como `portalGet`, mas devolve também o body bruto (antes do `JSON.parse`), usado para auditar valores com ponto-fixo no JSON.
- `parseValorPortal(v)` — normaliza valores: number (direto), string pt-BR "1.234,56", decimal "1234.56", milhar "60.000". Valor ausente (`"-"`, vazio, null/undefined, texto não numérico) → `null`, nunca 0 ("não localizado" não é zero).

> A varredura de contratos confere cada item da listagem contra o detalhe (`fetchDetalheContrato` + `valorAutoritativoCgu` em `qa.ts`): divergência ≥ 100× → grava o valor não-truncado + finding `valor_corrigido_listagem` (`info`, resolvido, com `detalhes.evidencia_bruta`). As heurísticas antigas só-listagem (`possivel_ponto_fixo` etc.) foram aposentadas.

## Contrato de QA finding (`src/lib/data/qa.ts`)

```ts
type QaFinding = {
  fonte: "cgu" | "camara" | "senado" | "pncp" | "transferegov" | "siconfi";
  entidade_tipo: "contrato" | "instrumento" | "despesa" | "votacao" | "relatorio";
  entidade_id: string;
  regra: string; // ex: 'valor_corrigido_listagem'
  severidade: "critico" | "aviso" | "info";
  origem?: "heuristica" | "auto_correcao" | "denuncia";
  status?: "aberto" | "corrigido_origem" | "falso_positivo" | "resolvido";
  valor_armazenado?: number | null;
  valor_esperado?: number | null;
  detalhes?: Record<string, unknown>;
};
```

- `flagQA(findings)` é idempotente — não reabre o que já foi resolvido.
- Contratos CGU: divergência listagem×detalhe vira `valor_corrigido_listagem` (`info`, resolvido); regras sobre o cache pós-upsert (`regrasCgu`) são reconciliadas por `sincronizarQaCgu`. Visíveis em `/qualidade`.

## Retries

Política **única**, em `src/lib/data/http-retry.ts`. Não reimplemente retry em cliente novo — use `fetchComRetry`.

`RETRY_PADRAO`: 4 tentativas, backoff exponencial 500ms → 1500ms → 4500ms, teto de 10s, jitter de ±25%.

- Erro de rede, 429 e 5xx → nova tentativa.
- 4xx (exceto 429) → devolve na hora; quem chamou decide.
- `Retry-After` do servidor (segundos ou data HTTP) tem precedência sobre o backoff calculado.
- O jitter existe para rodadas que falham ao mesmo tempo não voltarem ao mesmo tempo.

`fetchComRetry` devolve a `Response` mesmo com status ruim — a mensagem de erro é de cada fonte. Só lança quando nenhuma tentativa teve resposta (rede fora em todas). Use `ehStatusTransitorio(status)` para decidir o prefixo `TRANSIENT:`, que o painel admin lê para abrir o circuito depois de três falhas seguidas na mesma fonte.

Adotam a política: CGU e Transferegov (via `portalGet`), PNCP, SICONFI, TSE/CKAN. Câmara e Senado ainda têm laço próprio equivalente ao padrão.

Para ajustar por fonte, passe `politica` parcial — ex.: `fetchComRetry(url, init, { politica: { tentativas: 6 } })`. Para teste, injete `fetchImpl`, `sleepImpl`, `aleatorio` e `agora`.

## Runner retomável (`src/lib/data/runner.ts`)

O Cloudflare Workers corta requisições longas, então nenhuma importação histórica cabe numa chamada só. `rodarComOrcamento` é a mecânica que resolve isso, sem nenhuma fonte dentro: não sabe o que é uma página, não faz HTTP, não conhece tabela.

```ts
const r = await rodarComOrcamento({
  chave: varreduraKey,
  checkpoint, // Checkpoint: ler/salvar sobre a tabela da fonte
  orcamentoMs, // ~180s (teto do Worker é maior; a folga é do upsert)
  maxPassos, // trava contra laço infinito
  paralelismo, // opcional, padrão 1: passos ao mesmo tempo
  passo: async (cursor) => ({ processados, fim, erros, interromper, custo }),
});
// r: { concluido, proximoCursor, processados, totalAcumulado,
//      cursorInicial, cursorFinal, orcamentoEsgotado, custoEsgotado,
//      custoGasto, semRetomada, erros, parada, duracaoMs }
```

Contrato do passo:

| Retorno             | Efeito                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `fim: true`         | origem acabou → varredura marcada completa                                                 |
| `interromper: true` | para **sem** marcar completa e **sem** avançar o cursor: a próxima rodada refaz este passo |
| nenhum dos dois     | cursor avança, checkpoint gravado, segue                                                   |

`parada` é o motivo de parada que o Histórico grava em `motivo_parada`: `fim`, `tempo`, `subrequisicoes`, `erro` (passo interrompido) ou `passos` (`maxPassos`). `duracaoMs` é medida pelo relógio do runner; `montarLinhaRodada` prefere a `duracaoMs` de quem chama, quando vem, e grava também `itens_processados` (`cursorFinal − cursorInicial + 1`) e `subrequisicoes` (`custoGasto`, que inclui o custo dos passos interrompidos e dos descartados). `inserirImportacoes` tolera o banco sem as colunas novas: tira só o grupo que falta (gatilho e execução, ou métricas) e grava de novo.

O checkpoint é gravado **depois de cada passo**, antes do seguinte: se o Worker for morto no meio, o trabalho feito não se perde. Como os upserts são idempotentes por chave natural, refazer um passo que gravou metade das linhas não duplica nada.

`Checkpoint.salvar` **não lança** — migração pendente não pode derrubar importação em curso. Devolvendo `persistido: false`, a rodada segue e só perde a retomada; o runner acrescenta `AVISO_SEM_RETOMADA` aos erros.

Varredura já marcada completa **recomeça do zero** — é o que permite reimportar uma janela depois de uma limpeza.

**Chamável sem browser.** Hoje quem repete as rodadas até `concluido` é o painel admin. O contrato de saída (`concluido` + `proximoCursor`) foi desenhado para um agendador do lado do servidor repetir igual, sem mudança no runner: todo o estado vive no banco, nada em memória entre rodadas.

Implementações de `Checkpoint`: `checkpointImportacao` (`checkpoint.server.ts`, sobre a tabela genérica `importacao_varredura` — use esta em fonte nova) e `checkpointCguVarredura` (`real/sweep.ts`, sobre `cgu_varredura`). O TSE ainda tem laço próprio sobre `tse_varredura`.

### Orçamento de custo

O Workers também limita **subrequisições por invocação**, e tempo sozinho não protege disso: um passo pode ser rápido e caro. O passo reporta `custo` (páginas buscadas + lotes gravados) e a rodada para ao atingir `orcamentoCusto`. Como o custo só se conhece ao fim do passo, o teto é conferido depois dele — a rodada pode ultrapassar pelo custo do último passo, então deixe folga.

Em uso hoje: despesas de gabinete (`ceap-varredura.ts`) processam **um parlamentar por passo**; PNCP e Transferegov (`janela-varredura.ts`) processam **uma página por passo**; proposições da Câmara processam **uma proposição por passo** — cada uma custa ~4 subrequisições (detalhe, autores e duas gravações), então uma página inteira da listagem estouraria o limite do Worker numa chamada só. Todas com orçamento de 150s por rodada e teto de 1.000 subrequisições (`JANELA_TETO_SUBREQUISICOES` e `CEAP_TETO_SUBREQUISICOES`), menos as votações da Câmara, que rodam passos em paralelo ([abaixo](#paralelismo)), com 6.000.

O teto de 1.000 vem do plano pago do Workers: 10.000 subrequisições por invocação, 5 min de CPU declarados no `wrangler.jsonc` (espera de rede não conta como CPU; a varredura do SICONFI indica que o teto efetivo é menor — [teto do SICONFI](#teto-do-siconfi)) e passos em sequência, sem disputar as 6 conexões simultâneas. O teto antigo, de 45, era a conta do plano Free (50) e parava a rodada muito antes do relógio: um mês de votações da Câmara (mais de 420, a ~4 subrequisições cada, ~0,4 s por votação) levava mais de 30 rodadas de ~8 s. Com 1.000, a rodada cabe ~250 votações em ~100 s e o mês termina em 2 rodadas; na maioria das fontes quem para a rodada passa a ser o relógio. A folga até 10.000 cobre o que o custo não conta — o checkpoint de cada passo, QA, a linha do Histórico, as gravações por consulta do SICONFI —, mesmo que isso triplique o custo real.

Exceção: **PNCP e Transferegov** ficam em 45 (`JANELA_TETO_SUBREQUISICOES_COM_COTA`). As duas origens limitam requisições por minuto (30 por minuto no PNCP; a chave do Portal, no Transferegov), e a rodada curta com a pausa entre rodadas é o que as mantém abaixo da cota. Um teto alto faria uma rodada de 150 s disparar centenas de GETs seguidos.

### Paralelismo

`paralelismo` N > 1 roda até N passos ao mesmo tempo, nas posições logo depois do cursor. Os resultados são **confirmados na ordem do cursor**, como se tivessem rodado em sequência:

- o cursor só avança sobre o prefixo contíguo de passos concluídos; um passo à frente que terminou antes espera a vez, e o checkpoint é gravado uma vez por grupo confirmado;
- se um passo interrompe (falha passageira), os que estão à frente dele são descartados: não contam em `processados` nem no acumulado, e a próxima rodada recomeça do passo que falhou. Os upserts idempotentes absorvem o trabalho refeito;
- o tempo e o custo são conferidos antes de cada lançamento; esgotados, a rodada para de lançar e confirma o que estava em voo;
- ao parar (fim, interrupção, erro lançado), a rodada espera os passos em voo terminarem antes de gravar o checkpoint final e a linha do Histórico — nenhuma escrita fica pendente depois dela.

Estado compartilhado entre passos precisa aguentar chamadas simultâneas: a lista das votações da Câmara é guardada como promessa, para os primeiros passos esperarem a mesma busca.

| Fonte                            | N   | Constante                     | Por quê                                                                                                                                        |
| -------------------------------- | --- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Votações da Câmara               | 5   | `PARALELISMO_VOTACOES_CAMARA` | ~0,55 s por votação em sequência, quase tudo espera pela API, sem cota publicada; 6 conexões do Worker menos uma para o checkpoint             |
| SICONFI em lote                  | 3   | `PARALELISMO_SICONFI`         | a espera é pela origem e pelos lotes; a rodada é limitada pelo teto de custo próprio (`SICONFI_TETO_CUSTO_RODADA`), [abaixo](#teto-do-siconfi) |
| PNCP, Transferegov, Portal (CGU) | 1   | —                             | cota por minuto da origem: a rodada curta e a pausa entre rodadas são o ritmo                                                                  |
| Demais                           | 1   | —                             | sem medida de ganho; entram quando a rodada real mostrar que param pelo tempo                                                                  |

Com N passos juntos, a rodada faz N vezes mais trabalho em 150 s, e o teto de 1.000 subrequisições pararia a rodada antes do relógio. As votações da Câmara usam `JANELA_TETO_SUBREQUISICOES_PARALELO` = 6.000: ~1.350 votações × 3 a 4 subrequisições contadas ≈ 5.000; a folga até 10.000 cobre o que o custo não conta (checkpoint por grupo confirmado, QA e a linha do Histórico). O orçamento de tempo continua em 150 s.

**Medida (origem simulada, `camara/votacoes-rodadas.test.ts`):** maio de 2026, 1.535 votações, 0,55 s e 3–4 subrequisições por votação. Em sequência: 6 rodadas (a primeira com 273 votações, parada pelo tempo). Com N = 5: 2 rodadas (1.365 + 170).

**Votos de votação não nominal: sem corte.** Conferido na API em 2026-09-26: a listagem `/votacoes` não traz indicação de votação nominal, e no detalhe os campos `descUltimaAberturaVotacao`/`dataHoraUltimaAberturaVotacao` não são confiáveis — numa amostra de 60 votações de maio de 2026, a `2233802-416` (Plenário) veio com os dois nulos e 474 votos em `/votos`. Sem garantia na origem, a chamada de votos continua sendo feita para toda votação.

Chaves de varredura: `chaveVarreduraCeap` (casa, ano, mês) e `chaveVarreduraJanela` (fonte, janela de datas, filtros). A chave precisa distinguir tudo que muda o conjunto de resultados — duas importações da mesma janela com filtros diferentes são varreduras diferentes, e se compartilhassem chave a segunda retomaria do cursor da primeira e pularia páginas que nunca leu.

#### Teto do SICONFI

A varredura do SICONFI com 3 consultas juntas usa um teto de custo próprio, `SICONFI_TETO_CUSTO_RODADA` = 400 (GETs + lotes de 200 linhas), e não o de 6.000. Uma consulta de UF grava milhares de linhas, e o que cresce com elas é a **CPU da invocação** (ler o JSON, montar as linhas, serializar os lotes) — o relógio de 150 s deixava de ser o limite.

Com 3 juntas e o teto de 6.000, as duas primeiras rodadas em produção (UFs 2023 e capitais 2025) gravaram 145 mil e 140 mil linhas em ~2 minutos (~850 de custo contado) e o Worker morreu no meio: a rota respondeu `502 Internal server error`, que não sai do nosso código (os erros da rodada saem em 500 com o erro no corpo), e a linha da rodada não foi gravada. A rodada anterior, também com 3 juntas, terminou com 96 mil linhas (575 de custo); as de ~70 mil, em sequência (~400), sempre terminaram. Medido com a origem e o banco simulados (respostas reais do Tesouro, até 1,75 MB e 4.760 linhas por consulta): a memória viva fica em poucos MB por consulta, sem acúmulo entre consultas, e a CPU fica em ~0,1–0,15 ms por linha — 140 mil linhas dão 14–21 s numa máquina de desenvolvimento, perto dos 30 s padrão do Workers numa máquina mais lenta. A causa provável é o teto de CPU efetivo da plataforma ser menor que o declarado no `wrangler.jsonc`; não há log do Worker que confirme.

O teto de 400 para de lançar e deixa as consultas em voo terminarem (no máximo ~75 a mais): ~80 mil linhas por rodada em ~60 s, dentro do que já terminou em produção. Se a rota voltar a responder 502 no SICONFI, volte `PARALELISMO_SICONFI` para 1 e confira nos logs do Worker se a invocação acabou por CPU ou por memória.

## Contrato de fonte

Toda fonte importável cumpre o mesmo contrato — é o que garante a mesma experiência de operação independente da API de origem. Checklist (o detalhe de cada item está nas seções acima):

1. **HTTP com a política única de retry** (`fetchComRetry`), mensagens com prefixo `TRANSIENT:` nos erros passageiros.
2. **Retomada com orçamento** (`rodarComOrcamento`): orçamento de tempo E de subrequisições; checkpoint em `importacao_varredura` (fontes novas) e retorno com `varredura: { haMais, ... }` para o painel repetir rodadas.
3. **Linha de rodada no Histórico, gravada pelo servidor** (`registrarRodadaImportacao`): contagens, ano/mês para a matriz de cobertura, motivo de parada, duração — **inclusive consulta vazia** (linha com zero = "consultado, sem dados").
4. **Sinais de qualidade** pós-upsert (`flagQA` com regras da fonte, catalogadas em `sinais-catalogo.ts`).
5. **Entrada em `FONTES_LIMPEZA`** — o teste-guarda `limpeza.test.ts` quebra se uma tabela `*_cache` nova ficar sem controle de limpeza.
6. **Janela em `janelas.ts`** com justificativa em comentário.

Exceções vigentes à paridade: SICONFI dispensa retomada (chamadas curtas) e grava o próprio histórico; sinais de proposições/votações/matérias estão no backlog (trabalho editorial, não de infraestrutura).

## Upsert

- Lotes de 200 registros via `supabaseAdmin.from('<cache>').upsert(rows)`.
- Conflito por `id` (chave primária natural quando existe; senão construída como `<entidade>-<numero>`).

## Sanitização (`src/lib/sanitize.ts`)

- `sanitizarTextoPublico(s)` aplica todas as máscaras; idempotente.
- `contemPII(s)` — usado em badges visuais e em `ressanitizarContratosCache`.
- Telefone só é mascarado quando o padrão é inequívoco (DDD entre parênteses ou +55) para evitar falsos positivos com matrículas.

## Janelas

`ANO_INICIO_POR_FONTE` em `src/lib/data/janelas.ts`. `dentroDaJanela(fonte, ano, mes)` rejeita anos anteriores ao início e meses no futuro.

**Fonte anual usa `dentroDaJanelaAnual(fonte, ano)`, não a mensal.** Hoje só o TSE, cujo arquivo é por ano. Representar o ano como `(ano, mês 12)` parece inofensivo e não é: faz o ano CORRENTE ser recusado até dezembro. Foi o que aconteceu com 2026 em agosto — a eleição em curso já tinha candidatos e bens no CDN e a importação recusava o ano inteiro, alegando "fora da janela (2014 em diante)". Ambas as funções aceitam `hoje` como último parâmetro, para os testes não dependerem do relógio (`janelas.test.ts`).
