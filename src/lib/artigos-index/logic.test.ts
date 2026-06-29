import { describe, it, expect } from "vitest";
import { dificuldadeLabel, formatDataPublicacao, detailPathFor } from "./logic";

describe("dificuldadeLabel", () => {
  it("mapeia conhecidas", () => {
    expect(dificuldadeLabel("iniciante")).toBe("Iniciante");
    expect(dificuldadeLabel("intermediario")).toBe("Intermediário");
    expect(dificuldadeLabel("avancado")).toBe("Avançado");
  });
  it("devolve a entrada para desconhecidas", () => {
    expect(dificuldadeLabel("guru")).toBe("guru");
  });
  it("trata null/undefined/vazio como null", () => {
    expect(dificuldadeLabel(null)).toBeNull();
    expect(dificuldadeLabel(undefined)).toBeNull();
    expect(dificuldadeLabel("")).toBeNull();
  });
});

describe("formatDataPublicacao", () => {
  it("formata data ISO", () => {
    expect(formatDataPublicacao("2026-03-15T12:00:00Z")).toMatch(/2026/);
  });
  it("vazio para inválidas", () => {
    expect(formatDataPublicacao("não-é-data")).toBe("");
    expect(formatDataPublicacao(null)).toBe("");
    expect(formatDataPublicacao(undefined)).toBe("");
  });
});

describe("detailPathFor", () => {
  it("monta path com $slug", () => {
    expect(detailPathFor("/mapas")).toBe("/mapas/$slug");
    expect(detailPathFor("/tutoriais")).toBe("/tutoriais/$slug");
    expect(detailPathFor("/notas")).toBe("/notas/$slug");
  });
});