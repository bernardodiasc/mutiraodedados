export type Estado = "carregando" | "erro" | "vazio" | "pronto";

export function deriveEstado(input: {
  carregando: boolean;
  temErro: boolean;
  temDados: boolean;
}): Estado {
  if (input.carregando) return "carregando";
  if (input.temErro) return "erro";
  if (input.temDados) return "pronto";
  return "vazio";
}

export type CandidatoItem = {
  sq: string;
  ano: number;
  nomeUrna: string;
  nomeCompleto: string;
  cargo: string;
  uf: string;
  partido: string;
  numero: string;
  situacao: string;
  bensTotal: number | null;
};

type RowServidor = {
  sq_candidato: string;
  ano_eleicao: number;
  nome_urna: string | null;
  nome_completo: string | null;
  cargo_nome: string | null;
  uf: string | null;
  partido_sigla: string | null;
  numero_candidato: string | null;
  situacao_totalizacao: string | null;
  bens_total_declarado: number | null;
};

export function paraItens(rows: RowServidor[]): CandidatoItem[] {
  return rows.map((r) => ({
    sq: r.sq_candidato,
    ano: r.ano_eleicao,
    nomeUrna: r.nome_urna ?? r.nome_completo ?? r.sq_candidato,
    nomeCompleto: r.nome_completo ?? "",
    cargo: r.cargo_nome ?? "",
    uf: r.uf ?? "",
    partido: r.partido_sigla ?? "",
    numero: r.numero_candidato ?? "",
    situacao: r.situacao_totalizacao ?? "",
    bensTotal: r.bens_total_declarado,
  }));
}

/** Badge da situação: eleito ganha destaque; suplente/não eleito, neutro. */
export function classeSituacao(situacao: string): "eleito" | "nao-eleito" | "outro" {
  const s = situacao.toLowerCase();
  if (s.startsWith("eleito")) return "eleito";
  if (s.includes("não eleito") || s.includes("nao eleito") || s.startsWith("suplente"))
    return "nao-eleito";
  return "outro";
}
