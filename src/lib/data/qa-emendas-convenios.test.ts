import { describe, expect, it } from "vitest";
import { regrasCguEmendas, regrasCguConvenios } from "@/lib/data/qa";

describe("regrasCguEmendas", () => {
  it("não gera findings quanto pago ≤ liquidado ≤ empenhado", () => {
    expect(
      regrasCguEmendas([
        { id: "e1", valor_empenhado: 100000, valor_liquidado: 80000, valor_pago: 80000 },
      ]),
    ).toEqual([]);
  });

  it("sinaliza pago maior que empenhado (crítico)", () => {
    const f = regrasCguEmendas([
      { id: "e2", valor_empenhado: 100000, valor_liquidado: 100000, valor_pago: 150000 },
    ]);
    expect(f.some((x) => x.regra === "pago_maior_empenhado" && x.severidade === "critico")).toBe(true);
  });

  it("sinaliza liquidado maior que empenhado (aviso)", () => {
    const f = regrasCguEmendas([
      { id: "e3", valor_empenhado: 100000, valor_liquidado: 120000, valor_pago: 0 },
    ]);
    expect(f.some((x) => x.regra === "liquidado_maior_empenhado")).toBe(true);
  });

  it("sinaliza empenho ínfimo (>0 e <R$100) como suspeita de truncamento por escala", () => {
    const f = regrasCguEmendas([
      { id: "e4", valor_empenhado: 12.34, valor_liquidado: 0, valor_pago: 0 },
    ]);
    expect(f).toMatchObject([
      { regra: "valor_truncado_suspeito", severidade: "aviso", valor_armazenado: 12.34 },
    ]);
    expect(
      regrasCguEmendas([{ id: "e5", valor_empenhado: 100, valor_liquidado: 0, valor_pago: 0 }]),
    ).toEqual([]);
  });
});

describe("regrasCguConvenios", () => {
  it("não gera findings quando liberado ≤ valor global", () => {
    expect(
      regrasCguConvenios([{ id: "c1", valor: 100000, valor_liberado: 90000 }]),
    ).toEqual([]);
  });

  it("sinaliza liberado maior que o valor global (aviso)", () => {
    const f = regrasCguConvenios([{ id: "c2", valor: 100000, valor_liberado: 130000 }]);
    expect(f.some((x) => x.regra === "liberado_maior_global")).toBe(true);
  });

  it("sinaliza valor negativo como crítico", () => {
    const f = regrasCguConvenios([{ id: "c3", valor: -1, valor_liberado: 0 }]);
    expect(f.some((x) => x.regra === "valor_negativo" && x.severidade === "critico")).toBe(true);
  });

  it("sinaliza valor global ínfimo (>0 e <R$100) como suspeita de truncamento por escala", () => {
    const f = regrasCguConvenios([{ id: "c4", valor: 57.6, valor_liberado: 0 }]);
    expect(f).toMatchObject([
      { regra: "valor_truncado_suspeito", severidade: "aviso", valor_armazenado: 57.6 },
    ]);
    expect(regrasCguConvenios([{ id: "c5", valor: 100, valor_liberado: 0 }])).toEqual([]);
  });
});
