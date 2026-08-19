import { describe, it, expect } from "vitest";
import { buildFluxoSnippet, sanitizeNomeFluxo, interpretarPromptLink } from "./logic";

describe("buildFluxoSnippet", () => {
  it("monta o snippet com linhas em branco", () => {
    expect(buildFluxoSnippet("contrato-pncp")).toBe('\n\n:::fluxo{nome="contrato-pncp"}:::\n\n');
  });
});

describe("sanitizeNomeFluxo", () => {
  it("baixa caixa e troca espaços por hífen", () => {
    expect(sanitizeNomeFluxo("  Contrato PNCP  ")).toBe("contrato-pncp");
  });
  it("remove caracteres inválidos", () => {
    expect(sanitizeNomeFluxo("ação!@#fluxo")).toBe("a-o-fluxo");
  });
});

describe("interpretarPromptLink", () => {
  it("null = cancelar", () => {
    expect(interpretarPromptLink(null)).toEqual({ tipo: "cancelar" });
  });
  it("string vazia = remover", () => {
    expect(interpretarPromptLink("")).toEqual({ tipo: "remover" });
  });
  it("string com URL = definir", () => {
    expect(interpretarPromptLink("https://x.com")).toEqual({
      tipo: "definir",
      href: "https://x.com",
    });
  });
});
