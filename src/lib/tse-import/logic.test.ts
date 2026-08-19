import { describe, expect, it } from "vitest";
import { montarJobsTse, motivoIndisponivel, resumirProgresso, rotuloTipo } from "./logic";

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

  it("2026 gera jobs de candidatos e bens (já publicados)", () => {
    expect(montarJobsTse({ tipo: "candidatos", ano: 2026, uf: "TODAS" })).toHaveLength(28);
    expect(montarJobsTse({ tipo: "bens", ano: 2026, uf: "AC" })).toHaveLength(1);
  });

  it("2026 não gera job do que o TSE ainda não publicou", () => {
    for (const tipo of ["resultados", "receitas", "despesas"] as const) {
      expect(montarJobsTse({ tipo, ano: 2026, uf: "TODAS" })).toEqual([]);
    }
  });

  it("anos antigos respeitam o piso de cada tipo", () => {
    // 1998 é eleição geral: 27 UFs + BR.
    expect(montarJobsTse({ tipo: "candidatos", ano: 1998, uf: "TODAS" })).toHaveLength(28);
    expect(montarJobsTse({ tipo: "resultados", ano: 1998, uf: "AC" })).toHaveLength(1);
    expect(montarJobsTse({ tipo: "bens", ano: 1998, uf: "TODAS" })).toEqual([]);
    expect(montarJobsTse({ tipo: "bens", ano: 2006, uf: "AC" })).toHaveLength(1);
    expect(montarJobsTse({ tipo: "receitas", ano: 2010, uf: "TODAS" })).toEqual([]);
    expect(montarJobsTse({ tipo: "receitas", ano: 2012, uf: "AC" })).toHaveLength(1);
  });

  it("2000 é municipal e não tem BR", () => {
    const jobs = montarJobsTse({ tipo: "candidatos", ano: 2000, uf: "TODAS" });
    expect(jobs).toHaveLength(27);
    expect(jobs.some((j) => j.uf === "BR")).toBe(false);
  });
});

describe("motivoIndisponivel", () => {
  it("cala a boca quando a origem existe", () => {
    expect(motivoIndisponivel("candidatos", 2026)).toBeNull();
    expect(motivoIndisponivel("bens", 2026)).toBeNull();
    expect(motivoIndisponivel("resultados", 2022)).toBeNull();
    expect(motivoIndisponivel("receitas", 2014)).toBeNull();
  });

  // Pisos sondados no CDN do TSE em 2026-08-08, tipo a tipo.
  it("cada tipo tem seu próprio primeiro ano", () => {
    expect(motivoIndisponivel("candidatos", 1998)).toBeNull();
    expect(motivoIndisponivel("resultados", 1998)).toBeNull();
    expect(motivoIndisponivel("bens", 2004)).toMatch(/a partir de 2006/);
    expect(motivoIndisponivel("bens", 2006)).toBeNull();
    expect(motivoIndisponivel("receitas", 2010)).toMatch(/a partir de 2012/);
    expect(motivoIndisponivel("receitas", 2012)).toBeNull();
    expect(motivoIndisponivel("despesas", 2012)).toBeNull();
  });

  it("distingue 'nunca existiu' de 'ainda não saiu'", () => {
    expect(motivoIndisponivel("bens", 1998)).toMatch(/não existe/);
    expect(motivoIndisponivel("receitas", 2026)).toMatch(/ainda não foi publicada/);
  });

  it("explica o que falta em 2026", () => {
    expect(motivoIndisponivel("resultados", 2026)).toMatch(/apuração/i);
    expect(motivoIndisponivel("receitas", 2026)).toMatch(/prestação de contas/i);
    expect(motivoIndisponivel("despesas", 2026)).toMatch(/prestação de contas/i);
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
