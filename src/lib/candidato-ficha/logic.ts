export type Estado = "carregando" | "erro" | "nao-encontrado" | "pronto";

export function deriveEstado(input: {
  carregando: boolean;
  temErro: boolean;
  encontrado: boolean;
}): Estado {
  if (input.carregando) return "carregando";
  if (input.temErro) return "erro";
  if (!input.encontrado) return "nao-encontrado";
  return "pronto";
}

export type BemDeclarado = {
  ordem: number;
  tipo: string;
  descricao: string;
  valor: number | null;
};

export type CandidaturaAnterior = {
  ano: number;
  cargo: string;
  situacao: string;
  sq: string;
};

/** Soma dos bens listados (fallback quando o agregado ainda não foi calculado). */
export function somaBens(bens: Array<{ valor: number | null }>): number {
  return bens.reduce((s, b) => s + (b.valor ?? 0), 0);
}

/** Rótulo curto da ficha: "Senador · AC · PSB · 2022". */
export function subtituloFicha(c: {
  cargo_nome: string | null;
  uf: string | null;
  partido_sigla: string | null;
  ano_eleicao: number;
}): string {
  return [c.cargo_nome, c.uf, c.partido_sigla, String(c.ano_eleicao)].filter(Boolean).join(" · ");
}
