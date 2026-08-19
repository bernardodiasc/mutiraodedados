/**
 * Lógica pura compartilhada das páginas de cota parlamentar (CEAP / CEAPS).
 *
 * Deputados e senadores expõem despesas com o mesmo shape estrutural, então
 * filtro por ano/mês, agregação e exportação CSV ficam aqui e são reusados nas
 * duas rotas de detalhe. Sem dependência de React ou de servidor.
 */

/** Campos mínimos de uma despesa de cota, comuns a CEAP (Câmara) e CEAPS (Senado). */
export type DespesaCota = {
  ano: number;
  mes: number;
  dataDocumento?: string | null;
  tipoDespesa: string;
  valorDocumento?: number;
  valorLiquido: number;
  fornecedorNome?: string | null;
  fornecedorCnpj?: string | null;
  urlDocumento?: string | null;
};

export function anosDisponiveis(despesas: ReadonlyArray<{ ano: number }>): number[] {
  return [...new Set(despesas.map((d) => d.ano))].sort((a, b) => b - a);
}

export function mesesDisponiveis(
  despesas: ReadonlyArray<{ ano: number; mes: number }>,
  ano: number | null,
): number[] {
  const base = ano == null ? despesas : despesas.filter((d) => d.ano === ano);
  return [...new Set(base.map((d) => d.mes))].sort((a, b) => a - b);
}

/** Genérica: preserva o tipo de item (CEAP ou CEAPS) para as duas rotas. */
export function filtrarDespesas<T extends { ano: number; mes: number }>(
  despesas: T[],
  ano: number | null,
  mes: number | null,
): T[] {
  return despesas.filter((d) => (ano == null || d.ano === ano) && (mes == null || d.mes === mes));
}

export type AgregadoCota = {
  totalGeral: number;
  porTipo: { tipo: string; total: number }[];
  porFornecedor: { nome: string; cnpj: string | null; total: number; count: number }[];
  porMes: { mes: string; total: number }[];
};

/** Reproduz a agregação do servidor (mesmos sorts e top-30 de fornecedores), mas
 * sobre um subconjunto já filtrado no cliente. */
export function agregarDespesas(despesas: DespesaCota[]): AgregadoCota {
  const porTipo = new Map<string, number>();
  const porFornecedor = new Map<
    string,
    { nome: string; cnpj: string | null; total: number; count: number }
  >();
  const porMes = new Map<string, number>();
  let totalGeral = 0;
  for (const d of despesas) {
    totalGeral += d.valorLiquido;
    porTipo.set(d.tipoDespesa, (porTipo.get(d.tipoDespesa) ?? 0) + d.valorLiquido);
    const key = d.fornecedorCnpj ?? d.fornecedorNome ?? "(sem fornecedor)";
    const cur = porFornecedor.get(key) ?? {
      nome: d.fornecedorNome ?? key,
      cnpj: d.fornecedorCnpj ?? null,
      total: 0,
      count: 0,
    };
    cur.total += d.valorLiquido;
    cur.count += 1;
    porFornecedor.set(key, cur);
    const mkey = `${d.ano}-${String(d.mes).padStart(2, "0")}`;
    porMes.set(mkey, (porMes.get(mkey) ?? 0) + d.valorLiquido);
  }
  return {
    totalGeral,
    porTipo: [...porTipo.entries()]
      .map(([tipo, total]) => ({ tipo, total }))
      .sort((a, b) => b.total - a.total),
    porFornecedor: [...porFornecedor.values()].sort((a, b) => b.total - a.total).slice(0, 30),
    porMes: [...porMes.entries()]
      .map(([mes, total]) => ({ mes, total }))
      .sort((a, b) => a.mes.localeCompare(b.mes)),
  };
}

export type LinhaDespesaCsv = {
  data: string;
  ano: number;
  mes: number;
  tipo: string;
  fornecedor: string;
  cnpj_cpf: string;
  valor_documento: number | string;
  valor_liquido: number;
  documento_url: string;
};

export const CSV_COLUNAS_DESPESA: (keyof LinhaDespesaCsv)[] = [
  "data",
  "ano",
  "mes",
  "tipo",
  "fornecedor",
  "cnpj_cpf",
  "valor_documento",
  "valor_liquido",
  "documento_url",
];

export function despesasParaCsv(despesas: DespesaCota[]): LinhaDespesaCsv[] {
  return despesas.map((d) => ({
    data: d.dataDocumento ?? "",
    ano: d.ano,
    mes: d.mes,
    tipo: d.tipoDespesa,
    fornecedor: d.fornecedorNome ?? "",
    cnpj_cpf: d.fornecedorCnpj ?? "",
    valor_documento: d.valorDocumento ?? "",
    valor_liquido: d.valorLiquido,
    documento_url: d.urlDocumento ?? "",
  }));
}
