import { describe, expect, it } from "vitest";
import { validarCpf, validarCnpj } from "@/lib/data/tse/qualidade";

describe("validarCpf", () => {
  it("aceita CPF válido (dígitos verificadores corretos)", () => {
    // CPF de exemplo com DV válido (gerado pelo algoritmo oficial).
    expect(validarCpf("52998224725")).toBe(true);
  });

  it("rejeita DV inválido", () => {
    expect(validarCpf("52998224726")).toBe(false);
  });

  it("rejeita sequências repetidas e tamanhos errados", () => {
    expect(validarCpf("11111111111")).toBe(false);
    expect(validarCpf("123")).toBe(false);
    expect(validarCpf("")).toBe(false);
  });
});

describe("validarCnpj", () => {
  it("aceita CNPJ válido", () => {
    // CNPJ da União (Tesouro Nacional): 00.394.460/0058-87.
    expect(validarCnpj("00394460005887")).toBe(true);
  });

  it("rejeita DV inválido", () => {
    expect(validarCnpj("00394460005888")).toBe(false);
  });

  it("rejeita sequências repetidas e tamanhos errados", () => {
    expect(validarCnpj("00000000000000")).toBe(false);
    expect(validarCnpj("1234567890123")).toBe(false);
    expect(validarCnpj("")).toBe(false);
  });
});
