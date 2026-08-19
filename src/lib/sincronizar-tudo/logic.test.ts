import { describe, it, expect } from "vitest";
import { fmtDuration, buildTriedSet, isFutureSlot, countByLabelPrefix } from "./logic";
import type { CoberturaResult } from "@/lib/data/cobertura.functions";

describe("fmtDuration", () => {
  it("formata segundos", () => {
    expect(fmtDuration(15_000)).toBe("15s");
  });
  it("formata minutos cheios", () => {
    expect(fmtDuration(60_000)).toBe("1min");
    expect(fmtDuration(120_000)).toBe("2min");
  });
  it("formata horas + minutos", () => {
    expect(fmtDuration(3_600_000 + 30 * 60_000)).toBe("1h30min");
  });
  it("formata horas redondas", () => {
    expect(fmtDuration(2 * 3_600_000)).toBe("2h");
  });
  it("zero ms vira 0s", () => {
    expect(fmtDuration(0)).toBe("0s");
  });
});

describe("buildTriedSet", () => {
  it("inclui células com qtd>0 ou tentado=true", () => {
    const data = {
      fontes: [
        {
          fonte: "cgu",
          titulo: "CGU",
          linhas: [
            {
              id: "26000",
              titulo: "Saúde",
              celulas: [
                { ano: 2025, mes: 1, qtd: 10, tentado: true },
                { ano: 2025, mes: 2, qtd: 0, tentado: true },
                { ano: 2025, mes: 3, qtd: 0, tentado: false },
              ],
            },
          ],
        },
      ],
    } as unknown as CoberturaResult;
    const tried = buildTriedSet(data);
    expect(tried.has("cgu|26000|2025|1")).toBe(true);
    expect(tried.has("cgu|26000|2025|2")).toBe(true);
    expect(tried.has("cgu|26000|2025|3")).toBe(false);
  });

  it("retorna set vazio quando não há fontes", () => {
    const data = { fontes: [] } as unknown as CoberturaResult;
    expect(buildTriedSet(data).size).toBe(0);
  });
});

describe("isFutureSlot", () => {
  const now = new Date("2026-06-15T00:00:00Z");
  it("mês futuro do ano atual é futuro", () => {
    expect(isFutureSlot({ fonte: "cgu", linhaId: "x", ano: 2026, mes: 8 }, now)).toBe(true);
  });
  it("mês passado do ano atual não é futuro", () => {
    expect(isFutureSlot({ fonte: "cgu", linhaId: "x", ano: 2026, mes: 3 }, now)).toBe(false);
  });
  it("ano passado nunca é futuro", () => {
    expect(isFutureSlot({ fonte: "cgu", linhaId: "x", ano: 2025, mes: 12 }, now)).toBe(false);
  });
});

describe("countByLabelPrefix", () => {
  it("agrupa pelo prefixo antes de ' · '", () => {
    const m = countByLabelPrefix([
      "Portal CGU · jan/2025",
      "Portal CGU · fev/2025",
      "PNCP · jan/2025",
    ]);
    expect(m.get("Portal CGU")).toBe(2);
    expect(m.get("PNCP")).toBe(1);
  });
  it("lista vazia gera mapa vazio", () => {
    expect(countByLabelPrefix([]).size).toBe(0);
  });
});
