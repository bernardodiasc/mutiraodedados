import { describe, it, expect } from "vitest";
import { obterRotuloDificuldade } from "./logic";

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
