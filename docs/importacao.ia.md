# Pipeline de importação — referência técnica

## `portal-client.ts` (compartilhado CGU + Transferegov)

- `portalGet(path, params)` — wrapper com retry/backoff, autenticação via header `chave-api-dados`.
- `portalGetComTexto(path, params)` — como `portalGet`, mas devolve também o body bruto (antes do `JSON.parse`), usado para auditar valores com ponto-fixo no JSON.
- `parseValorPortal(v)` — normaliza valores: number (direto), string pt-BR "1.234,56", decimal "1234.56", milhar "60.000", null/undefined → 0.

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
  passo: async (cursor) => ({ processados, fim, erros, interromper }),
});
// r: { concluido, proximoCursor, processados, totalAcumulado,
//      cursorInicial, cursorFinal, orcamentoEsgotado, semRetomada, erros }
```

Contrato do passo:

| Retorno             | Efeito                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `fim: true`         | origem acabou → varredura marcada completa                                                 |
| `interromper: true` | para **sem** marcar completa e **sem** avançar o cursor: a próxima rodada refaz este passo |
| nenhum dos dois     | cursor avança, checkpoint gravado, segue                                                   |

O checkpoint é gravado **depois de cada passo**, antes do seguinte: se o Worker for morto no meio, o trabalho feito não se perde. Como os upserts são idempotentes por chave natural, refazer um passo que gravou metade das linhas não duplica nada.

`Checkpoint.salvar` **não lança** — migração pendente não pode derrubar importação em curso. Devolvendo `persistido: false`, a rodada segue e só perde a retomada; o runner acrescenta `AVISO_SEM_RETOMADA` aos erros.

Varredura já marcada completa **recomeça do zero** — é o que permite reimportar uma janela depois de uma limpeza.

**Chamável sem browser.** Hoje quem repete as rodadas até `concluido` é o painel admin. O contrato de saída (`concluido` + `proximoCursor`) foi desenhado para um agendador do lado do servidor repetir igual, sem mudança no runner: todo o estado vive no banco, nada em memória entre rodadas.

Implementações de `Checkpoint`: `checkpointImportacao` (`checkpoint.server.ts`, sobre a tabela genérica `importacao_varredura` — use esta em fonte nova) e `checkpointCguVarredura` (`real/sweep.ts`, sobre `cgu_varredura`). O TSE ainda tem laço próprio sobre `tse_varredura`.

### Orçamento de custo

O Workers também limita **subrequisições por invocação**, e tempo sozinho não protege disso: um passo pode ser rápido e caro. O passo reporta `custo` (páginas buscadas + lotes gravados) e a rodada para ao atingir `orcamentoCusto`. Como o custo só se conhece ao fim do passo, o teto é conferido depois dele — a rodada pode ultrapassar pelo custo do último passo, então deixe folga.

Em uso hoje: despesas de gabinete (`ceap-varredura.ts`) processam **um parlamentar por passo**; PNCP e Transferegov (`janela-varredura.ts`) processam **uma página por passo**; proposições da Câmara processam **uma proposição por passo** — cada uma custa ~4 subrequisições (detalhe, autores e duas gravações), então uma página inteira da listagem estouraria o limite do Worker numa chamada só. Todas com teto de 45 subrequisições e orçamento de 150s por rodada.

Chaves de varredura: `chaveVarreduraCeap` (casa, ano, mês) e `chaveVarreduraJanela` (fonte, janela de datas, filtros). A chave precisa distinguir tudo que muda o conjunto de resultados — duas importações da mesma janela com filtros diferentes são varreduras diferentes, e se compartilhassem chave a segunda retomaria do cursor da primeira e pularia páginas que nunca leu.

## Contrato de fonte

Toda fonte importável cumpre o mesmo contrato — é o que garante a mesma experiência de operação independente da API de origem. Checklist (o detalhe de cada item está nas seções acima):

1. **HTTP com a política única de retry** (`fetchComRetry`), mensagens com prefixo `TRANSIENT:` nos erros passageiros.
2. **Retomada com orçamento** (`rodarComOrcamento`): orçamento de tempo E de subrequisições; checkpoint em `importacao_varredura` (fontes novas) e retorno com `varredura: { haMais, ... }` para o painel repetir rodadas.
3. **Linha de rodada no Histórico, gravada pelo servidor** (`registrarRodadaImportacao`): contagens, ano/mês para a matriz de cobertura, motivo de parada, duração — **inclusive consulta vazia** (linha com zero = "consultado, sem dados").
4. **Sinais de qualidade** pós-upsert (`flagQA` com regras da fonte, catalogadas em `sinais-catalogo.ts`).
5. **Entrada em `FONTES_LIMPEZA`** — o teste-guarda `limpeza.test.ts` quebra se uma tabela `*_cache` nova ficar sem controle de limpeza.
6. **Janela em `janelas.ts`** com justificativa em comentário.

Matriz de paridade auditada e exceções justificadas: [`docs/planos/v0.6.0-padronizacao-importacao.md`](./planos/v0.6.0-padronizacao-importacao.md). Exceções vigentes: votações da Câmara importam por item pelo cliente (linha de rodada por votação seria ruído — o log de job pelo cliente permanece só para ela); SICONFI dispensa retomada (chamadas curtas) e grava o próprio histórico; sinais de proposições/votações/matérias estão no backlog (trabalho editorial, não de infraestrutura).

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
