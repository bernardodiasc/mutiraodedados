import { describe, it, expect } from "vitest";
import {
  ALVOS_SICONFI,
  CAPITAIS,
  alvoNoCursor,
  chaveVarreduraSiconfi,
  exerciciosDoIntervalo,
  rotuloAlvo,
  totalDeConsultas,
  type EnteSiconfi,
} from "./varredura";

const entes: EnteSiconfi[] = [
  { codigo: "35", nome: "São Paulo", uf: "SP" },
  { codigo: "33", nome: "Rio de Janeiro", uf: "RJ" },
];

describe("siconfi/alvos padrão", () => {
  it("são 10: RREO 1–6, RGF 1–3 e DCA", () => {
    expect(ALVOS_SICONFI).toHaveLength(10);
    expect(ALVOS_SICONFI.filter((a) => a.tipoRelatorio === "RREO")).toHaveLength(6);
    expect(ALVOS_SICONFI.filter((a) => a.tipoRelatorio === "RGF")).toHaveLength(3);
    expect(ALVOS_SICONFI.filter((a) => a.tipoRelatorio === "DCA")).toHaveLength(1);
  });

  it("só o DCA não tem período", () => {
    const semPeriodo = ALVOS_SICONFI.filter((a) => a.periodo == null);
    expect(semPeriodo).toEqual([{ tipoRelatorio: "DCA" }]);
  });

  it("rótulo distingue período", () => {
    expect(rotuloAlvo({ tipoRelatorio: "RREO", periodo: 3 })).toBe("RREO P3");
    expect(rotuloAlvo({ tipoRelatorio: "DCA" })).toBe("DCA");
  });
});

describe("siconfi/capitais", () => {
  it("são 27, uma por UF", () => {
    expect(CAPITAIS).toHaveLength(27);
    expect(new Set(CAPITAIS.map((c) => c.uf)).size).toBe(27);
  });

  it("todo código é de município (7 dígitos)", () => {
    for (const c of CAPITAIS) expect(c.codigo).toMatch(/^\d{7}$/);
  });

  it("nenhum código repetido", () => {
    expect(new Set(CAPITAIS.map((c) => c.codigo)).size).toBe(27);
  });
});

describe("siconfi/exercícios", () => {
  it("intervalo inclusivo em ordem crescente", () => {
    expect(exerciciosDoIntervalo(2013, 2016)).toEqual([2013, 2014, 2015, 2016]);
  });

  it("um único ano", () => {
    expect(exerciciosDoIntervalo(2024, 2024)).toEqual([2024]);
  });

  it("intervalo invertido é vazio (não estoura)", () => {
    expect(exerciciosDoIntervalo(2024, 2020)).toEqual([]);
  });
});

describe("siconfi/total de consultas", () => {
  it("é o produto das três dimensões", () => {
    expect(totalDeConsultas(27, 14)).toBe(27 * 14 * 10);
  });

  it("zero entes ou zero exercícios não gera consulta", () => {
    expect(totalDeConsultas(0, 14)).toBe(0);
    expect(totalDeConsultas(27, 0)).toBe(0);
  });
});

describe("siconfi/cursor", () => {
  const exercicios = [2023, 2024];

  it("o cursor 1 é o primeiro alvo do primeiro exercício do primeiro ente", () => {
    const { posicao } = alvoNoCursor(entes, exercicios, 1);
    expect(posicao).toEqual({
      ente: entes[0],
      exercicio: 2023,
      alvo: { tipoRelatorio: "RREO", periodo: 1 },
    });
  });

  it("percorre os 10 alvos antes de trocar de exercício", () => {
    expect(alvoNoCursor(entes, exercicios, 10).posicao).toMatchObject({
      exercicio: 2023,
      alvo: { tipoRelatorio: "DCA" },
    });
    expect(alvoNoCursor(entes, exercicios, 11).posicao).toMatchObject({
      exercicio: 2024,
      alvo: { tipoRelatorio: "RREO", periodo: 1 },
    });
  });

  it("termina todos os exercícios de um ente antes de passar ao próximo", () => {
    expect(alvoNoCursor(entes, exercicios, 20).posicao?.ente).toEqual(entes[0]);
    expect(alvoNoCursor(entes, exercicios, 21).posicao).toEqual({
      ente: entes[1],
      exercicio: 2023,
      alvo: { tipoRelatorio: "RREO", periodo: 1 },
    });
  });

  it("cobre exatamente o total, sem pular nem repetir", () => {
    const total = totalDeConsultas(entes.length, exercicios.length);
    const vistos = new Set<string>();
    for (let c = 1; c <= total; c++) {
      const { posicao, fim } = alvoNoCursor(entes, exercicios, c);
      expect(fim).toBe(false);
      vistos.add(`${posicao!.ente.codigo}|${posicao!.exercicio}|${rotuloAlvo(posicao!.alvo)}`);
    }
    expect(vistos.size).toBe(total);
  });

  it("passar do último encerra a varredura", () => {
    const total = totalDeConsultas(entes.length, exercicios.length);
    expect(alvoNoCursor(entes, exercicios, total + 1)).toEqual({ posicao: null, fim: true });
  });

  it("cursor inválido não estoura", () => {
    expect(alvoNoCursor(entes, exercicios, 0).fim).toBe(true);
    expect(alvoNoCursor(entes, exercicios, -3).fim).toBe(true);
  });

  it("lista vazia encerra na primeira tentativa", () => {
    expect(alvoNoCursor([], exercicios, 1).fim).toBe(true);
    expect(alvoNoCursor(entes, [], 1).fim).toBe(true);
  });
});

describe("siconfi/chave de varredura", () => {
  it("conjuntos diferentes não colidem", () => {
    expect(chaveVarreduraSiconfi("ufs", 2013, 2026)).not.toBe(
      chaveVarreduraSiconfi("capitais", 2013, 2026),
    );
  });

  it("intervalos diferentes não colidem", () => {
    expect(chaveVarreduraSiconfi("ufs", 2013, 2026)).not.toBe(
      chaveVarreduraSiconfi("ufs", 2020, 2026),
    );
  });

  it("o filtro (UF ou ente) entra na chave", () => {
    expect(chaveVarreduraSiconfi("municipios", 2024, 2024, "SP")).toBe(
      "siconfi_varredura#municipios#2024-2024#SP",
    );
    expect(chaveVarreduraSiconfi("municipios", 2024, 2024, "SP")).not.toBe(
      chaveVarreduraSiconfi("municipios", 2024, 2024, "RJ"),
    );
  });
});
