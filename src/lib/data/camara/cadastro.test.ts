import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Cadastro de deputados de uma legislatura: chamada única que grava a linha
// de rodada com `resultado` e devolve o total da origem (`X-Total-Count`),
// com as repetições da listagem contadas como descartadas. Banco e origem
// são mocks.
// ---------------------------------------------------------------------------
const inserirImportacoes = vi.fn(async (_linha: unknown) => null);
const upsert = vi.fn(async () => ({ error: null }));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: vi.fn(() => ({ upsert })) },
}));
vi.mock("@/lib/data/historico.server", () => ({
  inserirImportacoes,
  registrarRodadaImportacao: vi.fn(),
}));

const { rodadaCadastroCamara } = await import("./ingest.functions");

const deputado = (id: number) => ({ id, nome: `Deputado ${id}`, siglaPartido: "X", siglaUf: "SP" });

beforeEach(() => {
  inserirImportacoes.mockClear();
  upsert.mockClear();
});

afterEach(() => vi.unstubAllGlobals());

describe("cadastro da Câmara", () => {
  it("titular e suplente repetidos contam como descartados no total da origem", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ dados: [deputado(1), deputado(2), deputado(1)] }), {
            headers: { "x-total-count": "3" },
          }),
      ),
    );
    const r = await rodadaCadastroCamara({ idLegislatura: 56 }, null, {
      gatilho: "ferramenta",
      execucaoId: "e-1",
    });
    expect(r).toEqual({
      importados: 2,
      legislatura: 56,
      erros: [],
      origem: { total: 3, descartados: 1 },
    });
    expect(inserirImportacoes).toHaveBeenCalledWith(
      expect.objectContaining({
        fonte: "camara_deputados",
        escopo: "legislatura 56",
        importados: 2,
        resultado: "com_dados",
        gatilho: "ferramenta",
        execucao_id: "e-1",
      }),
    );
  });

  it("falha da origem não lança: volta em `erros` e a linha registra a falha", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 404 })),
    );
    const r = await rodadaCadastroCamara({ idLegislatura: 56 }, null);
    expect(r.erros).toEqual([expect.stringContaining("Câmara API 404")]);
    expect(r.origem).toBeNull();
    expect(inserirImportacoes).toHaveBeenCalledWith(
      expect.objectContaining({ importados: 0, resultado: "erro_nosso", gatilho: "cron" }),
    );
  });

  it("rede fora do ar depois das novas tentativas é falha da origem, não nossa", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const rodada = rodadaCadastroCamara({ idLegislatura: 56 }, null);
    await vi.runAllTimersAsync();
    const r = await rodada;
    vi.useRealTimers();
    expect(r.erros).toEqual([expect.stringMatching(/^TRANSIENT: /)]);
    expect(inserirImportacoes).toHaveBeenCalledWith(
      expect.objectContaining({ importados: 0, resultado: "erro_origem" }),
    );
  });
});
