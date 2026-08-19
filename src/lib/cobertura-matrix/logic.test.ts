import { describe, it, expect } from "vitest";
import type { Linha } from "@/lib/data/cobertura.functions";
import {
  MESES_CURTO,
  colunasDeGranularidade,
  colHeader,
  colLabelLong,
  intensidadeCelula,
  isStale,
  totalLinhaAno,
  colMaxQtd,
  lacunasMesesDaLinha,
  intersectarSelecionadas,
} from "./logic";

describe("MESES_CURTO", () => {
  it("12 meses começando em Jan", () => {
    expect(MESES_CURTO).toHaveLength(12);
    expect(MESES_CURTO[0]).toBe("Jan");
    expect(MESES_CURTO[11]).toBe("Dez");
  });
});

describe("colunasDeGranularidade", () => {
  it("periodo => 1..6", () => {
    expect(colunasDeGranularidade("periodo")).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("ano => [1]", () => {
    expect(colunasDeGranularidade("ano")).toEqual([1]);
  });
  it("mes => 1..12", () => {
    expect(colunasDeGranularidade("mes")).toHaveLength(12);
  });
});

describe("colHeader / colLabelLong", () => {
  it("formata por granularidade", () => {
    expect(colHeader("periodo", 3)).toBe("P3");
    expect(colHeader("ano", 1)).toBe("Ano");
    expect(colHeader("mes", 2)).toBe("Fev");
    expect(colLabelLong("periodo", 3, 2024)).toBe("P3");
    expect(colLabelLong("ano", 1, 2024)).toBe("Ano 2024");
    expect(colLabelLong("mes", 2, 2024)).toBe("Fev/2024");
  });
});

describe("intensidadeCelula", () => {
  it("zero quando qtd=0", () => {
    expect(intensidadeCelula(0, 10)).toBe(0);
  });
  it("piso de 0.18", () => {
    expect(intensidadeCelula(1, 1000)).toBe(0.18);
  });
  it("teto de 1", () => {
    expect(intensidadeCelula(50, 10)).toBe(1);
  });
  it("proporcional no meio", () => {
    expect(intensidadeCelula(5, 10)).toBeCloseTo(0.5);
  });
});

describe("isStale", () => {
  const agora = new Date("2024-12-01").getTime();
  it("null => false", () => {
    expect(isStale(null, agora)).toBe(false);
  });
  it(">90 dias => true", () => {
    expect(isStale("2024-01-01", agora)).toBe(true);
  });
  it("<90 dias => false", () => {
    expect(isStale("2024-11-15", agora)).toBe(false);
  });
});

const linha = (id: string, celulas: Linha["celulas"]): Linha => ({ id, label: id, celulas });

describe("totalLinhaAno / colMaxQtd", () => {
  const l1 = linha("a", [
    { ano: 2024, mes: 1, qtd: 3, tentado: true, ultimo: null },
    { ano: 2024, mes: 2, qtd: 7, tentado: true, ultimo: null },
    { ano: 2023, mes: 1, qtd: 99, tentado: true, ultimo: null },
  ]);
  const l2 = linha("b", [{ ano: 2024, mes: 1, qtd: 12, tentado: true, ultimo: null }]);

  it("totalLinhaAno filtra por ano", () => {
    expect(totalLinhaAno(l1, 2024)).toBe(10);
    expect(totalLinhaAno(l1, 2023)).toBe(99);
  });
  it("colMaxQtd pega o maior do ano", () => {
    expect(colMaxQtd([l1, l2], 2024)).toBe(12);
    expect(colMaxQtd([l1, l2], 2025)).toBe(1);
  });
});

describe("lacunasMesesDaLinha", () => {
  it("retorna meses sem tentativa", () => {
    const l = linha("a", [
      { ano: 2024, mes: 1, qtd: 0, tentado: true, ultimo: null },
      { ano: 2024, mes: 2, qtd: 5, tentado: false, ultimo: null },
      { ano: 2023, mes: 3, qtd: 9, tentado: true, ultimo: null },
    ]);
    expect(lacunasMesesDaLinha(l, 2024)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});

describe("intersectarSelecionadas", () => {
  it("mantém apenas ids presentes em ambos", () => {
    const r = intersectarSelecionadas(new Set(["a", "b", "c"]), ["b", "c", "d"]);
    expect(Array.from(r).sort()).toEqual(["b", "c"]);
  });
});
