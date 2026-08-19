import { describe, expect, it } from "vitest";
import {
  regrasPncp,
  regrasCamaraCeap,
  regrasSenadoCeaps,
  regrasTransferegov,
  regrasSiconfi,
} from "@/lib/data/qa";

describe("regrasPncp", () => {
  it("não gera findings para contrato coerente", () => {
    expect(regrasPncp([{ id: "p1", valor_global: 100000, valor_inicial: 90000 }])).toEqual([]);
  });

  it("valor_global_menor_inicial (crítico) quando global < 50% do inicial", () => {
    const f = regrasPncp([{ id: "p2", valor_global: 40000, valor_inicial: 100000 }]);
    expect(f).toMatchObject([
      { regra: "valor_global_menor_inicial", tipo: "qualidade", severidade: "critico" },
    ]);
    // Exatamente 50% não dispara.
    expect(regrasPncp([{ id: "p3", valor_global: 50000, valor_inicial: 100000 }])).toEqual([]);
  });

  it("valor_global_zerado (aviso) quando global = 0 com inicial > 0", () => {
    const f = regrasPncp([{ id: "p4", valor_global: 0, valor_inicial: 100000 }]);
    expect(f).toMatchObject([{ regra: "valor_global_zerado", severidade: "aviso" }]);
    // Ambos zero: nada a sinalizar.
    expect(regrasPncp([{ id: "p5", valor_global: 0, valor_inicial: 0 }])).toEqual([]);
  });
});

describe("regrasCamaraCeap", () => {
  it("liquido_maior_documento (crítico) acima da tolerância de 1%", () => {
    const f = regrasCamaraCeap([{ id: "d1", valor_liquido: 102, valor_documento: 100 }]);
    expect(f).toMatchObject([
      { regra: "liquido_maior_documento", tipo: "qualidade", severidade: "critico" },
    ]);
  });

  it("tolera arredondamento de até 1%", () => {
    expect(regrasCamaraCeap([{ id: "d2", valor_liquido: 100.9, valor_documento: 100 }])).toEqual([]);
    expect(regrasCamaraCeap([{ id: "d3", valor_liquido: 90, valor_documento: 100 }])).toEqual([]);
  });

  it("documento zerado não dispara (sem base de comparação)", () => {
    expect(regrasCamaraCeap([{ id: "d4", valor_liquido: 50, valor_documento: 0 }])).toEqual([]);
  });
});

describe("regrasSenadoCeaps", () => {
  it("valor_negativo (aviso) para reembolso negativo", () => {
    const f = regrasSenadoCeaps([{ id: "s1", valor_reembolsado: -10, senador_id: 42 }]);
    expect(f).toMatchObject([
      { regra: "valor_negativo", tipo: "qualidade", severidade: "aviso", valor_armazenado: -10 },
    ]);
  });

  it("zero e positivo não disparam", () => {
    expect(regrasSenadoCeaps([{ id: "s2", valor_reembolsado: 0 }])).toEqual([]);
    expect(regrasSenadoCeaps([{ id: "s3", valor_reembolsado: 150.5 }])).toEqual([]);
  });
});

describe("regrasTransferegov", () => {
  it("repasse_maior_global (crítico) acima da tolerância de 1%", () => {
    const f = regrasTransferegov([{ id: "t1", valor_repasse: 102000, valor_global: 100000 }]);
    expect(f).toMatchObject([
      { regra: "repasse_maior_global", tipo: "qualidade", severidade: "critico" },
    ]);
  });

  it("valor_truncado_suspeito (aviso) para global ínfimo (>0 e <R$100)", () => {
    const f = regrasTransferegov([{ id: "t2", valor_repasse: 0, valor_global: 12.34 }]);
    expect(f).toMatchObject([
      { regra: "valor_truncado_suspeito", severidade: "aviso", valor_armazenado: 12.34 },
    ]);
    expect(regrasTransferegov([{ id: "t3", valor_repasse: 0, valor_global: 100 }])).toEqual([]);
  });

  it("instrumento coerente não gera findings", () => {
    expect(
      regrasTransferegov([{ id: "t4", valor_repasse: 90000, valor_global: 100000 }]),
    ).toEqual([]);
  });
});

describe("regrasSiconfi", () => {
  it("valor_negativo_em_conta_positiva (aviso) para receita/transferência negativa", () => {
    const f = regrasSiconfi([
      { id: "r1", valor: -500, conta: "Receita Tributária", tipo_relatorio: "RREO" },
      { id: "r2", valor: -500, conta: "Transferências Correntes", tipo_relatorio: "RREO" },
    ]);
    expect(f).toHaveLength(2);
    expect(f[0]).toMatchObject({
      regra: "valor_negativo_em_conta_positiva",
      tipo: "qualidade",
      severidade: "aviso",
    });
  });

  it("despesa negativa (estorno) não dispara — a regra é só para contas positivas", () => {
    expect(
      regrasSiconfi([{ id: "r3", valor: -500, conta: "Despesas Empenhadas", tipo_relatorio: "RREO" }]),
    ).toEqual([]);
  });

  it("receita positiva não dispara", () => {
    expect(
      regrasSiconfi([{ id: "r4", valor: 500, conta: "Receita Tributária", tipo_relatorio: "RREO" }]),
    ).toEqual([]);
  });
});
