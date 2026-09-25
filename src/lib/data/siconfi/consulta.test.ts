import { describe, expect, it } from "vitest";
import {
  consultarRelatorio,
  extratoRegistraEntrega,
  formasATentar,
  LIMITE_PAGINA,
  montarConsulta,
  poderesDoEnte,
  PREFIXO_VAZIO_INESPERADO,
  type BuscarSiconfi,
  type ItemExtrato,
} from "./consulta";

const BASE = "https://api.test/siconfi";

/**
 * API falsa: responde como o SICONFI observado em 2026-09-25 — o `/rgf` só
 * devolve linhas quando TODOS os parâmetros batem (sem `in_periodicidade` e
 * `co_poder` a resposta é 200 com zero itens).
 */
function apiFalsa(opts: {
  /** chave `${demonstrativo}|${periodicidade}|${poder}|${periodo}` → nº de linhas (RGF) */
  rgf?: Record<string, number>;
  /** chave `${demonstrativo}|${periodo}` → nº de linhas (RREO) */
  rreo?: Record<string, number>;
  dca?: number;
  extrato?: ItemExtrato[];
}) {
  const chamadas: Array<{ path: string; params: Record<string, string | number> }> = [];
  const pagina = (total: number, params: Record<string, string | number>) => {
    const offset = Number(params.offset ?? 0);
    const n = Math.max(0, Math.min(LIMITE_PAGINA, total - offset));
    return {
      items: Array.from({ length: n }, (_, i) => ({
        anexo: "RGF-Anexo 01",
        cod_conta: `c${offset + i}`,
        coluna: "x",
        valor: 1,
        instituicao: `inst ${params.co_poder ?? ""}`,
      })),
      hasMore: offset + n < total,
    };
  };
  const buscar: BuscarSiconfi = async (path, params) => {
    chamadas.push({ path, params });
    if (path === "/extrato_entregas") return { items: opts.extrato ?? [], hasMore: false } as never;
    if (path === "/rgf") {
      const k = `${params.co_tipo_demonstrativo}|${params.in_periodicidade}|${params.co_poder}|${params.nr_periodo}`;
      return pagina(opts.rgf?.[k] ?? 0, params) as never;
    }
    if (path === "/rreo") {
      const k = `${params.co_tipo_demonstrativo}|${params.nr_periodo}`;
      return pagina(opts.rreo?.[k] ?? 0, params) as never;
    }
    return pagina(opts.dca ?? 0, params) as never;
  };
  return { buscar, chamadas };
}

const RGF_ENTREGUE = (periodo: number, simplificado = false): ItemExtrato => ({
  exercicio: 2024,
  entregavel: `Relatório de Gestão Fiscal${simplificado ? " Simplificado" : ""}`,
  periodo,
  periodicidade: simplificado ? "S" : "Q",
});

describe("poderesDoEnte", () => {
  it("estado: os cinco poderes/órgãos com RGF próprio", () => {
    expect(poderesDoEnte("35")).toEqual(["E", "L", "J", "M", "D"]);
  });
  it("DF: sem Judiciário e MP próprios", () => {
    expect(poderesDoEnte("53")).toEqual(["E", "L", "D"]);
  });
  it("município: Executivo e Legislativo", () => {
    expect(poderesDoEnte("3550308")).toEqual(["E", "L"]);
  });
});

describe("formasATentar", () => {
  it("município grande e estado: só a forma completa", () => {
    expect(formasATentar("RGF", "3550308", 11_900_000).map((f) => f.tipo)).toEqual(["RGF"]);
    expect(formasATentar("RGF", "35", null).map((f) => f.tipo)).toEqual(["RGF"]);
    expect(formasATentar("RREO", "3550308", 11_900_000).map((f) => f.tipo)).toEqual(["RREO"]);
  });
  it("município com menos de 50 mil: completa primeiro, simplificada (semestral) depois", () => {
    const f = formasATentar("RGF", "3500105", 35_673);
    expect(f.map((x) => `${x.tipo}/${x.periodicidade}`)).toEqual(["RGF/Q", "RGF Simplificado/S"]);
    expect(formasATentar("RREO", "3500105", 35_673).map((x) => x.tipo)).toEqual([
      "RREO",
      "RREO Simplificado",
    ]);
  });
  it("população desconhecida: não presume município pequeno", () => {
    expect(formasATentar("RGF", "3500105", null)).toHaveLength(1);
  });
});

describe("montarConsulta", () => {
  it("RGF leva in_periodicidade e co_poder (a API exige os dois)", () => {
    const c = montarConsulta({
      codIbge: "35",
      exercicio: 2024,
      periodo: 3,
      forma: { tipo: "RGF", periodicidade: "Q", periodos: 3 },
      poder: "E",
    });
    expect(c).toEqual({
      path: "/rgf",
      params: {
        an_exercicio: 2024,
        id_ente: "35",
        nr_periodo: 3,
        co_tipo_demonstrativo: "RGF",
        in_periodicidade: "Q",
        co_poder: "E",
      },
    });
  });
  it("RGF sem poder é recusado em vez de consultar e receber vazio", () => {
    expect(() =>
      montarConsulta({
        codIbge: "35",
        exercicio: 2024,
        periodo: 3,
        forma: { tipo: "RGF", periodicidade: "Q" },
      }),
    ).toThrow(/poder/);
  });
});

describe("extratoRegistraEntrega", () => {
  it("casa família, exercício e período", () => {
    const itens = [RGF_ENTREGUE(1), RGF_ENTREGUE(2)];
    expect(extratoRegistraEntrega(itens, "RGF", 2024, 2)).toBe(true);
    expect(extratoRegistraEntrega(itens, "RGF", 2024, 3)).toBe(false);
    expect(extratoRegistraEntrega(itens, "RREO", 2024, 2)).toBe(false);
    expect(extratoRegistraEntrega(itens, "RGF", 2023, 2)).toBe(false);
  });
  it("DCA é anual", () => {
    expect(
      extratoRegistraEntrega([{ exercicio: 2024, entregavel: "Balanço Anual (DCA)" }], "DCA", 2024),
    ).toBe(true);
  });
});

describe("consultarRelatorio", () => {
  const base = { base: BASE, exercicio: 2024 } as const;

  it("estado de SP, RGF 3º quadrimestre: importa os cinco poderes (caso real de 2026-09-25)", async () => {
    const { buscar, chamadas } = apiFalsa({
      rgf: {
        "RGF|Q|E|3": 597,
        "RGF|Q|L|3": 334,
        "RGF|Q|J|3": 430,
        "RGF|Q|M|3": 154,
        "RGF|Q|D|3": 99,
      },
    });
    const r = await consultarRelatorio({
      ...base,
      buscar,
      codIbge: "35",
      periodo: 3,
      tipo: "RGF",
      populacao: null,
    });
    expect(r.tipo).toBe("dados");
    if (r.tipo !== "dados") return;
    expect(r.itens).toHaveLength(597 + 334 + 430 + 154 + 99);
    expect(new Set(r.itens.map((i) => i.poder))).toEqual(new Set(["E", "L", "J", "M", "D"]));
    expect(r.poderesSemDados).toEqual([]);
    expect(chamadas.every((c) => c.params.in_periodicidade === "Q" && c.params.co_poder)).toBe(
      true,
    );
    expect(chamadas.some((c) => c.path === "/extrato_entregas")).toBe(false);
  });

  it("município pequeno que optou pelo semestral: cai para RGF Simplificado/S", async () => {
    const { buscar } = apiFalsa({
      rgf: { "RGF Simplificado|S|E|2": 369, "RGF Simplificado|S|L|2": 135 },
    });
    const r = await consultarRelatorio({
      ...base,
      buscar,
      codIbge: "3500105",
      periodo: 2,
      tipo: "RGF",
      populacao: 35_673,
    });
    expect(r.tipo).toBe("dados");
    if (r.tipo !== "dados") return;
    expect(r.forma.tipo).toBe("RGF Simplificado");
    expect(r.itens).toHaveLength(369 + 135);
  });

  it("município semestral no 3º quadrimestre: sem entrega no extrato → vazio confirmado", async () => {
    const { buscar } = apiFalsa({ extrato: [RGF_ENTREGUE(1, true), RGF_ENTREGUE(2, true)] });
    const r = await consultarRelatorio({
      ...base,
      buscar,
      codIbge: "3500105",
      periodo: 3,
      tipo: "RGF",
      populacao: 35_673,
    });
    expect(r.tipo).toBe("nao_entregue");
  });

  it("resposta vazia com entrega registrada no extrato é erro, nunca vazio confirmado", async () => {
    const { buscar } = apiFalsa({ extrato: [RGF_ENTREGUE(3)] });
    await expect(
      consultarRelatorio({
        ...base,
        buscar,
        codIbge: "3550308",
        periodo: 3,
        tipo: "RGF",
        populacao: 11_900_000,
      }),
    ).rejects.toThrow(PREFIXO_VAZIO_INESPERADO);
  });

  it("Executivo sem RGF mas Legislativo entregue: importa o Legislativo", async () => {
    const { buscar } = apiFalsa({ rgf: { "RGF|Q|L|1": 50 }, extrato: [RGF_ENTREGUE(1)] });
    const r = await consultarRelatorio({
      ...base,
      buscar,
      codIbge: "3550308",
      periodo: 1,
      tipo: "RGF",
      populacao: 11_900_000,
    });
    expect(r.tipo).toBe("dados");
    if (r.tipo !== "dados") return;
    expect(r.itens).toHaveLength(50);
    expect(r.poderesSemDados).toEqual(["E"]);
  });

  it("RREO Simplificado de município pequeno", async () => {
    const { buscar } = apiFalsa({ rreo: { "RREO Simplificado|6": 1785 } });
    const r = await consultarRelatorio({
      ...base,
      buscar,
      codIbge: "3500105",
      periodo: 6,
      tipo: "RREO",
      populacao: 35_673,
    });
    expect(r.tipo === "dados" && r.forma.tipo).toBe("RREO Simplificado");
  });

  it("pagina além de 5.000 itens em vez de truncar", async () => {
    const { buscar, chamadas } = apiFalsa({ rreo: { "RREO|6": LIMITE_PAGINA + 10 } });
    const r = await consultarRelatorio({
      ...base,
      buscar,
      codIbge: "35",
      periodo: 6,
      tipo: "RREO",
      populacao: null,
    });
    expect(r.tipo === "dados" && r.itens.length).toBe(LIMITE_PAGINA + 10);
    expect(chamadas.map((c) => c.params.offset)).toEqual([undefined, LIMITE_PAGINA]);
    expect(r.requisicoes).toBe(2);
  });

  it("DCA vazio sem entrega no extrato → vazio confirmado; com entrega → erro", async () => {
    const semEntrega = apiFalsa({});
    await expect(
      consultarRelatorio({
        ...base,
        buscar: semEntrega.buscar,
        codIbge: "5300108",
        tipo: "DCA",
        populacao: null,
      }),
    ).resolves.toMatchObject({ tipo: "nao_entregue" });

    const comEntrega = apiFalsa({
      extrato: [{ exercicio: 2024, entregavel: "Balanço Anual (DCA)", periodo: 1 }],
    });
    await expect(
      consultarRelatorio({
        ...base,
        buscar: comEntrega.buscar,
        codIbge: "3550308",
        tipo: "DCA",
        populacao: null,
      }),
    ).rejects.toThrow(PREFIXO_VAZIO_INESPERADO);
  });
});
