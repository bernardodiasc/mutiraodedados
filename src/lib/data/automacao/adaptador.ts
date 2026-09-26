/**
 * O contrato de um adaptador do modo nomeado (`nomeado.ts`) e as peças que os
 * adaptadores de fonte dividem.
 *
 * Cada tarefa nomeada tem um adaptador, num módulo próprio por fonte
 * (`adaptadores/`): o schema de parâmetros (o MESMO da casca autenticada,
 * exportado de lá), a checagem da janela natural da fonte, onde fica a
 * varredura, como contar a célula da cobertura, o total da origem e a
 * tradução do retorno do núcleo para a resposta única. `nomeado.ts` só
 * registra os adaptadores, uma linha por tarefa.
 */
import { z } from "zod";
import type { Checkpoint } from "@/lib/data/runner";
import { anoMesDaJanela, type OrigemRodada } from "@/lib/data/historico-rodada";
import { dentroDaJanela, dentroDaJanelaAnual, type FonteJanela } from "@/lib/data/janelas";
import type { JanelaPendente } from "@/lib/data/automacao/conferencia";

export type Varredura = {
  haMais: boolean;
  /** Onde a varredura da janela parou; `null` na fonte de chamada única. */
  cursor: number | null;
  totalAcumulado: number;
  orcamentoEsgotado: boolean;
  custoEsgotado: boolean;
};

export type TotalDaOrigem = { total: number; descartados: number };

export type ResultadoAdaptado = {
  importados: Record<string, number>;
  erros: string[];
  varredura: Varredura;
  /** Total da origem e descartados, quando a origem informa (ver `conferencia.ts`). */
  origem: TotalDaOrigem | null;
  /** A chamada que busca o total na origem falhou: a conferência fica inconclusiva. */
  falhaAoConsultarOrigem?: string | null;
  /** Findings novos da rodada, quando a tarefa gera sinais (os cruzamentos). */
  findingsNovos?: number | null;
};

export type RecusaNomeada = { recusa: string };

export type Adaptador<P> = {
  schema: z.ZodType<P>;
  /**
   * A fonte no Histórico (`importacoes.fonte`). Função quando depende da
   * janela: o TSE grava `tse_<tipo>` — a tarefa então traz a sua consulta de
   * {@link Adaptador.pendentes}.
   */
  fonte: string | ((p: P) => string);
  /**
   * Chave da varredura da janela, para não refazer janela completa. Omitida
   * na fonte de chamada única (cadastro de deputados, relatório do SICONFI),
   * que sempre roda — a importação é idempotente.
   */
  chave?: (p: P) => string;
  /** Onde a varredura guarda o progresso; o padrão é `importacao_varredura`. */
  checkpoint?: Checkpoint;
  /**
   * Janela natural: um mês (padrão), um ano inteiro (`mes = 1` na célula) ou
   * o cadastro (sem janela no tempo). Decide as janelas da consulta de
   * pendentes e quando a janela conta como recente.
   */
  granularidade?: "mes" | "ano" | "cadastro";
  /**
   * Linha da matriz de cobertura (órgão, ente) — o `importacoes.escopo` das
   * rodadas. Omitido: a fonte tem linha única e as conferências não filtram
   * por escopo.
   */
  escopo?: (p: P) => string;
  /**
   * Os parâmetros que a consulta de pendentes precisa para achar a linha
   * (ex.: o órgão). Só quando há {@link Adaptador.escopo}.
   */
  recorte?: z.ZodType<unknown>;
  /**
   * A célula da janela na cobertura (o mês; o ano com `mes` 1; o período do
   * SICONFI). `null` no cadastro, que não tem célula no tempo.
   */
  janela: (p: P) => { ano: number; mes: number } | null;
  /**
   * A janela ainda pode crescer na origem (divergência vira inconclusiva).
   * Omitido, decide a {@link Adaptador.granularidade}.
   */
  recente?: (p: P) => boolean;
  /** Registros no cache dentro da célula; omitido no cadastro. */
  contarNaCelula?: (p: P) => Promise<number>;
  /** Total da origem numa chamada só, para conferir sem reimportar. */
  totalDaOrigem?: (p: P) => Promise<TotalDaOrigem | null>;
  /** A consulta à origem, para a linha de conferência no Histórico. */
  descricao: (p: P) => string;
  /**
   * Conferência mínima (`conferencia.ts`): só "terminou" e "log limpo" — a
   * tarefa cruza o que já está no banco, não importa de uma origem.
   */
  conferenciaMinima?: boolean;
  /** Unidades de `importados`, zeradas quando a rodada não roda. */
  unidades: string[];
  rodada: (p: P, origem: OrigemRodada) => Promise<ResultadoAdaptado>;
  /**
   * As janelas pendentes da tarefa, quando a granularidade não basta. Omitida,
   * decide a {@link Adaptador.granularidade}. Recebe os `params` da consulta —
   * o SICONFI precisa do ente e do relatório.
   */
  pendentes?: (params: unknown) => Promise<JanelaPendente[] | RecusaNomeada>;
};

/** Guarda o adaptador tipado pelo seu schema num registro heterogêneo. */
export const adaptador = <P>(a: Adaptador<P>) => a as unknown as Adaptador<unknown>;

/**
 * Janela natural das fontes mensais: um mês do calendário, dentro da janela
 * de disponibilidade da fonte. Janela maior é recusada — quem chama fatia.
 * `campos` são os nomes das datas no schema da fonte.
 */
export function janelaDeUmMes<T>(
  schema: z.ZodType<T>,
  fonte: FonteJanela,
  campos: [string, string] = ["dataInicio", "dataFim"],
): z.ZodType<T> {
  return schema.superRefine((p, ctx) => {
    const datas = p as Record<string, string>;
    const [ini, fim] = [datas[campos[0]], datas[campos[1]]];
    if (ini > fim) {
      ctx.addIssue({ code: "custom", message: `${campos[0]} depois de ${campos[1]}` });
      return;
    }
    if (ini.slice(0, 7) !== fim.slice(0, 7)) {
      ctx.addIssue({
        code: "custom",
        message: "janela maior que um mês — fatie o intervalo em meses",
      });
      return;
    }
    const [ano, mes] = ini.split("-").map(Number);
    if (!dentroDaJanela(fonte, ano, mes)) foraDaDisponibilidade(ctx, fonte);
  }) as z.ZodType<T>;
}

/** Janela `{ano, mes}` (as cotas parlamentares) dentro da disponibilidade. */
export function mesDentroDaJanela<T extends { ano: number; mes: number }>(
  schema: z.ZodType<T>,
  fonte: FonteJanela,
): z.ZodType<T> {
  return schema.superRefine((p, ctx) => {
    if (!dentroDaJanela(fonte, p.ano, p.mes)) foraDaDisponibilidade(ctx, fonte);
  }) as z.ZodType<T>;
}

/** Janela de um ano (matérias, proposições) dentro da disponibilidade. */
export function anoDentroDaJanela<T extends { ano: number }>(
  schema: z.ZodType<T>,
  fonte: FonteJanela,
): z.ZodType<T> {
  return schema.superRefine((p, ctx) => {
    if (!dentroDaJanelaAnual(fonte, p.ano)) foraDaDisponibilidade(ctx, fonte);
  }) as z.ZodType<T>;
}

function foraDaDisponibilidade(ctx: z.RefinementCtx, fonte: FonteJanela) {
  ctx.addIssue({
    code: "custom",
    message: `fora da janela de disponibilidade da fonte (${fonte})`,
  });
}

/** O mês de uma janela de datas, já validada como um mês só. */
export function mesDasDatas(dataInicio: string, dataFim: string): { ano: number; mes: number } {
  const { ano, mes } = anoMesDaJanela(dataInicio, dataFim);
  return { ano: ano ?? 0, mes: mes ?? 0 };
}

/** Primeiro e último dia de um mês, em ISO. */
export function limitesDoMes(ano: number, mes: number): { de: string; ate: string } {
  const mm = String(mes).padStart(2, "0");
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return { de: `${ano}-${mm}-01`, ate: `${ano}-${mm}-${ultimo}` };
}
