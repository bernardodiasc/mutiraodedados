/**
 * Linha de rodada do Histórico — a parte pura.
 *
 * Toda importação retomável termina gravando UMA linha em `importacoes`
 * descrevendo a rodada: quanto importou, por que parou e quanto tempo levou.
 * Este módulo monta essa linha a partir do resultado do runner; a gravação
 * fica em `historico.server.ts`.
 *
 * A linha cumpre dois papéis ao mesmo tempo:
 * - **Histórico** (`/admin/dados`): a rodada aparece com o motivo de parada.
 * - **Cobertura**: a RPC `cobertura_tentativas` agrega por (fonte, escopo,
 *   ano, mês) — por isso `ano`/`mes` precisam vir preenchidos. Uma rodada que
 *   consultou e voltou vazia grava a linha com zero: é o marcador de
 *   "consultado, sem dados" que evita reconsultar um mês legitimamente vazio.
 */
import type { MotivoParada, ResultadoRodada } from "@/lib/data/runner";
import { classificarRodada, type ResultadoClassificado } from "@/lib/data/resultado-rodada";

/**
 * Quem disparou a rodada: o admin no painel, a fila da automação (cron) ou a
 * ferramenta de linha de comando pelo modo nomeado de `/api/cron-importar`.
 */
export type Gatilho = "painel" | "cron" | "ferramenta";

/**
 * Gatilho de quem não declarou o seu: com operador logado é o painel; sem
 * operador, a fila da automação. A ferramenta sempre declara o dela.
 */
export function gatilhoPadrao(userId: string | null): Gatilho {
  return userId ? "painel" : "cron";
}

/** O que a ferramenta informa ao núcleo sobre a rodada que pediu. */
export type OrigemRodada = { gatilho?: Gatilho; execucaoId?: string };

export type LinhaRodada = {
  fonte: string;
  orgao_cod: string | null;
  escopo: string;
  ano: number | null;
  mes: number | null;
  total_bruto: number;
  importados: number;
  erros: string[];
  endpoint: string;
  user_id: string | null;
  gatilho: Gatilho;
  /** Execução (uma janela pedida pela ferramenta) a que a rodada pertence. */
  execucao_id: string | null;
  /** Como ler o `importados` desta rodada (ver `resultado-rodada.ts`). */
  resultado: ResultadoClassificado;
  /**
   * Métricas de desempenho da rodada, em colunas próprias para o Histórico
   * somar e comparar. Linhas anteriores a elas ficam nulas.
   */
  duracao_ms: number;
  /** Passos confirmados na rodada (votações, consultas, páginas…). */
  itens_processados: number;
  /** Subrequisições que os passos reportaram (`custoGasto` do runner). */
  subrequisicoes: number;
  motivo_parada: MotivoParada;
};

/** Por que a rodada parou, na ordem de precedência do runner. */
export function motivoParada(rodada: ResultadoRodada): string {
  if (rodada.concluido) return "completa";
  if (rodada.orcamentoEsgotado) return "parcial: tempo da rodada esgotado";
  if (rodada.custoEsgotado) return "parcial: teto de subrequisições da rodada";
  return "parcial";
}

/**
 * `ano`/`mes` de uma janela de datas ISO, quando ela cabe num único mês —
 * o caso dos jobs mensais. Janela maior que um mês devolve nulos: a linha
 * vale para o Histórico, mas não ancora célula da matriz de cobertura.
 */
export function anoMesDaJanela(
  dataInicial: string,
  dataFinal: string,
): { ano: number | null; mes: number | null } {
  const ini = dataInicial.match(/^(\d{4})-(\d{2})/);
  const fim = dataFinal.match(/^(\d{4})-(\d{2})/);
  if (!ini || !fim) return { ano: null, mes: null };
  if (ini[1] !== fim[1] || ini[2] !== fim[2]) return { ano: null, mes: null };
  return { ano: Number(ini[1]), mes: Number(ini[2]) };
}

/**
 * O período é recente demais para a origem já ter publicado?
 *
 * Órgãos publicam com atraso — dois meses de folga cobrem o caso comum. Um
 * zero num período assim é espera, não ausência: vale reconsultar depois.
 * Um zero em período antigo é ausência de verdade.
 */
export function ehPeriodoRecente(
  ano: number | null | undefined,
  mes: number | null | undefined,
  hoje: Date = new Date(),
  mesesDeFolga = 2,
): boolean {
  if (ano == null) return false;
  const mesRef = mes ?? 12;
  const limite = new Date(hoje.getFullYear(), hoje.getMonth() - mesesDeFolga, 1);
  return new Date(ano, mesRef - 1, 1) >= limite;
}

export type MetaRodada = {
  fonte: string;
  /** Rótulo do escopo na matriz de cobertura (código do órgão, sigla…). "" quando não há. */
  escopo?: string;
  orgaoCod?: string | null;
  ano?: number | null;
  mes?: number | null;
  /** Descrição da consulta na API externa, para auditoria. */
  endpoint: string;
  /** O que a varredura percorre (ex.: "deputados", "páginas", "matérias"). */
  unidade: string;
  /** null = execução do agendador (sem sessão) — a coluna no banco é anulável. */
  userId: string | null;
  /** Omitido: deduzido de `userId` (ver {@link gatilhoPadrao}). */
  gatilho?: Gatilho;
  execucaoId?: string | null;
  duracaoMs?: number;
  /** Período anterior ao início da fonte (`janelas.ts`) — zero é esperado. */
  foraDaJanela?: boolean;
  /** Período recente demais para a origem já ter publicado — zero é espera. */
  periodoRecente?: boolean;
};

export function montarLinhaRodada(meta: MetaRodada, rodada: ResultadoRodada): LinhaRodada {
  const duracaoMs = meta.duracaoMs ?? rodada.duracaoMs;
  const duracao = meta.duracaoMs != null ? `, ${Math.round(meta.duracaoMs / 1000)}s` : "";
  const passos =
    rodada.cursorFinal >= rodada.cursorInicial
      ? `${meta.unidade} ${rodada.cursorInicial}–${rodada.cursorFinal}`
      : `${meta.unidade}: nenhum passo executado`;
  return {
    fonte: meta.fonte,
    orgao_cod: meta.orgaoCod ?? null,
    escopo: meta.escopo ?? "",
    ano: meta.ano ?? null,
    mes: meta.mes ?? null,
    total_bruto: rodada.processados,
    importados: rodada.processados,
    erros: rodada.erros,
    endpoint: `${meta.endpoint} (rodada: ${passos} — ${motivoParada(rodada)}${duracao})`,
    user_id: meta.userId,
    gatilho: meta.gatilho ?? gatilhoPadrao(meta.userId),
    execucao_id: meta.execucaoId ?? null,
    resultado: classificarRodada(rodada, {
      foraDaJanela: meta.foraDaJanela,
      // Calculado aqui de propósito: exigir que cada fonte lembre de passar
      // isso seria uma chance a mais de classificar errado em silêncio.
      periodoRecente: meta.periodoRecente ?? ehPeriodoRecente(meta.ano, meta.mes),
    }),
    duracao_ms: Math.round(duracaoMs),
    itens_processados: Math.max(0, rodada.cursorFinal - rodada.cursorInicial + 1),
    subrequisicoes: rodada.custoGasto,
    motivo_parada: rodada.parada,
  };
}
