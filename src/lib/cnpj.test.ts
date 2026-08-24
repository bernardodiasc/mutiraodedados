import { describe, expect, it } from "vitest";
import { ehCnpj, ehCpfMascarado, formatarCnpj, normalizarCnpj, soDigitos } from "./cnpj";

describe("cnpj", () => {
  it("normaliza CNPJ formatado para 14 dígitos", () => {
    expect(normalizarCnpj("00.000.000/0001-91")).toBe("00000000000191");
    expect(soDigitos("00.000.000/0001-91")).toBe("00000000000191");
  });

  it("recusa documentos incompletos ou CPF", () => {
    expect(normalizarCnpj("123.456.789-00")).toBeNull();
    expect(ehCnpj("123.456.789-00")).toBe(false);
  });

  it("formata dígitos e preserva entrada que não é CNPJ", () => {
    expect(formatarCnpj("00000000000191")).toBe("00.000.000/0001-91");
    expect(formatarCnpj("1234")).toBe("1234");
  });

  it("detecta CPF mascarado pela origem", () => {
    expect(ehCpfMascarado("***.123.456-**")).toBe(true);
    expect(ehCpfMascarado("00.000.000/0001-91")).toBe(false);
  });
});
