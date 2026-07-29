import { describe, expect, it } from "vitest";
import { deriveEstado, paraItens } from "./logic";

describe("deriveEstado", () => {
  it("vazio quando não há doações", () => {
    expect(deriveEstado({ carregando: false, temErro: false, temDados: false })).toBe("vazio");
  });
});

describe("paraItens", () => {
  it("monta rótulos com fallback", () => {
    const [item] = paraItens([
      {
        sq_candidato: "10001",
        ano_eleicao: 2022,
        valor: 5000,
        data: "2022-09-01",
        candidato_nome: null,
        candidato_partido: "PP",
        candidato_uf: null,
        candidato_cargo: "Vereador",
      },
    ]);
    expect(item.candidato).toBe("candidatura 10001");
    expect(item.detalhe).toBe("Vereador · PP");
  });
});
