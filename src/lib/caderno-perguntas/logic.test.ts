import { describe, it, expect } from "vitest";
import { formatarStatusPergunta, formatarDataPt } from "./logic";

describe("formatarStatusPergunta", () => {
  it("formata status conhecidos em pt-BR", () => {
    expect(formatarStatusPergunta("em_revisao")).toBe("Em revisão");
    expect(formatarStatusPergunta("publicada")).toBe("Pública");
  });
  it("substitui underscores quando desconhecido", () => {
    expect(formatarStatusPergunta("algo_novo")).toBe("algo novo");
  });
});

describe("formatarDataPt", () => {
  it("formata ISO em pt-BR", () => {
    expect(formatarDataPt("2026-03-15T12:00:00Z")).toMatch(/2026/);
  });
  it("devolve original quando inválida", () => {
    expect(formatarDataPt("xx")).toBe("xx");
  });
});