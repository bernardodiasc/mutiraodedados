import { describe, it, expect } from "vitest";
import {
  diasDesde,
  fmtRelativo,
  fmtAnoMes,
  freshness,
  corFresh,
  legendaDosEstados,
  estadosDoAno,
} from "./logic";

const NOW = new Date("2026-06-09T12:00:00Z").getTime();
const days = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

describe("diasDesde", () => {
  it("retorna null para vazio/ inválido", () => {
    expect(diasDesde(null, NOW)).toBe(null);
    expect(diasDesde("nope", NOW)).toBe(null);
  });
  it("calcula diferença em dias", () => {
    expect(diasDesde(days(0), NOW)).toBe(0);
    expect(diasDesde(days(5), NOW)).toBe(5);
  });
  it("não retorna negativo se data no futuro", () => {
    expect(diasDesde(days(-3), NOW)).toBe(0);
  });
});

describe("fmtRelativo", () => {
  it("hoje/ontem", () => {
    expect(fmtRelativo(days(0), NOW)).toBe("hoje");
    expect(fmtRelativo(days(1), NOW)).toBe("ontem");
  });
  it("intervalos", () => {
    expect(fmtRelativo(days(10), NOW)).toBe("há 10 dias");
    expect(fmtRelativo(days(45), NOW)).toBe("há 1 mês");
    expect(fmtRelativo(days(120), NOW)).toBe("há 4 meses");
    expect(fmtRelativo(days(400), NOW)).toBe("há 1 ano");
    expect(fmtRelativo(days(800), NOW)).toBe("há 2 anos");
  });
  it("em-dash para vazio", () => {
    expect(fmtRelativo(null, NOW)).toBe("—");
  });
});

describe("fmtAnoMes", () => {
  it("recorta para YYYY-MM", () => {
    expect(fmtAnoMes("2026-06-09")).toBe("2026-06");
  });
  it("em-dash para null", () => {
    expect(fmtAnoMes(null)).toBe("—");
  });
});

describe("freshness", () => {
  it("classifica em fresh/warn/stale/none", () => {
    expect(freshness(null, NOW)).toBe("none");
    expect(freshness(days(10), NOW)).toBe("fresh");
    expect(freshness(days(60), NOW)).toBe("warn");
    expect(freshness(days(200), NOW)).toBe("stale");
  });
});

describe("corFresh", () => {
  it("mapeia para classes", () => {
    expect(corFresh("fresh")).toContain("emerald");
    expect(corFresh("warn")).toContain("amber");
    expect(corFresh("stale")).toContain("rose");
    expect(corFresh("none")).toContain("muted");
  });
});

describe("estados de cobertura na página", () => {
  it("legenda lista só os estados presentes, do melhor ao pior", () => {
    const porEstado = {
      erro: 1,
      indisponivel: 0,
      processando: 0,
      parcial: 2,
      vazio_confirmado: 0,
      concluido: 5,
      concluido_sem_total: 0,
      nao_consultado: 3,
    };
    expect(legendaDosEstados(porEstado)).toEqual([
      { estado: "concluido", qtd: 5 },
      { estado: "parcial", qtd: 2 },
      { estado: "erro", qtd: 1 },
      { estado: "nao_consultado", qtd: 3 },
    ]);
  });

  it("estado por mês só considera a linha única da fonte (escopo vazio)", () => {
    const m = estadosDoAno(
      [
        { escopo: "", ano: 2026, mes: 1, estado: "concluido" },
        { escopo: "26000", ano: 2026, mes: 2, estado: "erro" },
        { escopo: "", ano: 2025, mes: 3, estado: "parcial" },
      ],
      2026,
    );
    expect([...m]).toEqual([[1, "concluido"]]);
  });
});
