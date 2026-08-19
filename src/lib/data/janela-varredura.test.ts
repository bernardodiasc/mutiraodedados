import { describe, it, expect } from "vitest";
import { chaveVarreduraJanela } from "./janela-varredura";

describe("janela-varredura/chave", () => {
  it("junta fonte e janela", () => {
    expect(chaveVarreduraJanela("pncp", "2024-01-01", "2024-01-31")).toBe(
      "pncp#2024-01-01#2024-01-31",
    );
  });

  it("filtros diferentes são varreduras diferentes", () => {
    const semFiltro = chaveVarreduraJanela("pncp", "2024-01-01", "2024-01-31");
    const comUf = chaveVarreduraJanela("pncp", "2024-01-01", "2024-01-31", { uf: "SP" });
    expect(comUf).not.toBe(semFiltro);
    expect(comUf).toBe("pncp#2024-01-01#2024-01-31#uf=SP");
  });

  it("a ordem em que os filtros foram montados não muda a chave", () => {
    const a = chaveVarreduraJanela("t", "2024-01-01", "2024-01-31", { uf: "SP", ibge: "3550308" });
    const b = chaveVarreduraJanela("t", "2024-01-01", "2024-01-31", { ibge: "3550308", uf: "SP" });
    expect(a).toBe(b);
  });

  it("filtro ausente ou vazio não entra na chave", () => {
    const base = chaveVarreduraJanela("pncp", "2024-01-01", "2024-01-31");
    expect(chaveVarreduraJanela("pncp", "2024-01-01", "2024-01-31", { uf: undefined })).toBe(base);
    expect(chaveVarreduraJanela("pncp", "2024-01-01", "2024-01-31", { uf: "" })).toBe(base);
    expect(chaveVarreduraJanela("pncp", "2024-01-01", "2024-01-31", { uf: null })).toBe(base);
  });

  it("janelas diferentes são varreduras diferentes", () => {
    expect(chaveVarreduraJanela("pncp", "2024-01-01", "2024-01-31")).not.toBe(
      chaveVarreduraJanela("pncp", "2024-02-01", "2024-02-29"),
    );
  });

  it("fontes diferentes não colidem na mesma janela", () => {
    expect(chaveVarreduraJanela("pncp", "2024-01-01", "2024-01-31")).not.toBe(
      chaveVarreduraJanela("transferegov", "2024-01-01", "2024-01-31"),
    );
  });
});
