import { describe, expect, it } from "vitest";
import { montarJobsTse, resumirProgresso, rotuloTipo } from "./logic";

describe("montarJobsTse", () => {
  it("UF única vira um job", () => {
    expect(montarJobsTse({ tipo: "candidatos", ano: 2022, uf: "AC" })).toEqual([
      { tipo: "candidatos", ano: 2022, uf: "AC" },
    ]);
  });
  it("TODAS expande as UFs e inclui BR nas gerais", () => {
    const jobs = montarJobsTse({ tipo: "candidatos", ano: 2022, uf: "TODAS" });
    expect(jobs).toHaveLength(28);
    expect(jobs.some((j) => j.uf === "BR")).toBe(true);
  });
  it("TODAS exclui BR nas municipais", () => {
    const jobs = montarJobsTse({ tipo: "candidatos", ano: 2024, uf: "TODAS" });
    expect(jobs).toHaveLength(27);
    expect(jobs.some((j) => j.uf === "BR")).toBe(false);
  });
});

describe("resumirProgresso", () => {
  it("agrupa por tipo#ano e separa pendentes", () => {
    const resumo = resumirProgresso([
      { chave: "candidatos#2022#AC", linhas: 10, importados: 10, completa: true, atualizadoEm: "" },
      { chave: "candidatos#2022#SP", linhas: 5, importados: 5, completa: false, atualizadoEm: "" },
      { chave: "bens#2022#AC", linhas: 3, importados: 3, completa: true, atualizadoEm: "" },
    ]);
    expect(resumo).toHaveLength(2);
    const cand = resumo.find((r) => r.tipo === "candidatos")!;
    expect(cand.ufsCompletas).toBe(1);
    expect(cand.pendentes).toEqual(["SP"]);
    expect(cand.importados).toBe(15);
  });
  it("ignora chaves malformadas", () => {
    expect(
      resumirProgresso([
        { chave: "estranho", linhas: 0, importados: 0, completa: false, atualizadoEm: "" },
      ]),
    ).toEqual([]);
  });
});

describe("rotuloTipo", () => {
  it("traduz e cai no id quando desconhecido", () => {
    expect(rotuloTipo("candidatos")).toBe("Candidatos");
  });
});
