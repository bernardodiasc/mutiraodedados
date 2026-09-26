/**
 * Filtros do Histórico de importações em `/admin/dados`.
 *
 * Os filtros vivem nos search params da rota: um link com filtros abre o
 * Histórico já filtrado — é assim que o relato de uma importação reprovada
 * aponta para as rodadas que falharam. O servidor lê os mesmos filtros com a
 * mesma função e os aplica na consulta, então a paginação vale sobre o recorte.
 */
import { FONTE_LABEL, FONTES_COM_HISTORICO } from "@/lib/data/fonte-rotulos";
import { RESULTADOS, type ResultadoClassificado } from "@/lib/data/resultado-rodada";
import type { Gatilho } from "@/lib/data/historico-rodada";
import { MOTIVOS_PARADA, type MotivoParada } from "@/lib/data/runner";

export const GATILHOS = ["painel", "cron", "ferramenta"] as const satisfies readonly Gatilho[];

/** Vereditos da conferência de uma janela (`importacoes.conferencia->>estado`). */
export const ESTADOS_CONFERENCIA = ["aprovada", "inconclusiva", "reprovada"] as const;
export type EstadoConferencia = (typeof ESTADOS_CONFERENCIA)[number];

export type FiltrosHistorico = {
  fonte?: string;
  gatilho?: Gatilho;
  resultado?: ResultadoClassificado;
  conferencia?: EstadoConferencia;
  /** Início do período de `consultado_em`, `AAAA-MM-DD`, inclusivo. */
  de?: string;
  /** Fim do período de `consultado_em`, `AAAA-MM-DD`, inclusivo. */
  ate?: string;
  /** `execucao_id`: as rodadas de uma janela pedida pela ferramenta. */
  execucao?: string;
  /** `motivo_parada`: por que a rodada parou (tempo, subrequisições…). */
  parada?: MotivoParada;
};

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function dataValida(v: unknown): string | undefined {
  if (typeof v !== "string" || !DATA_RE.test(v)) return undefined;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : undefined;
}

function entre<T extends string>(v: unknown, validos: readonly T[]): T | undefined {
  return typeof v === "string" && (validos as readonly string[]).includes(v) ? (v as T) : undefined;
}

function uuidValido(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const u = v.trim().toLowerCase();
  return UUID_RE.test(u) ? u : undefined;
}

/**
 * Lê os filtros vindos de fora (URL ou payload da server function). Valor
 * desconhecido vira ausente: um link velho ou digitado errado abre o
 * Histórico com menos filtros, nunca uma tela quebrada.
 */
export function lerFiltrosHistorico(s: Record<string, unknown>): FiltrosHistorico {
  let de = dataValida(s.de);
  let ate = dataValida(s.ate);
  // Período digitado ao contrário ainda diz qual intervalo a pessoa quer.
  if (de && ate && de > ate) [de, ate] = [ate, de];
  const f: FiltrosHistorico = {
    fonte: entre(s.fonte, FONTES_COM_HISTORICO),
    gatilho: entre(s.gatilho, GATILHOS),
    resultado: entre(s.resultado, RESULTADOS),
    conferencia: entre(s.conferencia, ESTADOS_CONFERENCIA),
    de,
    ate,
    execucao: uuidValido(s.execucao),
    parada: entre(s.parada, MOTIVOS_PARADA),
  };
  return Object.fromEntries(
    Object.entries(f).filter(([, v]) => v !== undefined),
  ) as FiltrosHistorico;
}

export function temFiltroHistorico(f: FiltrosHistorico): boolean {
  return Object.keys(f).length > 0;
}

/** Aplica a mudança de um ou mais filtros; valor vazio tira o filtro. */
export function mudarFiltroHistorico(
  atual: FiltrosHistorico,
  patch: Partial<Record<keyof FiltrosHistorico, string>>,
): FiltrosHistorico {
  return lerFiltrosHistorico({ ...atual, ...patch });
}

/** Opções do filtro de fonte, em ordem alfabética do rótulo. */
export const OPCOES_FONTE_HISTORICO: ReadonlyArray<{ valor: string; rotulo: string }> =
  FONTES_COM_HISTORICO.map((id) => ({ valor: id, rotulo: FONTE_LABEL[id] ?? id })).sort((a, b) =>
    a.rotulo.localeCompare(b.rotulo, "pt-BR"),
  );

/** Veredito da conferência como a tela o usa. */
export type ConferenciaResumo = { estado: EstadoConferencia; motivo: string };

/**
 * Lê `importacoes.conferencia`. Só `estado` e `motivo` interessam aqui; o
 * resto do objeto é detalhe de quem grava. Nulo — linhas antigas e rodadas
 * intermediárias de uma janela — ou formato inesperado é "sem conferência".
 */
export function lerConferencia(v: unknown): ConferenciaResumo | null {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const { estado, motivo } = v as Record<string, unknown>;
  const e = entre(estado, ESTADOS_CONFERENCIA);
  if (!e) return null;
  return { estado: e, motivo: typeof motivo === "string" ? motivo : "" };
}

/** Motivo numa linha só, cortado numa palavra para caber na coluna. */
export function resumirMotivo(motivo: string, max = 90): string {
  const limpo = motivo.replace(/\s+/g, " ").trim();
  if (limpo.length <= max) return limpo;
  const corte = limpo.slice(0, max - 1);
  const espaco = corte.lastIndexOf(" ");
  return `${(espaco > 0 ? corte.slice(0, espaco) : corte).trimEnd()}…`;
}

export const ROTULO_GATILHO: Record<Gatilho, string> = {
  painel: "Painel",
  cron: "Automação",
  ferramenta: "Ferramenta",
};

export const EXPLICACAO_GATILHO: Record<Gatilho, string> = {
  painel: "Disparada por quem administra, nesta tela.",
  cron: "Disparada pela fila da automação, sem operador.",
  ferramenta: "Disparada pela ferramenta de linha de comando (bun run importar).",
};

export const ROTULO_CONFERENCIA: Record<EstadoConferencia, string> = {
  aprovada: "Aprovada",
  inconclusiva: "Inconclusiva",
  reprovada: "Reprovada",
};

/**
 * O pedaço do query builder do Supabase que os filtros usam. Genérico no
 * próprio tipo para devolver a consulta encadeável sem perder o tipo dela.
 */
export interface ConsultaFiltravel<Q> {
  eq(coluna: string, valor: string): Q;
  gte(coluna: string, valor: string): Q;
  lt(coluna: string, valor: string): Q;
}

/**
 * Fuso das datas do filtro: o horário de Brasília não tem horário de verão
 * desde 2019, então o deslocamento é fixo.
 */
const FUSO_BRASILIA = "-03:00";

function diaSeguinte(data: string): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Restringe a consulta de `importacoes` aos filtros. O período vale pelo dia
 * de Brasília, com o fim incluído: "até 26/09" pega as rodadas da noite de 26.
 */
export function aplicarFiltrosHistorico<Q extends ConsultaFiltravel<Q>>(
  consulta: Q,
  f: FiltrosHistorico,
): Q {
  let q = consulta;
  if (f.fonte) q = q.eq("fonte", f.fonte);
  if (f.gatilho) q = q.eq("gatilho", f.gatilho);
  if (f.resultado) q = q.eq("resultado", f.resultado);
  if (f.conferencia) q = q.eq("conferencia->>estado", f.conferencia);
  if (f.execucao) q = q.eq("execucao_id", f.execucao);
  if (f.parada) q = q.eq("motivo_parada", f.parada);
  const { de, ate } = bordasDoPeriodo(f);
  if (de) q = q.gte("consultado_em", de);
  if (ate) q = q.lt("consultado_em", ate);
  return q;
}

/** Início (inclusivo) e fim (exclusivo) do período, no dia de Brasília. */
function bordasDoPeriodo(f: FiltrosHistorico): { de: string | null; ate: string | null } {
  return {
    de: f.de ? `${f.de}T00:00:00${FUSO_BRASILIA}` : null,
    ate: f.ate ? `${diaSeguinte(f.ate)}T00:00:00${FUSO_BRASILIA}` : null,
  };
}

export const ROTULO_PARADA: Record<MotivoParada, string> = {
  fim: "Fim da origem",
  tempo: "Tempo",
  subrequisicoes: "Subrequisições",
  erro: "Erro",
  passos: "Limite de passos",
};

export const EXPLICACAO_PARADA: Record<MotivoParada, string> = {
  fim: "A origem acabou: a janela terminou nesta rodada.",
  tempo: "O orçamento de tempo da rodada (150 s) acabou; a próxima continua de onde parou.",
  subrequisicoes: "A rodada atingiu o teto de subrequisições; a próxima continua de onde parou.",
  erro: "Uma falha interrompeu a rodada; a próxima refaz o item que falhou.",
  passos: "A rodada atingiu o limite de páginas ou passos pedido.",
};

/**
 * Parâmetros da função `resumo_historico_importacoes`: o mesmo recorte que
 * `aplicarFiltrosHistorico` aplica à listagem, com as mesmas bordas de data.
 */
export function parametrosResumoHistorico(f: FiltrosHistorico): Record<string, string> {
  const { de, ate } = bordasDoPeriodo(f);
  const p: Record<string, string | null | undefined> = {
    p_fonte: f.fonte,
    p_gatilho: f.gatilho,
    p_resultado: f.resultado,
    p_conferencia: f.conferencia,
    p_execucao: f.execucao,
    p_motivo_parada: f.parada,
    p_de: de,
    p_ate: ate,
  };
  // Filtro ausente não vai: o parâmetro fica no padrão (NULL = sem filtro).
  return Object.fromEntries(Object.entries(p).filter(([, v]) => v != null)) as Record<
    string,
    string
  >;
}

/** Soma e média das métricas das rodadas do recorte. */
export type ResumoHistorico = {
  /** Linhas do recorte, com e sem métricas. */
  rodadas: number;
  /** Linhas com métricas: as médias são sobre elas. */
  comMetricas: number;
  duracaoTotalMs: number;
  duracaoMediaMs: number | null;
  itensTotal: number;
  itensMedia: number | null;
  subrequisicoesTotal: number;
  subrequisicoesMedia: number | null;
  itensPorSegundo: number | null;
  porMotivo: Partial<Record<MotivoParada, number>>;
};

/** Duração legível: "12,3 s", "2 min 29 s", "1 h 2 min"; "—" sem medida. */
export function formatarDuracao(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 60_000) return `${(ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`;
  const s = Math.round(ms / 1000);
  if (s < 3600) return `${Math.floor(s / 60)} min ${s % 60} s`;
  return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
}

/** Itens por segundo de uma rodada; `null` sem os dois números. */
export function itensPorSegundo(itens: number | null, duracaoMs: number | null): number | null {
  if (itens == null || duracaoMs == null || duracaoMs <= 0) return null;
  return itens / (duracaoMs / 1000);
}

const numero = (v: unknown): number => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : 0;
  return Number.isFinite(n) ? n : 0;
};

/**
 * Lê a linha devolvida por `resumo_historico_importacoes`. O PostgREST manda
 * `bigint` como número ou texto, conforme o tamanho; os dois servem.
 */
export function lerResumoHistorico(linha: Record<string, unknown>): ResumoHistorico {
  const comMetricas = numero(linha.rodadas_com_metricas);
  const duracaoTotalMs = numero(linha.duracao_ms_soma);
  const itensTotal = numero(linha.itens_soma);
  const subrequisicoesTotal = numero(linha.subrequisicoes_soma);
  const media = (total: number) => (comMetricas > 0 ? total / comMetricas : null);
  const porMotivo: Partial<Record<MotivoParada, number>> = {};
  const brutos = linha.por_motivo;
  if (brutos && typeof brutos === "object" && !Array.isArray(brutos)) {
    for (const [k, v] of Object.entries(brutos)) {
      const motivo = entre(k, MOTIVOS_PARADA);
      if (motivo) porMotivo[motivo] = numero(v);
    }
  }
  return {
    rodadas: numero(linha.rodadas),
    comMetricas,
    duracaoTotalMs,
    duracaoMediaMs: media(duracaoTotalMs),
    itensTotal,
    itensMedia: media(itensTotal),
    subrequisicoesTotal,
    subrequisicoesMedia: media(subrequisicoesTotal),
    itensPorSegundo: comMetricas > 0 ? itensPorSegundo(itensTotal, duracaoTotalMs) : null,
    porMotivo,
  };
}
