import { describe, expect, it } from "vitest";
import {
  agruparPorAno,
  anotarVariacoes,
  barrasPatrimonio,
  candidaturaComparacaoPadrao,
  deriveEstado,
  diffCategorias,
  ordenarHistorico,
  serieBens,
  somaBens,
  subtituloFicha,
  totalPatrimonio,
  variacaoEntre,
  type CandidaturaHistorico,
} from "./logic";

function cand(over: Partial<CandidaturaHistorico> & { ano: number }): CandidaturaHistorico {
  return {
    sq: `sq${over.ano}`,
    turno: 1,
    cargo: "Deputado Federal",
    uf: "AC",
    partido: "MDB",
    situacao: "ELEITO",
    bensTotal: 100,
    atual: false,
    ...over,
  };
}

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

describe("totalPatrimonio", () => {
  it("sem agregado e sem bens devolve null, não zero", () => {
    expect(totalPatrimonio(null, [])).toBeNull();
  });
  it("preserva o zero declarado", () => {
    expect(totalPatrimonio(0, [])).toBe(0);
  });
  it("cai para a soma dos bens quando o agregado falta", () => {
    expect(totalPatrimonio(null, [{ valor: 30 }, { valor: 12 }])).toBe(42);
  });
});

describe("variacaoEntre", () => {
  it("calcula delta e fração no caso normal", () => {
    expect(variacaoEntre(100, 150)).toEqual({ delta: 50, fracao: 0.5, motivo: null });
    expect(variacaoEntre(100, 50)).toEqual({ delta: -50, fracao: -0.5, motivo: null });
  });

  it("partindo de zero mantém o delta e suprime a porcentagem", () => {
    expect(variacaoEntre(0, 500)).toEqual({ delta: 500, fracao: null, motivo: "anterior-zero" });
  });

  it("base negativa também não vira porcentagem", () => {
    expect(variacaoEntre(-10, 500).motivo).toBe("anterior-zero");
  });

  it("distingue lado ausente de lado zerado", () => {
    expect(variacaoEntre(null, 500).motivo).toBe("anterior-ausente");
    expect(variacaoEntre(100, null).motivo).toBe("atual-ausente");
    expect(variacaoEntre(null, 500).delta).toBeNull();
  });

  it("nunca devolve Infinity nem NaN", () => {
    const casos: Array<[number | null, number | null]> = [
      [0, 500],
      [0, 0],
      [-10, 10],
      [100, 150],
      [null, 1],
      [1, null],
    ];
    for (const [a, b] of casos) {
      const v = variacaoEntre(a, b);
      if (v.fracao !== null) expect(Number.isFinite(v.fracao)).toBe(true);
      if (v.delta !== null) expect(Number.isFinite(v.delta)).toBe(true);
    }
  });
});

describe("ordenarHistorico", () => {
  it("mais recente primeiro, turno alto primeiro dentro do ano", () => {
    const r = ordenarHistorico([
      cand({ ano: 2018 }),
      cand({ ano: 2022, sq: "a", turno: 1 }),
      cand({ ano: 2022, sq: "b", turno: 2 }),
    ]);
    expect(r.map((c) => `${c.ano}-${c.turno}`)).toEqual(["2022-2", "2022-1", "2018-1"]);
  });
});

describe("agruparPorAno", () => {
  it("colapsa dois registros do mesmo ano num representante", () => {
    const g = agruparPorAno([
      cand({ ano: 2022, sq: "a", turno: 1 }),
      cand({ ano: 2022, sq: "b", turno: 2 }),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].representante.sq).toBe("b");
    expect(g[0].outras).toHaveLength(1);
  });

  it("no empate de turno prefere quem tem patrimônio declarado", () => {
    const g = agruparPorAno([
      cand({ ano: 2022, sq: "a", bensTotal: null }),
      cand({ ano: 2022, sq: "b", bensTotal: 10 }),
    ]);
    expect(g[0].representante.sq).toBe("b");
  });
});

describe("serieBens", () => {
  it("ordena crescente e preserva o null", () => {
    const s = serieBens([
      cand({ ano: 2022, bensTotal: 300 }),
      cand({ ano: 2014, bensTotal: null }),
      cand({ ano: 2018, bensTotal: 0 }),
    ]);
    expect(s.map((p) => p.ano)).toEqual([2014, 2018, 2022]);
    expect(s[0].total).toBeNull();
    expect(s[1].total).toBe(0);
  });
});

describe("anotarVariacoes", () => {
  it("compara com a imediatamente anterior", () => {
    const r = anotarVariacoes([
      cand({ ano: 2018, bensTotal: 200 }),
      cand({ ano: 2022, bensTotal: 500 }),
    ]);
    expect(r[0].ano).toBe(2022);
    expect(r[0].variacao.delta).toBe(300);
    expect(r[0].variacao.fracao).toBeCloseTo(1.5);
  });

  it("ano anterior sem dado não faz pular para um ano mais antigo", () => {
    const r = anotarVariacoes([
      cand({ ano: 2014, bensTotal: 100 }),
      cand({ ano: 2018, bensTotal: null }),
      cand({ ano: 2022, bensTotal: 900 }),
    ]);
    expect(r[0].ano).toBe(2022);
    expect(r[0].variacao.motivo).toBe("anterior-ausente");
    expect(r[0].variacao.fracao).toBeNull();
  });

  it("a candidatura mais antiga não tem com o que comparar", () => {
    const r = anotarVariacoes([cand({ ano: 2018 }), cand({ ano: 2022 })]);
    expect(r.at(-1)!.variacao.motivo).toBe("sem-anterior");
  });

  it("marca quantos outros registros existem no mesmo ano", () => {
    const r = anotarVariacoes([
      cand({ ano: 2022, sq: "a", turno: 1 }),
      cand({ ano: 2022, sq: "b", turno: 2 }),
    ]);
    expect(r[0].outrasNoMesmoAno).toBe(1);
  });
});

describe("barrasPatrimonio", () => {
  it("separa ausente de zero", () => {
    const b = barrasPatrimonio([
      { ano: 2014, total: null },
      { ano: 2018, total: 0 },
      { ano: 2022, total: 100 },
    ]);
    expect(b[0]).toMatchObject({ ausente: true, zero: false, alturaPct: 0 });
    expect(b[1]).toMatchObject({ ausente: false, zero: true, alturaPct: 0 });
    expect(b[2]).toMatchObject({ ausente: false, zero: false, alturaPct: 100 });
  });

  it("dá altura mínima visível a valores muito pequenos", () => {
    const b = barrasPatrimonio([
      { ano: 2018, total: 1 },
      { ano: 2022, total: 1_000_000 },
    ]);
    expect(b[0].alturaPct).toBe(4);
  });

  it("tudo nulo não divide por zero", () => {
    const b = barrasPatrimonio([{ ano: 2018, total: null }]);
    expect(Number.isFinite(b[0].alturaPct)).toBe(true);
    expect(b[0].alturaPct).toBe(0);
  });

  it("valor negativo não gera altura negativa", () => {
    const b = barrasPatrimonio([
      { ano: 2018, total: -5 },
      { ano: 2022, total: 10 },
    ]);
    expect(b[0].alturaPct).toBe(0);
  });
});

describe("candidaturaComparacaoPadrao", () => {
  it("escolhe a anterior mais próxima", () => {
    const rows = [cand({ ano: 2014 }), cand({ ano: 2018 }), cand({ ano: 2022 })];
    expect(candidaturaComparacaoPadrao(rows, 2022)?.ano).toBe(2018);
  });

  it("sem anterior, oferece a posterior mais próxima", () => {
    const rows = [cand({ ano: 2018 }), cand({ ano: 2022 })];
    expect(candidaturaComparacaoPadrao(rows, 2018)?.ano).toBe(2022);
  });

  it("candidatura única não tem comparação", () => {
    expect(candidaturaComparacaoPadrao([cand({ ano: 2022 })], 2022)).toBeNull();
  });
});

describe("diffCategorias", () => {
  it("categoria só de um lado aparece com zero do outro", () => {
    const r = diffCategorias(
      [{ categoria: "imoveis", total: 100, quantidade: 1 }],
      [{ categoria: "veiculos", total: 50, quantidade: 1 }],
    );
    expect(r.map((l) => [l.categoria, l.totalA, l.totalB])).toEqual([
      ["imoveis", 100, 0],
      ["veiculos", 0, 50],
    ]);
  });

  it("respeita a ordem fixa, não a ordem da entrada", () => {
    const r = diffCategorias(
      [
        { categoria: "outros", total: 1, quantidade: 1 },
        { categoria: "imoveis", total: 1, quantidade: 1 },
      ],
      [{ categoria: "dinheiro", total: 1, quantidade: 1 }],
    );
    expect(r.map((l) => l.categoria)).toEqual(["imoveis", "dinheiro", "outros"]);
  });

  it("categoria nova (base zero) não vira porcentagem", () => {
    const r = diffCategorias([], [{ categoria: "imoveis", total: 500, quantidade: 1 }]);
    expect(r[0].variacao).toEqual({ delta: 500, fracao: null, motivo: "anterior-zero" });
  });

  it("dois lados vazios devolvem vazio", () => {
    expect(diffCategorias([], [])).toEqual([]);
  });
});
