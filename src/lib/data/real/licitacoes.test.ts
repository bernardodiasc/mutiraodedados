import { describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Rodada de licitações: a linha gravada leva o órgão pedido, como nos
// contratos. A conferência conta a célula pelo órgão da janela; gravar o órgão
// máximo da unidade gestora (26000, para uma universidade 26231) deixava a
// célula vazia e reprovava o reflexo na cobertura.
// ---------------------------------------------------------------------------

const varrerPaginado = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/data/real/sweep", async (original) => ({
  ...(await original<typeof import("@/lib/data/real/sweep")>()),
  varrerPaginado,
}));

const { rodadaLicitacoes } = await import("./licitacoes.functions");

describe("rodada de licitações", () => {
  it("grava o órgão pedido, não o órgão máximo da unidade gestora", async () => {
    await rodadaLicitacoes(
      {
        codigoOrgao: "26231",
        dataInicial: "2024-03-01",
        dataFinal: "2024-03-31",
        maxPaginas: 5000,
        delayMs: 0,
        orcamentoMs: 150_000,
      },
      null,
    );
    const { mapPagina } = varrerPaginado.mock.calls[0][0];
    const push = { finding: vi.fn() };
    const [linha] = mapPagina(
      [
        {
          id: 1,
          dataAbertura: "15/03/2024",
          unidadeGestora: {
            nome: "UNIVERSIDADE FEDERAL",
            orgaoMaximo: { codigo: "26000" },
            orgaoVinculado: { codigoSIAFI: "26231" },
          },
        },
      ],
      1,
      push,
    );
    expect(linha).toMatchObject({ orgao_cod: "26231", ano: 2024, mes_referencia: 3 });
  });
});
