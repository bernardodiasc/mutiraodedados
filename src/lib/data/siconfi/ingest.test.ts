import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// A linha de rodada de um relatório do SICONFI casa com a matriz de
// cobertura (tipo × exercício × período) e sai com `resultado` — inclusive
// quando a consulta falha, que não lança no núcleo. Banco e origem são mocks.
// ---------------------------------------------------------------------------
const inserirImportacoes = vi.fn(async (_linha: unknown) => null);

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
const registrarRodadaImportacao = vi.fn(async (_meta: unknown, _rodada: unknown) => null);
vi.mock("@/lib/data/historico.server", () => ({
  inserirImportacoes,
  registrarRodadaImportacao,
}));
const checkpoints = new Map<string, { cursor: number; total: number; completa: boolean }>();
vi.mock("@/lib/data/checkpoint.server", () => ({
  checkpointImportacao: {
    ler: async (chave: string) => checkpoints.get(chave) ?? null,
    salvar: async (chave: string, estado: { cursor: number; total: number; completa: boolean }) => {
      checkpoints.set(chave, estado);
      return { persistido: true, erro: null };
    },
  },
}));

const { rodadaRelatorioSiconfi, rodadaVarreduraSiconfi } = await import("./ingest.functions");

beforeEach(() => {
  inserirImportacoes.mockClear();
  registrarRodadaImportacao.mockClear();
  checkpoints.clear();
  // 400 é definitivo: sem novas tentativas, a consulta falha na hora.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("parâmetro inválido", { status: 400 })),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("SICONFI — linha de rodada", () => {
  it("falha da consulta volta em `erros` e a linha sai com o relatório no escopo", async () => {
    const r = await rodadaRelatorioSiconfi(
      { codIbge: "35", exercicio: 2023, periodo: 3, tipoRelatorio: "RGF" },
      null,
      { gatilho: "ferramenta", execucaoId: "e-1" },
    );
    expect(r.importados).toBe(0);
    expect(r.erros).toEqual([expect.stringContaining("SICONFI API 400")]);
    expect(inserirImportacoes).toHaveBeenCalledWith(
      expect.objectContaining({
        fonte: "siconfi",
        escopo: "RGF",
        orgao_cod: "35",
        ano: 2023,
        mes: 3,
        importados: 0,
        resultado: "erro_nosso",
        gatilho: "ferramenta",
        execucao_id: "e-1",
      }),
    );
  });

  it("o DCA, anual, grava o período 0 — o mesmo da célula da cobertura", async () => {
    await rodadaRelatorioSiconfi({ codIbge: "35", exercicio: 2023, tipoRelatorio: "DCA" }, null);
    expect(inserirImportacoes).toHaveBeenCalledWith(
      expect.objectContaining({ escopo: "DCA", mes: 0, gatilho: "cron", execucao_id: null }),
    );
  });
});

describe("SICONFI — varredura em lote", () => {
  const ANO_TODO = {
    conjunto: "ente" as const,
    codIbge: "35",
    exercicioInicial: 2023,
    exercicioFinal: 2023,
  };

  it("as 10 consultas de um ente num exercício terminam numa rodada, cada uma com a sua linha", async () => {
    const r = await rodadaVarreduraSiconfi(ANO_TODO, null, {
      gatilho: "ferramenta",
      execucaoId: "e-2",
    });
    expect(r.varredura.haMais).toBe(false);
    expect(r.erros).toHaveLength(10);
    // Cada consulta grava a linha que casa com a matriz, na mesma execução.
    expect(inserirImportacoes).toHaveBeenCalledTimes(10);
    for (const [linha] of inserirImportacoes.mock.calls) {
      expect(linha).toMatchObject({
        orgao_cod: "35",
        ano: 2023,
        execucao_id: "e-2",
        consultado_em: expect.any(String),
      });
    }
  });

  it("a linha da rodada leva o conjunto no escopo e ancora o exercício de uma varredura de um ano só", async () => {
    await rodadaVarreduraSiconfi(ANO_TODO, null, { gatilho: "ferramenta", execucaoId: "e-2" });
    expect(registrarRodadaImportacao.mock.calls[0][0]).toMatchObject({
      fonte: "siconfi",
      escopo: "varredura:ente:35",
      orgaoCod: "35",
      ano: 2023,
      mes: 0,
      gatilho: "ferramenta",
      execucaoId: "e-2",
    });
  });

  it("varredura de vários exercícios não ancora célula", async () => {
    await rodadaVarreduraSiconfi({ ...ANO_TODO, exercicioInicial: 2022 }, "admin");
    expect(registrarRodadaImportacao.mock.calls[0][0]).toMatchObject({ ano: null, mes: null });
  });

  it("retoma do cursor depois de uma interrupção", async () => {
    checkpoints.set("siconfi_varredura#ente#2023-2023#35", {
      cursor: 7,
      total: 0,
      completa: false,
    });
    const r = await rodadaVarreduraSiconfi(ANO_TODO, null);
    // Só as consultas 8 a 10: RGF 2, RGF 3 e DCA.
    expect(inserirImportacoes.mock.calls.map(([l]) => (l as { escopo: string }).escopo)).toEqual([
      "RGF",
      "RGF",
      "DCA",
    ]);
    expect(r.varredura).toMatchObject({ haMais: false, cursor: 10 });
  });
});

describe("SICONFI — tamanho da rodada em lote", () => {
  // Relatório do tamanho do RREO de uma UF grande (o 6º bimestre do Pará em
  // 2023 veio com 4.760 linhas): a CPU da rodada cresce com as linhas gravadas.
  const relatorio = (n: number) =>
    JSON.stringify({
      items: Array.from({ length: n }, (_, i) => ({
        exercicio: 2023,
        anexo: "RREO-Anexo 01",
        coluna: "PREVISÃO INICIAL",
        cod_conta: `Conta${i}`,
        conta: "Receitas Correntes",
        valor: 1000 + i,
      })),
      hasMore: false,
    });

  beforeEach(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    vi.mocked(supabaseAdmin.from).mockReturnValue({
      upsert: async () => ({ error: null }),
    } as never);
    let emVoo = 0;
    maxEmVoo = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        emVoo++;
        maxEmVoo = Math.max(maxEmVoo, emVoo);
        await new Promise((r) => setTimeout(r, 1));
        emVoo--;
        const n = url.includes("/rgf") ? 565 : 4760;
        return new Response(relatorio(n), { headers: { "content-type": "application/json" } });
      }),
    );
  });
  let maxEmVoo = 0;

  it("as consultas rodam em paralelo, e a rodada para pelo teto de custo antes de passar de ~90 mil linhas", async () => {
    const r = await rodadaVarreduraSiconfi(
      { conjunto: "ufs", exercicioInicial: 2023, exercicioFinal: 2023 },
      null,
    );
    expect(maxEmVoo).toBeGreaterThan(1);
    expect(r.varredura.custoEsgotado).toBe(true);
    // Em produção, com 3 em paralelo, rodadas de 145 mil e 140 mil linhas
    // derrubaram o Worker; a de 96 mil terminou. As de ~70 mil, em sequência,
    // sempre terminaram.
    expect(r.importados).toBeGreaterThan(60_000);
    expect(r.importados).toBeLessThanOrEqual(90_000);
  });
});
