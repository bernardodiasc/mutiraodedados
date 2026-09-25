import { TSE_ANOS_ELEICAO, TSE_UFS } from "@/lib/data/tse/client-ckan";

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

export type CargoResumo = {
  cargoCod: number;
  cargoNome: string;
  total: number;
  eleitos: number;
  ufs: number;
};

export type AnoResumo = {
  ano: number;
  totalCandidatos: number;
  cargos: CargoResumo[];
};

type LinhaResumo = {
  ano_eleicao: number;
  cargo_cod: number;
  cargo_nome: string;
  total: number;
  eleitos: number;
  ufs: number;
};

/** Agrupa o agregado (ano, cargo) do servidor em blocos por ano, mais recente primeiro. */
export function agruparPorAno(rows: LinhaResumo[]): AnoResumo[] {
  const porAno = new Map<number, AnoResumo>();
  for (const r of rows) {
    const bloco = porAno.get(r.ano_eleicao) ?? {
      ano: r.ano_eleicao,
      totalCandidatos: 0,
      cargos: [],
    };
    bloco.totalCandidatos += r.total;
    bloco.cargos.push({
      cargoCod: r.cargo_cod,
      cargoNome: capitalizarCargo(r.cargo_nome),
      total: r.total,
      eleitos: r.eleitos,
      ufs: r.ufs,
    });
    porAno.set(r.ano_eleicao, bloco);
  }
  return [...porAno.values()]
    .map((b) => ({ ...b, cargos: b.cargos.sort((a, c) => c.total - a.total) }))
    .sort((a, b) => b.ano - a.ano);
}

/** "DEPUTADO ESTADUAL" → "Deputado estadual" (os CSVs vêm em caixa alta). */
export function capitalizarCargo(nome: string): string {
  const s = nome.trim().toLowerCase();
  if (!s) return nome;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Anos múltiplos de 4 são municipais (2016, 2020, 2024); os demais, gerais. */
export function rotuloEleicao(ano: number): string {
  return ano % 4 === 0 ? `Eleições Municipais ${ano}` : `Eleições Gerais ${ano}`;
}

/** H1 do recorte /eleicoes/$ano/$uf — derivado só dos params. */
export function h1DaEleicaoUf(ano: string, uf: string): string {
  return `${rotuloEleicao(Number(ano))} — ${uf.toUpperCase()}`;
}

/** H1 da página /eleicoes/partidos/$sigla — derivado só do param. */
export function h1DoPartido(sigla: string): string {
  return `${sigla.toUpperCase()} nas urnas`;
}

/** O par (ano, UF) da URL é um recorte que existe: ano de eleição da série e UF (ou BR) conhecida. */
export function recorteValido(ano: string, uf: string): boolean {
  return (
    (TSE_ANOS_ELEICAO as readonly number[]).includes(Number(ano)) &&
    (TSE_UFS as readonly string[]).includes(uf.toUpperCase())
  );
}
