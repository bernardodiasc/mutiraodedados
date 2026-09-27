/**
 * Estado de cobertura de uma janela (fonte × recorte × período), derivado na
 * leitura do que a importação já grava — sem tabela própria de estado. Módulo
 * puro: quem lê o banco monta o `ResumoJanela` e chama `estadoDaJanela`.
 *
 * Os estados e a precedência foram decididos com o modelo de cobertura
 * estruturada da v0.16.0:
 *
 *   erro → indisponível → processando → parcial → vazio confirmado →
 *   concluído no universo enumerado → concluído sem total da origem →
 *   não consultado
 *
 * "Concluído sem total da origem" fica à parte porque a origem não informou
 * quantos registros existem: a janela terminou e foi conferida, mas não há
 * denominador — ele nunca vira percentual. Janela fora da disponibilidade da
 * fonte (`fora_da_janela`) nem entra no universo: quem enumera as janelas já a
 * deixa de fora.
 */
import type { ResultadoClassificado } from "@/lib/data/resultado-rodada";

export const ESTADOS_COBERTURA = [
  "erro",
  "indisponivel",
  "processando",
  "parcial",
  "vazio_confirmado",
  "concluido",
  "concluido_sem_total",
  "nao_consultado",
] as const;

export type EstadoCobertura = (typeof ESTADOS_COBERTURA)[number];

export const ROTULO_ESTADO_COBERTURA: Record<EstadoCobertura, string> = {
  erro: "Erro",
  indisponivel: "Indisponível",
  processando: "Processando",
  parcial: "Parcial",
  vazio_confirmado: "Vazio confirmado",
  concluido: "Concluído",
  concluido_sem_total: "Concluído, sem total da origem",
  nao_consultado: "Não consultado",
};

export const EXPLICACAO_ESTADO_COBERTURA: Record<EstadoCobertura, string> = {
  erro: "A importação falhou do nosso lado ou a conferência reprovou. Precisa de correção.",
  indisponivel:
    "A origem estava fora do ar, ainda não publicou o período, ou a conferência não conseguiu concluir. Vale tentar de novo.",
  processando: "A importação deste período está em andamento.",
  parcial: "Há dados, mas a importação parou no meio ou ainda não foi conferida contra a origem.",
  vazio_confirmado: "A origem foi consultada e confirmou que não há registros no período.",
  concluido: "Importado e conferido: a quantidade bate com o total informado pela origem.",
  concluido_sem_total:
    "Importado e conferido, mas a origem não informa quantos registros existem — não há como dizer se é tudo.",
  nao_consultado: "O período ainda não foi consultado.",
};

/** Estados que contam como janela concluída no resumo "X de Y". */
const CONCLUIDOS: ReadonlySet<EstadoCobertura> = new Set([
  "concluido",
  "concluido_sem_total",
  "vazio_confirmado",
]);

/** Uma varredura parada no meio conta como em andamento por este tempo. */
const PROCESSANDO_MS = 24 * 3_600_000;

export type ResumoJanela = {
  /** A célula da janela tem registros no cache. */
  temRegistros: boolean;
  /** A rodada mais recente da janela no Histórico. */
  ultimaRodada: {
    resultado: ResultadoClassificado | null;
    /** fim, tempo, subrequisicoes, erro ou passos; null em linhas antigas. */
    motivoParada: string | null;
    em: string;
  } | null;
  /** A conferência mais recente da janela. */
  conferencia: {
    estado: "aprovada" | "reprovada" | "inconclusiva";
    /** `checagens.contagem.situacao` da conferência. */
    contagem: string | null;
    em: string;
  } | null;
};

export function estadoDaJanela(j: ResumoJanela, agora: Date = new Date()): EstadoCobertura {
  const r = j.ultimaRodada;
  // A conferência só vale para a execução que ela conferiu: uma rodada mais
  // nova é uma execução ainda não conferida.
  const c = j.conferencia && (!r || j.conferencia.em >= r.em) ? j.conferencia : null;

  if (r?.resultado === "erro_nosso" || c?.estado === "reprovada") return "erro";
  if (
    r?.resultado === "erro_origem" ||
    r?.resultado === "nao_publicado" ||
    c?.estado === "inconclusiva"
  )
    return "indisponivel";
  if (
    !c &&
    r?.motivoParada &&
    r.motivoParada !== "fim" &&
    agora.getTime() - new Date(r.em).getTime() < PROCESSANDO_MS
  )
    return "processando";
  if (c?.estado === "aprovada") {
    if (!j.temRegistros) return "vazio_confirmado";
    return c.contagem === "confere" ? "concluido" : "concluido_sem_total";
  }
  if (r || j.temRegistros) return "parcial";
  return "nao_consultado";
}

export type CelulaEstado = { escopo: string; ano: number; mes: number; estado: EstadoCobertura };

/** Estados de uma fonte do catálogo, como a `/cobertura` os recebe. */
export type EstadosDaFonte = {
  /** O universo inteiro foi enumerado; false = só as janelas já consultadas. */
  universoEnumerado: boolean;
  resumo: ResumoEstados;
  celulas: CelulaEstado[];
  ultimaImportacaoValida: string | null;
  desatualizada: boolean;
};

export type ResumoEstados = {
  total: number;
  concluidas: number;
  porEstado: Record<EstadoCobertura, number>;
};

/** Contagem das janelas do universo por estado, e quantas estão concluídas. */
export function resumirJanelas(estados: readonly EstadoCobertura[]): ResumoEstados {
  const porEstado = Object.fromEntries(ESTADOS_COBERTURA.map((e) => [e, 0])) as Record<
    EstadoCobertura,
    number
  >;
  for (const e of estados) porEstado[e]++;
  return {
    total: estados.length,
    concluidas: estados.filter((e) => CONCLUIDOS.has(e)).length,
    porEstado,
  };
}

/**
 * Data da última importação válida de uma tarefa: o horário da conferência
 * aprovada mais recente, em qualquer janela. Base da marca "coleção
 * desatualizada" da busca.
 */
export function ultimaImportacaoValida(
  conferencias: readonly { estado: string; em: string }[],
): string | null {
  let ultima: string | null = null;
  for (const c of conferencias) {
    if (c.estado === "aprovada" && (!ultima || c.em > ultima)) ultima = c.em;
  }
  return ultima;
}

/**
 * Um estado para várias janelas numa célula só — a matriz do admin mostra as
 * fontes anuais com uma coluna por ano, mas matérias e proposições têm uma
 * janela por sigla. Vale o pior estado que pede atenção; concluídas junto com
 * não consultadas dão parcial; entre concluídas, a mais fraca (sem total da
 * origem, depois concluída, depois vazio confirmado).
 */
export function estadoAgregado(estados: readonly EstadoCobertura[]): EstadoCobertura {
  for (const e of ["erro", "indisponivel", "processando", "parcial"] as const) {
    if (estados.includes(e)) return e;
  }
  if (estados.length === 0 || estados.every((e) => e === "nao_consultado")) {
    return "nao_consultado";
  }
  if (estados.includes("nao_consultado")) return "parcial";
  if (estados.includes("concluido_sem_total")) return "concluido_sem_total";
  if (estados.includes("concluido")) return "concluido";
  return "vazio_confirmado";
}
