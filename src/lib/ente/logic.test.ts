import { describe, expect, it } from "vitest";
import { codigoCanonico, interpretarCodigoEnte } from "./logic";

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
