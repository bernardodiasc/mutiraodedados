import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Rodada de emendas: a pré-busca do plano de ação (API do Transferegov) conta
// no orçamento de tempo da rodada. A varredura do Portal e a API são mocks.
// ---------------------------------------------------------------------------

const varrerPaginado = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/data/real/sweep", async (original) => ({
  ...(await original<typeof import("@/lib/data/real/sweep")>()),
  sleep: async () => {},
  varrerPaginado,
}));

const { rodadaEmendas } = await import("./emendas.functions");

const PARAMS = { ano: 2023, maxPaginas: 5000, delayMs: 800, orcamentoMs: 180_000 };

/** Página do plano de ação com `n` itens. */
const pagina = (n: number) =>
  new Response(
    JSON.stringify(
      Array.from({ length: n }, (_, i) => ({ numero_emenda_parlamentar_plano_acao: `E${i}` })),
    ),
    { status: 200, headers: { "content-type": "application/json" } },
  );

let relogio = 0;

beforeEach(() => {
  relogio = 1_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => relogio);
  varrerPaginado.mockReset();
  varrerPaginado.mockResolvedValue({});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("rodadaEmendas — pré-busca no orçamento", () => {
  it("a varredura fica com o orçamento menos o tempo da pré-busca", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        relogio += 20_000;
        return pagina(10); // página menor que o limite: a lista acabou
      }),
    );
    await rodadaEmendas(PARAMS, null, { gatilho: "ferramenta", execucaoId: "e" });
    expect(varrerPaginado).toHaveBeenCalledWith(
      expect.objectContaining({
        orcamentoMs: 160_000,
        avisos: [],
        escopo: "",
        ano: 2023,
        mes: 1,
        origem: { gatilho: "ferramenta", execucaoId: "e" },
      }),
    );
  });

  it("a pré-busca para na metade do orçamento e avisa que o detalhe ficou incompleto", async () => {
    const fetch = vi.fn(async () => {
      relogio += 40_000;
      return pagina(500); // sempre cheia: sem o prazo, iria até 80 páginas
    });
    vi.stubGlobal("fetch", fetch);
    await rodadaEmendas(PARAMS, null);
    // 40 s, 80 s, 120 s: a terceira passa do prazo de 90 s e a quarta não sai.
    expect(fetch).toHaveBeenCalledTimes(3);
    const opts = varrerPaginado.mock.calls[0][0];
    expect(opts.orcamentoMs).toBe(60_000);
    expect(opts.avisos).toEqual([expect.stringMatching(/^info: plano de ação .* incompleto/)]);
  });
});
