import { describe, it, expect } from "vitest";
import { parseValorPortal, valorCguListagemPrecisaDetalhe } from "./portal.functions";

describe("parseValorPortal — CGU (listagem e detalhe usam o mesmo formato)", () => {
  it("decimal americano com 4 casas zeradas: 600000.0000 => 600000", () => {
    expect(parseValorPortal("600000.0000")).toBe(600000);
  });

  it("decimal americano com centavos em 4 casas: 1130608.9200 => 1130608.92", () => {
    expect(parseValorPortal("1130608.9200")).toBe(1130608.92);
  });

  it("decimal americano truncado: 244799.9800 => 244799.98", () => {
    expect(parseValorPortal("244799.9800")).toBe(244799.98);
  });

  it("milhões: 11160825.0000 => 11160825", () => {
    expect(parseValorPortal("11160825.0000")).toBe(11160825);
  });

  it("decimal curto: 117560.30 => 117560.30", () => {
    expect(parseValorPortal("117560.30")).toBe(117560.3);
  });

  it("decimal com 1 casa: 260000.0 => 260000", () => {
    expect(parseValorPortal("260000.0")).toBe(260000);
  });

  it("NÃO existe regra ×10.000: 60.0000 significa 60, não 600000", () => {
    expect(parseValorPortal("60.0000")).toBe(60);
  });

  it("caso real 676319701: listagem 9.0000 continua decimal puro, mas precisa detalhe", () => {
    const valor = parseValorPortal("9.0000");
    expect(valor).toBe(9);
    expect(valorCguListagemPrecisaDetalhe(valor, valor)).toBe(true);
  });

  it("valores normais da CGU não disparam detalhe extra", () => {
    expect(valorCguListagemPrecisaDetalhe(90000, 90000)).toBe(false);
    expect(valorCguListagemPrecisaDetalhe(1130608.92, 1130608.92)).toBe(false);
  });

  it("número JS é passado adiante: 600000.0000 (number) => 600000", () => {
    expect(parseValorPortal(600000)).toBe(600000);
    expect(parseValorPortal(1130608.92)).toBe(1130608.92);
  });

  it("vazio/null/undefined => 0", () => {
    expect(parseValorPortal("")).toBe(0);
    expect(parseValorPortal(null)).toBe(0);
    expect(parseValorPortal(undefined)).toBe(0);
  });
});

describe("parseValorPortal — formatos pt-BR (campos livres / documentos)", () => {
  it("pt-BR com milhar e centavos: 1.410.723,60 => 1410723.6", () => {
    expect(parseValorPortal("1.410.723,60")).toBe(1410723.6);
  });

  it("pt-BR milhar sem centavos: 1.410.723 => 1410723", () => {
    expect(parseValorPortal("1.410.723")).toBe(1410723);
  });

  it("prefixo R$ é ignorado: R$ 1.130.608,92 => 1130608.92", () => {
    expect(parseValorPortal("R$ 1.130.608,92")).toBe(1130608.92);
  });
});