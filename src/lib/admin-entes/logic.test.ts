import { describe, it, expect } from "vitest";
import { UFS, PRESETS, UF_LIST, sanitizeIbge, monthRange, isMunicipio, isUF } from "./logic";

describe("UFS", () => {
  it("tem 28 entradas (vazio + 27 UFs)", () => {
    expect(UFS).toHaveLength(28);
    expect(UFS[0]).toBe("");
    expect(UFS).toContain("SP");
    expect(UFS).toContain("DF");
  });
});

describe("PRESETS", () => {
  it("contém códigos IBGE conhecidos", () => {
    expect(PRESETS.find((p) => p.codigo === "3550308")).toBeDefined();
    expect(PRESETS.find((p) => p.codigo === "53")?.tipo).toBe("UF");
  });
});

describe("UF_LIST", () => {
  it("contém 27 estados todos marcados como UF", () => {
    expect(UF_LIST).toHaveLength(27);
    expect(UF_LIST.every((e) => e.tipo === "UF")).toBe(true);
    expect(UF_LIST.find((e) => e.uf === "SP")?.codigo).toBe("35");
  });
});

describe("sanitizeIbge", () => {
  it("remove não-dígitos", () => {
    expect(sanitizeIbge("35-50.308")).toBe("3550308");
  });
  it("limita a 7 caracteres", () => {
    expect(sanitizeIbge("12345678901")).toBe("1234567");
  });
  it("aceita vazio", () => {
    expect(sanitizeIbge("abc")).toBe("");
  });
});

describe("monthRange", () => {
  it("fevereiro não-bissexto", () => {
    expect(monthRange(2025, 2)).toEqual({ ini: "2025-02-01", fim: "2025-02-28" });
  });
  it("fevereiro bissexto", () => {
    expect(monthRange(2024, 2)).toEqual({ ini: "2024-02-01", fim: "2024-02-29" });
  });
  it("preenche zero à esquerda em janeiro", () => {
    expect(monthRange(2026, 1)).toEqual({ ini: "2026-01-01", fim: "2026-01-31" });
  });
});

describe("isMunicipio / isUF", () => {
  it("identifica 7 dígitos como município", () => {
    expect(isMunicipio("3550308")).toBe(true);
    expect(isMunicipio("35")).toBe(false);
    expect(isMunicipio("355030a")).toBe(false);
  });
  it("identifica 2 dígitos como UF", () => {
    expect(isUF("35")).toBe(true);
    expect(isUF("3550308")).toBe(false);
    expect(isUF("a5")).toBe(false);
  });
});
