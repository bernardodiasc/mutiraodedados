import { describe, expect, it } from "vitest";
import { parseValorSenado } from "@/lib/data/senado/parsers";

describe("parseValorSenado", () => {
  it("number JSON passa direto", () => {
    expect(parseValorSenado(3000)).toBe(3000);
    expect(parseValorSenado(1234.56)).toBe(1234.56);
    expect(parseValorSenado(0)).toBe(0);
  });

  it("string decimal americana da API não é multiplicada por 100", () => {
    // Antes: "3000.00" virava 300000 (todos os pontos eram removidos).
    expect(parseValorSenado("3000.00")).toBe(3000);
    expect(parseValorSenado("187.5")).toBe(187.5);
  });

  it("pt-BR com vírgula decimal", () => {
    expect(parseValorSenado("1.234,56")).toBe(1234.56);
    expect(parseValorSenado("1500,00")).toBe(1500);
  });

  it("milhar pt-BR inequívoco (≥2 grupos)", () => {
    expect(parseValorSenado("1.234.567")).toBe(1234567);
  });

  it("nulo / vazio / inválido => 0", () => {
    expect(parseValorSenado(null)).toBe(0);
    expect(parseValorSenado(undefined)).toBe(0);
    expect(parseValorSenado("")).toBe(0);
    expect(parseValorSenado("abc")).toBe(0);
    expect(parseValorSenado(NaN)).toBe(0);
  });
});
