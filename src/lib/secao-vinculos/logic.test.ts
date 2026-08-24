import { describe, expect, it } from "vitest";
import { normalizarNomeParlamentar, rotaDaEntidade, vinculoDeCnpj } from "./logic";

describe("vinculoDeCnpj", () => {
  it("cria vínculo para a ficha do fornecedor com CNPJ formatado na URL", () => {
    const v = vinculoDeCnpj("00000000000191", "BANCO DO BRASIL SA", "R$ 10.000,00");
    expect(v).toMatchObject({
      to: "/fornecedores/$cnpj",
      params: { cnpj: "00.000.000/0001-91" },
      titulo: "BANCO DO BRASIL SA",
      valorFmt: "R$ 10.000,00",
    });
  });

  it("não cruza CPF nem CPF mascarado", () => {
    expect(vinculoDeCnpj("***.123.456-**", "FULANO")).toBeNull();
    expect(vinculoDeCnpj("12345678900", "FULANO")).toBeNull();
  });
});

describe("rotaDaEntidade", () => {
  it("resolve tipos conhecidos", () => {
    expect(rotaDaEntidade("contrato", "123")).toEqual({
      to: "/contratos/$id",
      params: { id: "123" },
    });
    expect(rotaDaEntidade("candidato", "250001234567")).toEqual({
      to: "/eleicoes/candidatos/$sq",
      params: { sq: "250001234567" },
    });
    expect(rotaDaEntidade("fornecedor", "00000000000191")).toEqual({
      to: "/fornecedores/$cnpj",
      params: { cnpj: "00.000.000/0001-91" },
    });
  });

  it("retorna null para tipo desconhecido", () => {
    expect(rotaDaEntidade("relatorio", "x")).toBeNull();
  });
});

describe("normalizarNomeParlamentar", () => {
  it("remove acentos, caixa e espaços duplicados", () => {
    expect(normalizarNomeParlamentar("  José   da Silva Júnior ")).toBe("JOSE DA SILVA JUNIOR");
  });
});
