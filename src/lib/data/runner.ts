/**
 * Runner retomável: orçamento de tempo, checkpoint e retomada.
 *
 * O Cloudflare Workers corta requisições longas, então nenhuma importação
 * histórica cabe numa chamada só. O padrão que resolve isso já existia no
 * projeto em duas cópias — a varredura da CGU (`cgu_varredura`) e a do TSE
 * (`tse_varredura`) — e é este: cada rodada trabalha até esgotar um orçamento
 * de tempo, grava onde parou e devolve o cursor seguinte; quem chamou repete
 * até `concluido`.
 *
 * Este módulo é essa mecânica sem nenhuma fonte dentro. Ele não sabe o que é
 * uma página, não faz HTTP e não conhece tabela: recebe um passo e um
 * {@link Checkpoint} e cuida do resto.
 *
 * **Chamável sem browser.** Hoje quem repete as rodadas é o painel admin, no
 * navegador. O contrato de saída ({@link ResultadoRodada}: `concluido` mais
 * `proximoCursor`) foi desenhado para que um agendador do lado do servidor
 * possa repeti-las igual, sem nenhuma mudança aqui — todo o estado vive no
 * banco, nada em memória entre rodadas.
 */

/**
 * Emitido quando o checkpoint não pôde ser gravado (migração pendente).
 * Exportado para quem chama poder trocá-lo por uma mensagem própria em vez
 * de duplicar o aviso.
 */
export const AVISO_SEM_RETOMADA =
  "checkpoint indisponível (migração pendente): esta rodada NÃO retoma — a próxima recomeça do início.";

export type EstadoCheckpoint = {
  /** Onde a última rodada parou. `0` = nada processado ainda. */
  cursor: number;
  /** Acumulado de todas as rodadas desta chave. */
  total: number;
  completa: boolean;
};

/**
 * Persistência do progresso. Cada fonte implementa sobre a sua tabela — a CGU
 * sobre `cgu_varredura`, o TSE sobre `tse_varredura`.
 *
 * `salvar` **não lança**: migração pendente não pode derrubar uma importação
 * em curso. Quando `persistido` é `false`, a rodada segue e só perde a
 * capacidade de retomar — quem chamou avisa.
 */
export type Checkpoint = {
  ler: (chave: string) => Promise<EstadoCheckpoint | null>;
  salvar: (
    chave: string,
    estado: EstadoCheckpoint,
  ) => Promise<{ persistido: boolean; erro: string | null }>;
};

export type ResultadoPasso = {
  processados: number;
  /**
   * Quanto o passo consumiu do orçamento de custo — na prática, quantas
   * subrequisições fez. O Workers limita subrequisições por invocação, e só
   * tempo não protege disso: um passo pode ser rápido e caro.
   */
  custo?: number;
  /** `true` quando a origem acabou — não há próxima página. */
  fim: boolean;
  erros?: string[];
  /**
   * Interrompe a rodada sem marcar a varredura como completa. Para falha que
   * não é fim de dados (rede fora, erro de banco): a próxima rodada retoma do
   * mesmo cursor em vez de considerar tudo importado.
   */
  interromper?: boolean;
};

export type ResultadoRodada = {
  /** Varredura inteira terminada. `false` = chame de novo com `proximoCursor`. */
  concluido: boolean;
  /** Cursor da próxima rodada, ou `null` quando concluída. */
  proximoCursor: number | null;
  /** Processados nesta rodada. */
  processados: number;
  /** Processados somando todas as rodadas desta chave. */
  totalAcumulado: number;
  cursorInicial: number;
  cursorFinal: number;
  orcamentoEsgotado: boolean;
  /** Parou por ter atingido o teto de custo (subrequisições). */
  custoEsgotado: boolean;
  /** Custo acumulado nesta rodada. */
  custoGasto: number;
  /** Checkpoint indisponível (migração pendente) — sem retomada. */
  semRetomada: boolean;
  erros: string[];
};

export type OpcoesRodada = {
  chave: string;
  checkpoint: Checkpoint;
  /** Teto de tempo da rodada. Confira-o ANTES de cada passo, nunca no meio. */
  orcamentoMs: number;
  /**
   * Teto de custo acumulado (subrequisições). Conferido DEPOIS de cada passo,
   * porque o custo só se conhece ao fim dele — a rodada pode ultrapassar pelo
   * custo do último passo, então deixe folga.
   */
  orcamentoCusto?: number;
  /** Teto de passos, como trava contra laço infinito se a origem nunca acabar. */
  maxPassos: number;
  /** Executa um passo. O cursor é 1-based: a primeira chamada recebe 1. */
  passo: (cursor: number) => Promise<ResultadoPasso>;
  /** Injetável para teste. */
  agora?: () => number;
};

/**
 * Roda passos até acabar a origem, esgotar o orçamento ou bater `maxPassos`.
 *
 * O checkpoint é gravado **depois de cada passo**, antes do seguinte: se o
 * Worker for morto no meio, o trabalho já feito não se perde.
 */
export async function rodarComOrcamento(opts: OpcoesRodada): Promise<ResultadoRodada> {
  const { chave, checkpoint, orcamentoMs, orcamentoCusto, maxPassos, passo } = opts;
  const agora = opts.agora ?? Date.now;

  const erros: string[] = [];
  let semRetomada = false;

  // Retoma de onde parou. Varredura já completa recomeça do zero — é o que
  // permite reimportar uma janela depois de uma limpeza.
  let cursor = 0;
  let totalAcumulado = 0;
  const anterior = await checkpoint.ler(chave);
  if (anterior && !anterior.completa && anterior.cursor > 0) {
    cursor = anterior.cursor;
    totalAcumulado = anterior.total;
  }

  const cursorInicial = cursor + 1;
  const inicio = agora();
  let processados = 0;
  let completa = false;
  let orcamentoEsgotado = false;
  let custoEsgotado = false;
  let custoGasto = 0;

  for (let n = 0; n < maxPassos; n++) {
    if (agora() - inicio > orcamentoMs) {
      orcamentoEsgotado = true;
      break;
    }

    const r = await passo(cursor + 1);
    processados += r.processados;
    totalAcumulado += r.processados;
    if (r.erros?.length) erros.push(...r.erros);

    // Passo interrompido não avança o cursor: a próxima rodada refaz este
    // mesmo passo. Os upserts são idempotentes por chave natural, então
    // refazer um passo que gravou metade das linhas não duplica nada.
    if (r.interromper) break;

    // Passo que ANUNCIA o fim sem processar nada não ocupou posição nenhuma:
    // é a sondagem que descobre o fim (o alvo 11 de uma varredura de 10, a
    // página vazia depois da última cheia). Contá-lo fazia a tela dizer
    // "11 de 10 consultas" e o Histórico registrar um passo que não existiu.
    // Já um passo que processou E terminou (última página parcial) ocupou.
    const sondagemDoFim = r.fim && r.processados === 0;
    if (!sondagemDoFim) cursor += 1;

    const gravacao = await checkpoint.salvar(chave, {
      cursor,
      total: totalAcumulado,
      completa: false,
    });
    if (!gravacao.persistido) semRetomada = true;
    if (gravacao.erro) erros.push(gravacao.erro);

    if (r.fim) {
      completa = true;
      break;
    }

    custoGasto += r.custo ?? 0;
    if (orcamentoCusto != null && custoGasto >= orcamentoCusto) {
      custoEsgotado = true;
      break;
    }
  }

  const gravacaoFinal = await checkpoint.salvar(chave, {
    cursor,
    total: totalAcumulado,
    completa,
  });
  if (!gravacaoFinal.persistido) semRetomada = true;
  if (gravacaoFinal.erro) erros.push(gravacaoFinal.erro);

  if (semRetomada && !completa) erros.push(AVISO_SEM_RETOMADA);

  return {
    concluido: completa,
    proximoCursor: completa ? null : cursor + 1,
    processados,
    totalAcumulado,
    cursorInicial,
    cursorFinal: cursor,
    orcamentoEsgotado,
    custoEsgotado,
    custoGasto,
    semRetomada,
    erros,
  };
}
