import { describe, expect, it } from "vitest";
import { deriveEstado, foiEleito, vinculoPrecisaAviso } from "./logic";

describe("deriveEstado", () => {
  it("sem-vinculo quando a ponte não tem linhas", () => {
    expect(deriveEstado({ carregando: false, temErro: false, temVinculo: false })).toBe(
      "sem-vinculo",
    );
  });
  it("pronto com vínculo", () => {
    expect(deriveEstado({ carregando: false, temErro: false, temVinculo: true })).toBe("pronto");
  });
});

describe("vinculoPrecisaAviso", () => {
  it("cpf nunca precisa de aviso", () => {
    expect(vinculoPrecisaAviso("cpf", 1)).toBe(false);
  });
  it("nome com confiança baixa precisa", () => {
    expect(vinculoPrecisaAviso("nome_uf_partido", 0.75)).toBe(true);
  });
  it("nome com partido batendo (0.9) não precisa", () => {
    expect(vinculoPrecisaAviso("nome_uf_partido", 0.9)).toBe(false);
  });
});

describe("foiEleito", () => {
  it("qualquer variação de eleito", () => {
    expect(foiEleito("ELEITO POR MÉDIA")).toBe(true);
    expect(foiEleito("Eleito por QP")).toBe(true);
    expect(foiEleito("NÃO ELEITO")).toBe(false);
    expect(foiEleito(null)).toBe(false);
  });
});
