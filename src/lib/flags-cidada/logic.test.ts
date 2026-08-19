import { describe, it, expect } from "vitest";
import { validateSubmit, aggregateVotes, formatDataCurta, TIPOS } from "./logic";

describe("TIPOS", () => {
  it("tem 3 opções", () => expect(TIPOS).toHaveLength(3));
});

describe("validateSubmit", () => {
  it("aceita confirmar sem comentário", () => {
    expect(validateSubmit("confirmar", "  ")).toEqual({ ok: true });
  });
  it("rejeita suspeita sem comentário", () => {
    const r = validateSubmit("suspeita", "");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/coment/i);
  });
  it("aceita suspeita com comentário", () => {
    expect(validateSubmit("suspeita", "tem nota")).toEqual({ ok: true });
  });
});

describe("aggregateVotes", () => {
  it("soma valores por flag_id", () => {
    expect(
      aggregateVotes([
        { flag_id: "a", valor: 1 },
        { flag_id: "a", valor: 1 },
        { flag_id: "b", valor: -1 },
      ]),
    ).toEqual({ a: 2, b: -1 });
  });
  it("retorna vazio para lista vazia", () => {
    expect(aggregateVotes([])).toEqual({});
  });
});

describe("formatDataCurta", () => {
  it("formata pt-BR", () => {
    expect(formatDataCurta("2026-03-15T12:00:00Z")).toMatch(/2026/);
  });
  it("devolve string original para data inválida", () => {
    expect(formatDataCurta("xx")).toBe("xx");
  });
});
