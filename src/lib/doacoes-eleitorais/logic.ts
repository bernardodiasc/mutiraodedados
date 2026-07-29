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

export type DoacaoItem = {
  sq: string;
  ano: number;
  valor: number;
  data: string | null;
  candidato: string;
  detalhe: string; // "Deputado Federal · AC · MDB"
};

type DoacaoServidor = {
  sq_candidato: string;
  ano_eleicao: number;
  valor: number;
  data: string | null;
  candidato_nome: string | null;
  candidato_partido: string | null;
  candidato_uf: string | null;
  candidato_cargo: string | null;
};

export function paraItens(rows: DoacaoServidor[]): DoacaoItem[] {
  return rows.map((r) => ({
    sq: r.sq_candidato,
    ano: r.ano_eleicao,
    valor: r.valor,
    data: r.data,
    candidato: r.candidato_nome ?? `candidatura ${r.sq_candidato}`,
    detalhe: [r.candidato_cargo, r.candidato_uf, r.candidato_partido].filter(Boolean).join(" · "),
  }));
}
