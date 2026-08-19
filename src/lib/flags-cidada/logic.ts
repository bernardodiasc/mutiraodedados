export type FlagTipo = "suspeita" | "confirmar" | "contexto";

export const TIPOS: ReadonlyArray<{ v: FlagTipo; label: string }> = [
  { v: "suspeita", label: "Suspeita" },
  { v: "confirmar", label: "Confirmar regular" },
  { v: "contexto", label: "Adicionar contexto" },
];

/**
 * Valida envio de marcação cidadã.
 * - "confirmar" pode ser enviado sem comentário.
 * - Demais tipos exigem comentário não-vazio.
 */
export function validateSubmit(
  tipo: string,
  comentario: string,
): { ok: true } | { ok: false; erro: string } {
  if (!comentario.trim() && tipo !== "confirmar") {
    return { ok: false, erro: "Escreva um comentário" };
  }
  return { ok: true };
}

/** Agrega valores de votos por flag_id (soma simples). */
export function aggregateVotes(
  votos: Array<{ flag_id: string; valor: number }>,
): Record<string, number> {
  const agg: Record<string, number> = {};
  for (const v of votos) agg[v.flag_id] = (agg[v.flag_id] ?? 0) + v.valor;
  return agg;
}

/** Formata data ISO em dd/mm/aaaa pt-BR. */
export function formatDataCurta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}
