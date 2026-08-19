import { describe, expect, it } from "vitest";
import { parseValorPortal, parseValorPortalDetalhado } from "@/lib/data/real/portal-client";

describe("parseValorPortal — confia no number cru da API", () => {
  it("inteiro number passa direto: 900000 => 900000", () => {
    expect(parseValorPortal(900000)).toBe(900000);
  });

  it("decimal number passa direto: 1130608.92 => 1130608.92", () => {
    expect(parseValorPortal(1130608.92)).toBe(1130608.92);
  });

  it("zero é zero", () => {
    expect(parseValorPortal(0)).toBe(0);
  });

  it("string inteira: '900000' => 900000", () => {
    expect(parseValorPortal("900000")).toBe(900000);
  });

  it("string decimal americana: '1130608.92' => 1130608.92", () => {
    expect(parseValorPortal("1130608.92")).toBe(1130608.92);
  });

  it("vazio / null / undefined / NaN => 0", () => {
    expect(parseValorPortal("")).toBe(0);
    expect(parseValorPortal(null)).toBe(0);
    expect(parseValorPortal(undefined)).toBe(0);
    expect(parseValorPortal(NaN)).toBe(0);
  });
});

describe("parseValorPortal — formatos pt-BR (campos livres / documentos)", () => {
  it("milhar pt-BR com decimal: 1.410.723,60", () => {
    expect(parseValorPortal("1.410.723,60")).toBe(1410723.6);
  });

  it("milhar pt-BR sem decimal: 60.000", () => {
    expect(parseValorPortal("60.000")).toBe(60000);
  });

  it("milhar pt-BR múltiplo sem decimal: 1.000.000", () => {
    expect(parseValorPortal("1.000.000")).toBe(1000000);
  });

  it("prefixo R$: R$ 1.130.608,92", () => {
    expect(parseValorPortal("R$ 1.130.608,92")).toBe(1130608.92);
  });
});

describe("parseValorPortal — variações JSON da CGU", () => {
  it("string numérica decimal não trunca: '106226.64' => 106226.64", () => {
    expect(parseValorPortal("106226.64")).toBe(106226.64);
  });

  it("decimal americano de 3 casas com >3 dígitos inteiros passa direto: '1130.608'", () => {
    // Não casa a regex de milhar (\d{1,3} antes do primeiro ponto).
    expect(parseValorPortal("1130.608")).toBe(1130.608);
  });
});

describe("parseValorPortalDetalhado — ambiguidade de grupo único", () => {
  it("um único grupo '.ddd' é ambíguo: lê como milhar pt-BR mas sinaliza", () => {
    expect(parseValorPortalDetalhado("576.000")).toEqual({ valor: 576000, milharAmbiguo: true });
    expect(parseValorPortalDetalhado("60.000")).toEqual({ valor: 60000, milharAmbiguo: true });
  });

  it("≥ 2 grupos é milhar inequívoco", () => {
    expect(parseValorPortalDetalhado("1.000.000")).toEqual({
      valor: 1000000,
      milharAmbiguo: false,
    });
  });

  it("vírgula decimal elimina a ambiguidade", () => {
    expect(parseValorPortalDetalhado("576.000,00")).toEqual({
      valor: 576000,
      milharAmbiguo: false,
    });
  });

  it("number cru nunca é ambíguo", () => {
    expect(parseValorPortalDetalhado(576000)).toEqual({ valor: 576000, milharAmbiguo: false });
  });
});
