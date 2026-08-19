/**
 * Interface comum de "anomalia" — defeito ou sinal que precisa de
 * investigação e, no limite, denúncia oficial.
 *
 * Hoje só `qa_findings` produz AnomaliaInput. /admin/marcacoes e
 * /admin/sinais, quando entrarem em escopo, escrevem adaptadores próprios
 * e reusam <AnomaliaInvestigacao /> + <ReporteOficialModal />.
 */

export type AnomaliaSeveridade = "info" | "aviso" | "critico";

export type AnomaliaStatus =
  | "aberto"
  | "confirmado"
  | "reportado"
  | "corrigido_origem"
  | "corrigido_automaticamente"
  | "falso_positivo"
  | "wontfix";

export type AnomaliaOrigem = "qa" | "marcacao_cidada" | "sinal";

/** Tipo do sinal (taxonomia normativa em docs/qualidade-dados.md). */
export type AnomaliaTipoSinal = "qualidade" | "lacuna" | "investigativo";

export type AnomaliaEntidade = {
  tipo: string;
  id: string;
  url_interno?: string;
  url_oficial?: string;
  rotulo?: string;
};

export type AnomaliaTrilhaItem = {
  em: string;
  tipo: string;
  descricao: string;
};

export type AnomaliaReporte = {
  canal?: string | null;
  protocolo?: string | null;
  reportado_em?: string | null;
};

export type AnomaliaInput = {
  id: string;
  origem: AnomaliaOrigem;
  fonte: string;
  severidade: AnomaliaSeveridade;
  status: AnomaliaStatus;
  /** Tipo do sinal persistido em qa_findings.tipo (default 'qualidade'). */
  tipo_sinal?: AnomaliaTipoSinal;
  regra: string;
  resumo: string;
  entidade: AnomaliaEntidade;
  comparacao?: {
    armazenado?: number | null;
    esperado?: number | null;
    armazenadoLabel?: string;
    esperadoLabel?: string;
    observacao?: string;
  };
  trilha: AnomaliaTrilhaItem[];
  reporte?: AnomaliaReporte;
  detectado_em: string;
  revalidado_em?: string | null;
};

export const SEVERIDADE_LABEL: Record<AnomaliaSeveridade, string> = {
  info: "Info",
  aviso: "Aviso",
  critico: "Crítico",
};

export const STATUS_LABEL: Record<AnomaliaStatus, string> = {
  aberto: "Aberto",
  confirmado: "Confirmado",
  reportado: "Reportado ao órgão",
  corrigido_origem: "Corrigido na origem",
  corrigido_automaticamente: "Corrigido automaticamente",
  falso_positivo: "Falso positivo",
  wontfix: "Sem ação",
};

export const ORIGEM_LABEL: Record<AnomaliaOrigem, string> = {
  qa: "Auditoria automática",
  marcacao_cidada: "Marcação cidadã",
  sinal: "Sinal investigativo",
};

export const TIPO_SINAL_LABEL: Record<AnomaliaTipoSinal, string> = {
  qualidade: "Alerta de qualidade",
  lacuna: "Lacuna",
  investigativo: "Sinal investigativo",
};