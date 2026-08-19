import { describe, expect, it } from "vitest";
import {
  CATEGORIAS_BEM_ORDEM,
  agregarPorCategoria,
  categoriaDoBem,
  type CategoriaBem,
} from "./categorias-bens";

describe("categoriaDoBem — pelo código", () => {
  it("o código manda, não a descrição", () => {
    expect(categoriaDoBem("12", "descrição inútil")).toBe("imoveis");
    expect(categoriaDoBem("21", "")).toBe("veiculos");
    expect(categoriaDoBem("49", null)).toBe("dinheiro");
    expect(categoriaDoBem("32", null)).toBe("empresas");
    expect(categoriaDoBem("51", null)).toBe("creditos");
    expect(categoriaDoBem("61", null)).toBe("dinheiro");
    expect(categoriaDoBem("99", null)).toBe("outros");
  });

  it("códigos de UM dígito são imóveis, não a dezena homônima", () => {
    // O que a regra por dezena erraria: 2 viraria veículo e 3, empresa.
    expect(categoriaDoBem("1", null)).toBe("imoveis"); // Prédio residencial
    expect(categoriaDoBem("2", null)).toBe("imoveis"); // Prédio comercial
    expect(categoriaDoBem("3", null)).toBe("imoveis"); // Galpão
  });

  it("a dezena 2 é bens móveis, e só 21-23 é transporte", () => {
    expect(categoriaDoBem("22", null)).toBe("veiculos"); // Aeronave
    expect(categoriaDoBem("24", null)).toBe("outros"); // Bem de atividade autônoma
    expect(categoriaDoBem("25", null)).toBe("outros"); // Jóia, quadro, obra de arte
    expect(categoriaDoBem("26", null)).toBe("outros"); // Linha telefônica
  });

  it("fundos de investimento (dezena 7) entram em dinheiro", () => {
    expect(categoriaDoBem("71", null)).toBe("dinheiro");
    expect(categoriaDoBem("74", "Fundos: Ações, Mútuos de Privatização")).toBe("dinheiro");
    expect(categoriaDoBem("79", null)).toBe("dinheiro");
  });

  it("normaliza zero à esquerda e cai para a dezena em código novo", () => {
    expect(categoriaDoBem("012", null)).toBe("imoveis");
    expect(categoriaDoBem("48", null)).toBe("dinheiro"); // 4x desconhecido
    expect(categoriaDoBem("28", null)).toBe("outros"); // 2x desconhecido ≠ veículo
  });

  it("código fora de qualquer dezena conhecida cai para a descrição", () => {
    expect(categoriaDoBem("80", "Casa")).toBe("imoveis");
    expect(categoriaDoBem("0", "Casa")).toBe("imoveis");
  });
});

/**
 * Os 48 códigos que aparecem em bem_candidato_2026.zip (Brasil inteiro).
 * Se o TSE publicar um código novo, este teste não avisa — mas garante que
 * nenhum dos que existem hoje regrida para "outros" por engano.
 */
const CODIGOS_TSE_2026: Array<[string, CategoriaBem]> = [
  ["1", "imoveis"],
  ["2", "imoveis"],
  ["3", "imoveis"],
  ["11", "imoveis"],
  ["12", "imoveis"],
  ["13", "imoveis"],
  ["14", "imoveis"],
  ["15", "imoveis"],
  ["16", "imoveis"],
  ["17", "imoveis"],
  ["18", "imoveis"],
  ["19", "imoveis"],
  ["21", "veiculos"],
  ["22", "veiculos"],
  ["23", "veiculos"],
  ["24", "outros"],
  ["25", "outros"],
  ["26", "outros"],
  ["29", "outros"],
  ["31", "empresas"],
  ["32", "empresas"],
  ["39", "empresas"],
  ["41", "dinheiro"],
  ["45", "dinheiro"],
  ["46", "dinheiro"],
  ["47", "dinheiro"],
  ["49", "dinheiro"],
  ["51", "creditos"],
  ["52", "creditos"],
  ["54", "creditos"],
  ["59", "creditos"],
  ["61", "dinheiro"],
  ["62", "dinheiro"],
  ["63", "dinheiro"],
  ["64", "dinheiro"],
  ["69", "dinheiro"],
  ["71", "dinheiro"],
  ["72", "dinheiro"],
  ["73", "dinheiro"],
  ["74", "dinheiro"],
  ["79", "dinheiro"],
  ["91", "outros"],
  ["92", "outros"],
  ["93", "outros"],
  ["95", "creditos"],
  ["96", "outros"],
  ["97", "dinheiro"],
  ["99", "outros"],
];

describe("mapa contra a tabela real do TSE (2026)", () => {
  it("cobre os 48 códigos publicados", () => {
    expect(CODIGOS_TSE_2026).toHaveLength(48);
    for (const [cod, esperado] of CODIGOS_TSE_2026) {
      expect(categoriaDoBem(cod, null), `código ${cod}`).toBe(esperado);
    }
  });

  it("nenhum código real depende da descrição para classificar", () => {
    const semDescricao = CODIGOS_TSE_2026.map(([c]) => categoriaDoBem(c, null));
    const comDescricaoRuim = CODIGOS_TSE_2026.map(([c]) => categoriaDoBem(c, "texto qualquer"));
    expect(comDescricaoRuim).toEqual(semDescricao);
  });
});

describe("categoriaDoBem — fallback pela descrição (código NULL)", () => {
  it("corta a enumeração depois dos dois-pontos", () => {
    expect(
      categoriaDoBem(null, "Veículo automotor terrestre: caminhão, automóvel, moto, etc."),
    ).toBe("veiculos");
  });

  it("resolve as colisões que dependem da ordem das regras", () => {
    expect(categoriaDoBem(null, "Fundo de comércio")).toBe("empresas");
    expect(categoriaDoBem(null, "Crédito decorrente de empréstimo")).toBe("creditos");
    expect(categoriaDoBem(null, "Depósito bancário em conta corrente no País")).toBe("dinheiro");
    expect(categoriaDoBem(null, "Quotas ou quinhões de capital")).toBe("empresas");
    expect(categoriaDoBem(null, "Título de capital")).toBe("empresas");
  });

  it('"aplicações" não é confundido com "ações"', () => {
    expect(categoriaDoBem(null, "Outras aplicações e Investimentos")).toBe("dinheiro");
    expect(categoriaDoBem(null, "Ações (inclusive as provenientes de linha telefônica)")).toBe(
      "empresas",
    );
  });

  it("ignora acento e caixa", () => {
    expect(categoriaDoBem(null, "APARTAMENTO")).toBe("imoveis");
    expect(categoriaDoBem(null, "Veiculo automotor terrestre")).toBe("veiculos");
    expect(categoriaDoBem(null, "Outros bens imóveis")).toBe("imoveis");
  });

  it("o que não casa vira outros, sem lançar", () => {
    expect(categoriaDoBem(null, null)).toBe("outros");
    expect(categoriaDoBem(undefined, undefined)).toBe("outros");
    expect(categoriaDoBem(null, "")).toBe("outros");
    expect(categoriaDoBem(null, "Outros bens e direitos")).toBe("outros");
    expect(categoriaDoBem(null, "Xyz inexistente")).toBe("outros");
  });
});

describe("agregarPorCategoria", () => {
  it("soma por categoria e respeita a ordem fixa", () => {
    const r = agregarPorCategoria([
      { tipo_bem_cod: "49", tipo_bem: "Outras aplicações", valor: 1000 },
      { tipo_bem_cod: "12", tipo_bem: "Casa", valor: 500 },
      { tipo_bem_cod: "12", tipo_bem: "Casa", valor: 250 },
    ]);
    expect(r.map((c) => c.categoria)).toEqual(["imoveis", "dinheiro"]);
    expect(r[0]).toEqual({ categoria: "imoveis", total: 750, quantidade: 2 });
  });

  it("bem sem valor conta na quantidade mas não no total", () => {
    const r = agregarPorCategoria([
      { tipo_bem_cod: "12", tipo_bem: "Casa", valor: null },
      { tipo_bem_cod: "12", tipo_bem: "Casa", valor: 100 },
    ]);
    expect(r).toEqual([{ categoria: "imoveis", total: 100, quantidade: 2 }]);
  });

  it("lista vazia devolve vazio", () => {
    expect(agregarPorCategoria([])).toEqual([]);
  });

  it("funciona sem o campo de código (linhas antigas)", () => {
    const r = agregarPorCategoria([{ tipo_bem: "Casa", valor: 10 }]);
    expect(r).toEqual([{ categoria: "imoveis", total: 10, quantidade: 1 }]);
  });
});

describe("CATEGORIAS_BEM_ORDEM", () => {
  it('termina em "outros" e não tem repetição', () => {
    expect(CATEGORIAS_BEM_ORDEM.at(-1)).toBe("outros");
    expect(new Set(CATEGORIAS_BEM_ORDEM).size).toBe(CATEGORIAS_BEM_ORDEM.length);
  });
});
