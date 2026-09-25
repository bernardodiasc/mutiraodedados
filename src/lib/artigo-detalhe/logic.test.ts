import { describe, it, expect } from "vitest";
import { h1DoArtigo, obterRotuloDificuldade } from "./logic";

describe("obterRotuloDificuldade", () => {
  it("retorna o rótulo amigável correto para dificuldades mapeadas", () => {
    expect(obterRotuloDificuldade("iniciante")).toBe("Iniciante");
    expect(obterRotuloDificuldade("intermediario")).toBe("Intermediário");
    expect(obterRotuloDificuldade("avancado")).toBe("Avançado");
  });

  it("devolve a própria string se não estiver no dicionário", () => {
    expect(obterRotuloDificuldade("desconhecido")).toBe("desconhecido");
  });

  it("retorna string vazia para valores nulos ou indefinidos", () => {
    expect(obterRotuloDificuldade(null)).toBe("");
    expect(obterRotuloDificuldade(undefined)).toBe("");
  });
});

describe("h1DoArtigo", () => {
  it("o H1 da página é o título do artigo", () => {
    expect(h1DoArtigo({ titulo: "Como ler um contrato" })).toBe("Como ler um contrato");
  });

  it("sem artigo (não encontrado ou ainda carregando) não há H1", () => {
    expect(h1DoArtigo(null)).toBeNull();
    expect(h1DoArtigo(undefined)).toBeNull();
  });
});
