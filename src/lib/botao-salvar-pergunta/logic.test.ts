import { describe, it, expect } from "vitest";
import { deriveBotaoEstado, normalizarPayloadPergunta } from "./logic";

describe("deriveBotaoEstado", () => {
  it("deslogado quando sem usuário", () => {
    expect(deriveBotaoEstado({ hasUser: false, justSaved: false, isPending: false })).toBe(
      "deslogado",
    );
  });
  it("salvo prevalece sobre demais", () => {
    expect(deriveBotaoEstado({ hasUser: true, justSaved: true, isPending: true })).toBe(
      "salvo",
    );
  });
  it("salvando quando pendente e ainda não salvo", () => {
    expect(deriveBotaoEstado({ hasUser: true, justSaved: false, isPending: true })).toBe(
      "salvando",
    );
  });
  it("salvar é o estado default", () => {
    expect(deriveBotaoEstado({ hasUser: true, justSaved: false, isPending: false })).toBe(
      "salvar",
    );
  });
});

describe("normalizarPayloadPergunta", () => {
  it("faz trim e descarta strings vazias", () => {
    expect(
      normalizarPayloadPergunta({ texto: "  hello world  ", contexto: "   " }),
    ).toEqual({ titulo: "hello world", contexto: null });
  });
  it("preserva valores não-vazios", () => {
    expect(
      normalizarPayloadPergunta({ texto: "pergunta de teste", contexto: "ctx" }),
    ).toEqual({ titulo: "pergunta de teste", contexto: "ctx" });
  });
});