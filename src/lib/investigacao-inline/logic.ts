import type { AnomaliaSeveridade } from "@/lib/anomalia";

export type CandidatoInvestigacao = {
  fonte: string;
  entidade_tipo: string;
  entidade_id: string;
  regra: string;
  origem: "sinal" | "marcacao_cidada";
  severidade?: AnomaliaSeveridade;
  valor_armazenado?: number | null;
  valor_esperado?: number | null;
  detalhes?: Record<string, unknown>;
};

/** Constrói a chave estável de queryKey para finding por chave. */
export function chaveQueryKey(c: CandidatoInvestigacao): readonly unknown[] {
  return ["finding-chave", c.fonte, c.entidade_tipo, c.entidade_id, c.regra, c.origem] as const;
}

/** Monta o payload de promoção a partir do candidato (defaults estáveis). */
export function candidatoParaPromocao(c: CandidatoInvestigacao) {
  return {
    fonte: c.fonte,
    entidade_tipo: c.entidade_tipo,
    entidade_id: c.entidade_id,
    regra: c.regra,
    origem: c.origem,
    severidade: c.severidade ?? ("aviso" as AnomaliaSeveridade),
    valor_armazenado: c.valor_armazenado ?? null,
    valor_esperado: c.valor_esperado ?? null,
    detalhes: c.detalhes,
  };
}

/** Filtro: trata pré-promoção como "aberto". */
export function passaStatusFilter(
  statusFinding: string | null | undefined,
  statusFilter?: string,
): boolean {
  if (!statusFilter) return true;
  const atual = statusFinding ?? "aberto";
  return atual === statusFilter;
}
