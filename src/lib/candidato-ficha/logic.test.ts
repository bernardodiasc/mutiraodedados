import { describe, expect, it } from "vitest";
import { deriveEstado, somaBens, subtituloFicha } from "./logic";

describe("deriveEstado", () => {
  it("nao-encontrado quando a busca termina vazia", () => {
    expect(deriveEstado({ carregando: false, temErro: false, encontrado: false })).toBe(
      "nao-encontrado",
    );
  });
  it("pronto quando encontrado", () => {
    expect(deriveEstado({ carregando: false, temErro: false, encontrado: true })).toBe("pronto");
  });
  it("carregando vence erro", () => {
    expect(deriveEstado({ carregando: true, temErro: true, encontrado: false })).toBe("carregando");
  });
});

describe("somaBens", () => {
  it("ignora nulos", () => {
    expect(somaBens([{ valor: 100 }, { valor: null }, { valor: 50.5 }])).toBe(150.5);
  });
});

describe("subtituloFicha", () => {
  it("junta só o que existe", () => {
    expect(
      subtituloFicha({ cargo_nome: "Senador", uf: "AC", partido_sigla: null, ano_eleicao: 2022 }),
    ).toBe("Senador · AC · 2022");
  });
});
