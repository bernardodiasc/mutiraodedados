import { describe, expect, it } from "vitest";
import { chavesIdentidade, cpfUtilizavel, temIdentificador, tituloUtilizavel } from "./identidade";

describe("cpfUtilizavel", () => {
  it("aceita só 11 dígitos que não sejam repetição", () => {
    expect(cpfUtilizavel("12345678901")).toBe(true);
  });
  it("recusa nulo, curto, mascarado e dígito repetido", () => {
    expect(cpfUtilizavel(null)).toBe(false);
    expect(cpfUtilizavel(undefined)).toBe(false);
    expect(cpfUtilizavel("")).toBe(false);
    expect(cpfUtilizavel("123")).toBe(false);
    expect(cpfUtilizavel("***456789**")).toBe(false);
    expect(cpfUtilizavel("00000000000")).toBe(false);
    expect(cpfUtilizavel("11111111111")).toBe(false);
  });
});

describe("tituloUtilizavel", () => {
  it("aceita o título de 12 dígitos que o TSE publica em 2024", () => {
    expect(tituloUtilizavel("003311212402")).toBe(true);
  });
  it("aceita 10 e 11 dígitos (zeros à esquerda omitidos na origem)", () => {
    expect(tituloUtilizavel("3311212402")).toBe(true);
    expect(tituloUtilizavel("33112124021")).toBe(true);
  });
  it("recusa nulo, curto, longo, texto e dígito repetido", () => {
    expect(tituloUtilizavel(null)).toBe(false);
    expect(tituloUtilizavel("")).toBe(false);
    expect(tituloUtilizavel("123")).toBe(false);
    expect(tituloUtilizavel("1234567890123")).toBe(false);
    expect(tituloUtilizavel("NÃO DIVULGÁVEL")).toBe(false);
    expect(tituloUtilizavel("-4")).toBe(false);
    expect(tituloUtilizavel("000000000000")).toBe(false);
  });
});

describe("chavesIdentidade", () => {
  it("candidatura de 2022: CPF e título", () => {
    expect(chavesIdentidade({ cpf: "12345678901", titulo_eleitoral: "003311212402" })).toEqual({
      cpf: "12345678901",
      titulo: "003311212402",
    });
  });

  it("candidatura de 2024: só título, CPF não divulgado", () => {
    const c = chavesIdentidade({ cpf: null, titulo_eleitoral: "003311212402" });
    expect(c).toEqual({ cpf: null, titulo: "003311212402" });
    expect(temIdentificador(c)).toBe(true);
  });

  it("descarta sentinela em vez de propagar lixo", () => {
    const c = chavesIdentidade({ cpf: "-4", titulo_eleitoral: "#NULO" });
    expect(c).toEqual({ cpf: null, titulo: null });
    expect(temIdentificador(c)).toBe(false);
  });
});
