import { describe, it, expect } from "vitest";
import {
  DRAFT_INICIAL,
  podeSalvar,
  previewConteudo,
  draftDeAnotacao,
  formatarDataPt,
} from "./logic";
import type { Anotacao } from "@/lib/anotacoes.functions";

describe("podeSalvar", () => {
  it("falso quando vazio", () => {
    expect(podeSalvar(DRAFT_INICIAL)).toBe(false);
  });
  it("verdadeiro com título", () => {
    expect(podeSalvar({ ...DRAFT_INICIAL, titulo: "x" })).toBe(true);
  });
  it("verdadeiro com conteúdo", () => {
    expect(podeSalvar({ ...DRAFT_INICIAL, conteudo_md: "x" })).toBe(true);
  });
  it("ignora whitespace", () => {
    expect(podeSalvar({ ...DRAFT_INICIAL, titulo: "  ", conteudo_md: "\n " })).toBe(false);
  });
});

describe("previewConteudo", () => {
  it("não trunca abaixo do limite", () => {
    expect(previewConteudo("oi", 10)).toBe("oi");
  });
  it("trunca acima do limite", () => {
    expect(previewConteudo("a".repeat(20), 5)).toBe(`${"a".repeat(5)}…`);
  });
  it("compacta espaços", () => {
    expect(previewConteudo("a   b\n\nc")).toBe("a b c");
  });
});

describe("draftDeAnotacao", () => {
  it("converte anotação em draft", () => {
    const a = {
      id: "abc",
      titulo: "T",
      conteudo_md: "C",
    } as unknown as Anotacao;
    expect(draftDeAnotacao(a)).toEqual({ id: "abc", titulo: "T", conteudo_md: "C" });
  });
  it("trata nulos", () => {
    const a = { id: "abc", titulo: null, conteudo_md: "" } as unknown as Anotacao;
    expect(draftDeAnotacao(a)).toEqual({ id: "abc", titulo: "", conteudo_md: "" });
  });
});

describe("formatarDataPt", () => {
  it("formata", () => {
    expect(formatarDataPt("2026-03-15T12:00:00Z")).toMatch(/2026/);
  });
  it("devolve original em inválida", () => {
    expect(formatarDataPt("xx")).toBe("xx");
  });
});