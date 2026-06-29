import { describe, it, expect } from "vitest";
import { fmtBRL, fmtData, severityClasses, isHttpOk } from "./logic";

describe("fmtBRL", () => {
  it("formata número como BRL", () => {
    expect(fmtBRL(1234.5)).toMatch(/R\$\s?1\.234,50/);
  });
  it("trata null/undefined como em-dash", () => {
    expect(fmtBRL(null)).toBe("—");
    expect(fmtBRL(undefined)).toBe("—");
  });
  it("aceita zero", () => {
    expect(fmtBRL(0)).toMatch(/R\$\s?0,00/);
  });
});

describe("fmtData", () => {
  it("formata ISO em pt-BR", () => {
    const out = fmtData("2026-01-15T12:00:00Z");
    expect(out).not.toBe("—");
    expect(out).not.toBe("2026-01-15T12:00:00Z");
  });
  it("devolve em-dash para vazio", () => {
    expect(fmtData(null)).toBe("—");
    expect(fmtData("")).toBe("—");
  });
  it("devolve string original para data inválida", () => {
    expect(fmtData("não-é-data")).toBe("não-é-data");
  });
});

describe("severityClasses", () => {
  it("crítico vira destructive", () => {
    expect(severityClasses("critico")).toContain("destructive");
  });
  it("aviso vira amber", () => {
    expect(severityClasses("aviso")).toContain("amber");
  });
  it("info vira muted", () => {
    expect(severityClasses("info")).toContain("muted");
  });
});

describe("isHttpOk", () => {
  it("200 é ok", () => expect(isHttpOk(200)).toBe(true));
  it("299 é ok", () => expect(isHttpOk(299)).toBe(true));
  it("199 não é ok", () => expect(isHttpOk(199)).toBe(false));
  it("300 não é ok", () => expect(isHttpOk(300)).toBe(false));
  it("500 não é ok", () => expect(isHttpOk(500)).toBe(false));
});