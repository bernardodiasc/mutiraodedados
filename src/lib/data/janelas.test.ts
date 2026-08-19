import { describe, expect, it } from "vitest";
import { ANO_INICIO_POR_FONTE, dentroDaJanela, dentroDaJanelaAnual } from "./janelas";

const AGOSTO_2026 = new Date("2026-08-08T12:00:00Z");

describe("dentroDaJanela (mensal)", () => {
  it("recusa antes do início da fonte", () => {
    expect(dentroDaJanela("pncp", 2020, 6, AGOSTO_2026)).toBe(false);
    expect(dentroDaJanela("pncp", 2021, 6, AGOSTO_2026)).toBe(true);
  });

  it("recusa o futuro", () => {
    expect(dentroDaJanela("cgu", 2027, 1, AGOSTO_2026)).toBe(false);
    expect(dentroDaJanela("cgu", 2026, 9, AGOSTO_2026)).toBe(false);
    expect(dentroDaJanela("cgu", 2026, 8, AGOSTO_2026)).toBe(true);
  });
});

describe("dentroDaJanelaAnual", () => {
  it("aceita o ano corrente mesmo antes de dezembro", () => {
    // O bug que isto trava: representar um arquivo ANUAL como (ano, mês 12)
    // fazia a eleição em curso ser recusada até dezembro.
    expect(dentroDaJanela("tse", 2026, 12, AGOSTO_2026)).toBe(false);
    expect(dentroDaJanelaAnual("tse", 2026, AGOSTO_2026)).toBe(true);
  });

  it("respeita o início da fonte e recusa o futuro", () => {
    expect(dentroDaJanelaAnual("tse", 1997, AGOSTO_2026)).toBe(false);
    expect(dentroDaJanelaAnual("tse", 1998, AGOSTO_2026)).toBe(true);
    expect(dentroDaJanelaAnual("tse", 2028, AGOSTO_2026)).toBe(false);
  });

  it("1º de janeiro já libera o ano novo", () => {
    // Data local de propósito: a virada segue o relógio de quem roda (UTC no
    // Worker), e um instante UTC "2028-01-01T00:00Z" ainda é 2027 no Brasil.
    expect(dentroDaJanelaAnual("tse", 2028, new Date(2028, 0, 1))).toBe(true);
  });
});

describe("ANO_INICIO_POR_FONTE", () => {
  it("toda fonte tem um ano de início plausível", () => {
    for (const [fonte, ano] of Object.entries(ANO_INICIO_POR_FONTE)) {
      expect(ano, fonte).toBeGreaterThanOrEqual(1988);
      expect(ano, fonte).toBeLessThanOrEqual(2026);
    }
  });
});
