import { describe, it, expect } from "vitest";
import {
  anosDisponiveis,
  mesesDisponiveis,
  filtrarDespesas,
  agregarDespesas,
  despesasParaCsv,
  type DespesaCota,
} from "./logic";

const d = (over: Partial<DespesaCota>): DespesaCota => ({
  ano: 2024,
  mes: 1,
  tipoDespesa: "COMBUSTÍVEIS",
  valorLiquido: 100,
  ...over,
});

describe("anosDisponiveis", () => {
  it("deduplica e ordena decrescente", () => {
    expect(anosDisponiveis([{ ano: 2022 }, { ano: 2024 }, { ano: 2022 }])).toEqual([2024, 2022]);
  });
});

describe("mesesDisponiveis", () => {
  it("filtra pelo ano e ordena crescente", () => {
    const base = [
      { ano: 2024, mes: 3 },
      { ano: 2024, mes: 1 },
      { ano: 2023, mes: 12 },
    ];
    expect(mesesDisponiveis(base, 2024)).toEqual([1, 3]);
  });
  it("ano null usa todos os meses", () => {
    expect(mesesDisponiveis([{ ano: 2024, mes: 2 }, { ano: 2023, mes: 5 }], null)).toEqual([2, 5]);
  });
});

describe("filtrarDespesas", () => {
  const lista = [d({ ano: 2024, mes: 1 }), d({ ano: 2024, mes: 2 }), d({ ano: 2023, mes: 1 })];
  it("ano e mês null devolvem tudo", () => {
    expect(filtrarDespesas(lista, null, null)).toHaveLength(3);
  });
  it("filtra por ano e mês", () => {
    expect(filtrarDespesas(lista, 2024, 1)).toHaveLength(1);
    expect(filtrarDespesas(lista, 2024, null)).toHaveLength(2);
  });
});

describe("agregarDespesas", () => {
  it("soma total, agrupa por tipo/fornecedor/mês", () => {
    const r = agregarDespesas([
      d({ valorLiquido: 100, tipoDespesa: "A", fornecedorCnpj: "1", fornecedorNome: "F1", mes: 1 }),
      d({ valorLiquido: 50, tipoDespesa: "A", fornecedorCnpj: "1", fornecedorNome: "F1", mes: 1 }),
      d({ valorLiquido: 30, tipoDespesa: "B", fornecedorCnpj: "2", fornecedorNome: "F2", mes: 2 }),
    ]);
    expect(r.totalGeral).toBe(180);
    expect(r.porTipo[0]).toEqual({ tipo: "A", total: 150 });
    const f1 = r.porFornecedor.find((f) => f.cnpj === "1");
    expect(f1).toMatchObject({ total: 150, count: 2, nome: "F1" });
    expect(r.porMes).toEqual([
      { mes: "2024-01", total: 150 },
      { mes: "2024-02", total: 30 },
    ]);
  });
  it("agrupa sem CNPJ pelo nome do fornecedor", () => {
    const r = agregarDespesas([
      d({ fornecedorCnpj: null, fornecedorNome: "Sem CNPJ", valorLiquido: 10 }),
      d({ fornecedorCnpj: null, fornecedorNome: "Sem CNPJ", valorLiquido: 5 }),
    ]);
    expect(r.porFornecedor).toHaveLength(1);
    expect(r.porFornecedor[0].total).toBe(15);
  });
});

describe("despesasParaCsv", () => {
  it("mapeia campos e troca nulos por string vazia", () => {
    const [linha] = despesasParaCsv([
      d({ dataDocumento: null, valorDocumento: undefined, fornecedorNome: null, fornecedorCnpj: null, urlDocumento: null }),
    ]);
    expect(linha.data).toBe("");
    expect(linha.valor_documento).toBe("");
    expect(linha.fornecedor).toBe("");
    expect(linha.cnpj_cpf).toBe("");
    expect(linha.valor_liquido).toBe(100);
  });
});
