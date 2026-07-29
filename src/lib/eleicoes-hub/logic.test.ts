import { describe, expect, it } from "vitest";
import { agruparPorAno, capitalizarCargo, deriveEstado, rotuloEleicao } from "./logic";

describe("deriveEstado", () => {
  it("carregando vence", () => {
    expect(deriveEstado({ carregando: true, temErro: true, temDados: true })).toBe("carregando");
  });
  it("vazio é o default", () => {
    expect(deriveEstado({ carregando: false, temErro: false, temDados: false })).toBe("vazio");
  });
  it("erro antes de pronto", () => {
    expect(deriveEstado({ carregando: false, temErro: true, temDados: true })).toBe("erro");
  });
});

describe("agruparPorAno", () => {
  it("agrupa por ano decrescente e ordena cargos por total", () => {
    const grupos = agruparPorAno([
      {
        ano_eleicao: 2018,
        cargo_cod: 6,
        cargo_nome: "DEPUTADO FEDERAL",
        total: 100,
        eleitos: 10,
        ufs: 27,
      },
      {
        ano_eleicao: 2022,
        cargo_cod: 6,
        cargo_nome: "DEPUTADO FEDERAL",
        total: 200,
        eleitos: 20,
        ufs: 27,
      },
      { ano_eleicao: 2022, cargo_cod: 5, cargo_nome: "SENADOR", total: 500, eleitos: 27, ufs: 27 },
    ]);
    expect(grupos.map((g) => g.ano)).toEqual([2022, 2018]);
    expect(grupos[0].totalCandidatos).toBe(700);
    expect(grupos[0].cargos[0].cargoNome).toBe("Senador");
  });
});

describe("rótulos", () => {
  it("municipais × gerais", () => {
    expect(rotuloEleicao(2024)).toBe("Eleições Municipais 2024");
    expect(rotuloEleicao(2022)).toBe("Eleições Gerais 2022");
  });
  it("capitalizarCargo", () => {
    expect(capitalizarCargo("2º SUPLENTE")).toBe("2º suplente");
    expect(capitalizarCargo("")).toBe("");
  });
});
