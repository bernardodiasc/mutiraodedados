import { describe, expect, it } from "vitest";
import { ID_LANCAMENTO_RE, ancoraLancamento, deriveEstado, documentoPublico } from "./logic";

describe("deriveEstado (contas de campanha)", () => {
  it("prioriza carregando e erro", () => {
    expect(deriveEstado({ carregando: true, temErro: false, temDados: false })).toBe("carregando");
    expect(deriveEstado({ carregando: false, temErro: true, temDados: true })).toBe("erro");
  });
  it("distingue pronto de vazio", () => {
    expect(deriveEstado({ carregando: false, temErro: false, temDados: true })).toBe("pronto");
    expect(deriveEstado({ carregando: false, temErro: false, temDados: false })).toBe("vazio");
  });
});

describe("lançamentos na ficha", () => {
  it("documento público: CNPJ formatado, CPF sempre mascarado", () => {
    expect(documentoPublico("12345678000190")).toBe("12.345.678/0001-90");
    expect(documentoPublico("12345678901")).toBe("***.456.789-**");
    expect(documentoPublico("***.456.789-**")).toBe("***.456.789-**");
    expect(documentoPublico("123")).toBeNull();
    expect(documentoPublico(null)).toBeNull();
  });

  it("âncora da linha e ids aceitos no link", () => {
    expect(ancoraLancamento("receitas", "2022-123")).toBe("receita-2022-123");
    expect(ancoraLancamento("despesas", "2014-0a1b2c3d4e5f6a7b")).toBe(
      "despesa-2014-0a1b2c3d4e5f6a7b",
    );
    expect(ID_LANCAMENTO_RE.test("2022-123")).toBe(true);
    expect(ID_LANCAMENTO_RE.test("2014-0a1b2c3d4e5f6a7b")).toBe(true);
    expect(ID_LANCAMENTO_RE.test("2022-1,id.gt.0")).toBe(false);
  });
});
