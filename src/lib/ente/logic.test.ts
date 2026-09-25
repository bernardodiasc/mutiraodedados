import { describe, expect, it } from "vitest";
import { codigoCanonico, h1DoEnte, interpretarCodigoEnte } from "./logic";

describe("interpretarCodigoEnte", () => {
  it("aceita sigla de UF em qualquer caixa", () => {
    expect(interpretarCodigoEnte("sp")).toEqual({ tipo: "estado", uf: "SP", codIbge: "35" });
    expect(interpretarCodigoEnte("DF")).toEqual({ tipo: "estado", uf: "DF", codIbge: "53" });
  });

  it("aceita código IBGE de estado (2 dígitos) e de município (7 dígitos)", () => {
    expect(interpretarCodigoEnte("35")).toEqual({ tipo: "estado", uf: "SP", codIbge: "35" });
    expect(interpretarCodigoEnte("3550308")).toEqual({ tipo: "municipio", ibge: "3550308" });
  });

  it("rejeita códigos inválidos", () => {
    expect(interpretarCodigoEnte("XX")).toBeNull();
    expect(interpretarCodigoEnte("99")).toBeNull();
    expect(interpretarCodigoEnte("123")).toBeNull();
  });

  it("gera a URL canônica", () => {
    expect(codigoCanonico({ tipo: "estado", uf: "SP", codIbge: "35" })).toBe("sp");
    expect(codigoCanonico({ tipo: "municipio", ibge: "3550308" })).toBe("3550308");
  });
});

describe("h1DoEnte", () => {
  it("município leva a UF entre parênteses", () => {
    expect(h1DoEnte({ tipo: "municipio", nome: "Campinas", uf: "SP" })).toBe("Campinas (SP)");
  });

  it("estado é só o nome", () => {
    expect(h1DoEnte({ tipo: "estado", nome: "São Paulo", uf: "SP" })).toBe("São Paulo");
  });
});
