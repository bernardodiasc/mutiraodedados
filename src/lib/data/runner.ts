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

/**
 * Por que a rodada parou — o que o Histórico grava em `motivo_parada`:
 * - `fim`: a origem acabou, varredura completa;
 * - `tempo`: orçamento de tempo esgotado;
 * - `subrequisicoes`: teto de custo atingido;
 * - `erro`: um passo interrompeu a rodada (falha passageira, banco fora);
 * - `passos`: bateu `maxPassos` (o limite de páginas pedido, ou a trava).
 */
export const MOTIVOS_PARADA = ["fim", "tempo", "subrequisicoes", "erro", "passos"] as const;
export type MotivoParada = (typeof MOTIVOS_PARADA)[number];

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
  /**
   * Custo acumulado nesta rodada: o que os passos reportaram, inclusive os
   * interrompidos e os que rodaram em paralelo e foram descartados.
   */
  custoGasto: number;
  /** Checkpoint indisponível (migração pendente) — sem retomada. */
  semRetomada: boolean;
  erros: string[];
  parada: MotivoParada;
  /** Duração da rodada pelo relógio do runner (leitura do checkpoint ao fim). */
  duracaoMs: number;
};

export type OpcoesRodada = {
  chave: string;
  checkpoint: Checkpoint;
  /** Teto de tempo da rodada. Confira-o ANTES de cada passo, nunca no meio. */
  orcamentoMs: number;
  /**
   * Teto de custo acumulado (subrequisições). Conferido DEPOIS de cada passo,
   * porque o custo só se conhece ao fim dele — a rodada pode ultrapassar pelo
   * custo do último passo (e dos que estavam em paralelo), então deixe folga.
   */
  orcamentoCusto?: number;
  /** Teto de passos, como trava contra laço infinito se a origem nunca acabar. */
  maxPassos: number;
  /**
   * Quantos passos rodam ao mesmo tempo (padrão 1, em sequência). Só vale
   * para passos independentes entre si e com upsert idempotente: um passo à
   * frente pode ser refeito na rodada seguinte. Fontes com cota por minuto
   * (PNCP, Portal da Transparência) ficam em 1.
   */
  paralelismo?: number;
  /** Executa um passo. O cursor é 1-based: a primeira chamada recebe 1. */
  passo: (cursor: number) => Promise<ResultadoPasso>;
  /** Injetável para teste. */
  agora?: () => number;
};

type Liquidado = { ok: true; r: ResultadoPasso } | { ok: false; erro: unknown };

/**
 * Roda passos até acabar a origem, esgotar o orçamento ou bater `maxPassos`.
 *
 * O checkpoint é gravado **depois de cada passo**, antes do seguinte: se o
 * Worker for morto no meio, o trabalho já feito não se perde.
 *
 * **Paralelismo.** Com `paralelismo` N > 1, até N passos rodam ao mesmo
 * tempo, nas posições logo depois do cursor. Os resultados são confirmados
 * na ordem do cursor, como se tivessem rodado em sequência: o cursor só
 * avança sobre o prefixo contíguo de passos concluídos. Um passo à frente
 * que terminou antes espera a vez; se um anterior interromper a rodada, o
 * que está à frente é descartado (não conta nem avança) e a próxima rodada o
 * refaz — os upserts são idempotentes. Assim, um item com falha passageira
 * nunca é pulado.
 */
export async function rodarComOrcamento(opts: OpcoesRodada): Promise<ResultadoRodada> {
  const { chave, checkpoint, orcamentoMs, orcamentoCusto, maxPassos, passo } = opts;
  const agora = opts.agora ?? Date.now;
  const paralelismo = Math.max(1, Math.floor(opts.paralelismo ?? 1));

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
  let interrompida = false;
  let orcamentoEsgotado = false;
  let custoEsgotado = false;
  let custoGasto = 0;

  // Passos lançados e ainda não confirmados, por posição. `liquidados` guarda
  // os que já terminaram, para confirmar de uma vez os que chegaram antes da
  // vez deles.
  const emVoo = new Map<number, Promise<Liquidado>>();
  const liquidados = new Map<number, Liquidado>();
  let lancados = 0;
  let proximo = cursor + 1;
  let aConfirmar = cursor + 1;
  let parar = false;

  const podeLancar = () => {
    if (parar || orcamentoEsgotado || custoEsgotado) return false;
    if (lancados >= maxPassos) return false;
    if (agora() - inicio > orcamentoMs) {
      orcamentoEsgotado = true;
      return false;
    }
    return true;
  };

  const lancar = () => {
    while (proximo < aConfirmar + paralelismo && podeLancar()) {
      const posicao = proximo++;
      lancados++;
      const p: Promise<Liquidado> = Promise.resolve()
        .then(() => passo(posicao))
        .then(
          (r) => ({ ok: true as const, r }),
          (erro: unknown) => ({ ok: false as const, erro }),
        );
      void p.then((l) => liquidados.set(posicao, l));
      emVoo.set(posicao, p);
    }
  };

  // O que ficou em voo depois da parada: espera terminar (não deixa escrita
  // pendente depois da linha do Histórico), soma o custo e descarta.
  const descartarEmVoo = async () => {
    const restantes = await Promise.all(emVoo.values());
    emVoo.clear();
    for (const l of restantes) if (l.ok) custoGasto += l.r.custo ?? 0;
  };

  lancar();
  while (emVoo.size > 0 && !parar) {
    let atual: Liquidado | undefined = await emVoo.get(aConfirmar)!;
    let confirmou = false;

    // Confirma a cabeça e, em seguida, os que já terminaram atrás dela.
    while (atual && !parar) {
      emVoo.delete(aConfirmar);
      liquidados.delete(aConfirmar);
      if (!atual.ok) {
        await descartarEmVoo();
        throw atual.erro;
      }
      const r: ResultadoPasso = atual.r;
      processados += r.processados;
      totalAcumulado += r.processados;
      custoGasto += r.custo ?? 0;
      if (r.erros?.length) erros.push(...r.erros);

      // Passo interrompido não avança o cursor: a próxima rodada refaz este
      // mesmo passo. Os upserts são idempotentes por chave natural, então
      // refazer um passo que gravou metade das linhas não duplica nada.
      if (r.interromper) {
        interrompida = true;
        parar = true;
        break;
      }

      // Passo que ANUNCIA o fim sem processar nada não ocupou posição nenhuma:
      // é a sondagem que descobre o fim (o alvo 11 de uma varredura de 10, a
      // página vazia depois da última cheia). Contá-lo fazia a tela dizer
      // "11 de 10 consultas" e o Histórico registrar um passo que não existiu.
      // Já um passo que processou E terminou (última página parcial) ocupou.
      const sondagemDoFim = r.fim && r.processados === 0;
      if (!sondagemDoFim) cursor += 1;
      aConfirmar += 1;
      confirmou = true;

      if (r.fim) {
        completa = true;
        parar = true;
        break;
      }
      if (orcamentoCusto != null && custoGasto >= orcamentoCusto) custoEsgotado = true;
      atual = liquidados.get(aConfirmar);
    }

    if (confirmou) {
      const gravacao = await checkpoint.salvar(chave, {
        cursor,
        total: totalAcumulado,
        completa: false,
      });
      if (!gravacao.persistido) semRetomada = true;
      if (gravacao.erro) erros.push(gravacao.erro);
    }
    lancar();
  }
  await descartarEmVoo();

  const gravacaoFinal = await checkpoint.salvar(chave, {
    cursor,
    total: totalAcumulado,
    completa,
  });
  if (!gravacaoFinal.persistido) semRetomada = true;
  if (gravacaoFinal.erro) erros.push(gravacaoFinal.erro);

  if (semRetomada && !completa) erros.push(AVISO_SEM_RETOMADA);

  // Com passos em paralelo, o fim pode chegar depois de o relógio ou o custo
  // já terem parado os lançamentos: a varredura acabou, e é isso que conta.
  if (completa) {
    orcamentoEsgotado = false;
    custoEsgotado = false;
  }
  const parada: MotivoParada = completa
    ? "fim"
    : interrompida
      ? "erro"
      : orcamentoEsgotado
        ? "tempo"
        : custoEsgotado
          ? "subrequisicoes"
          : "passos";

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
    parada,
    duracaoMs: Math.max(0, agora() - inicio),
  };
}
