import { describe, expect, it } from "vitest";
import { h1DaMateria, h1DaProposicao, h1DaVotacao, h1DoParlamentar } from "./logic";

describe("h1DoParlamentar", () => {
  it("usa o nome parlamentar", () => {
    expect(h1DoParlamentar({ nome: "Tabata Amaral" })).toBe("Tabata Amaral");
  });
});

describe("h1DaProposicao", () => {
  it("monta sigla número/ano", () => {
    expect(h1DaProposicao({ siglaTipo: "PL", numero: 2630, ano: 2020 })).toBe("PL 2630/2020");
  });
});

describe("h1DaMateria", () => {
  it("monta subtipo número/ano", () => {
    expect(h1DaMateria({ siglaSubtipo: "PEC", numero: 45, ano: 2019 })).toBe("PEC 45/2019");
  });
});

describe("h1DaVotacao", () => {
  it("usa a descrição da votação", () => {
    expect(h1DaVotacao({ descricao: "Aprovado o requerimento de urgência" })).toBe(
      "Aprovado o requerimento de urgência",
    );
  });
  it("sem descrição cai no texto padrão da ficha", () => {
    expect(h1DaVotacao({ descricao: null })).toBe("(sem descrição)");
  });
});
