import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Varredura de proposições: o cursor é a proposição, e a listagem é buscada
// por página. Se a origem não entrega a página nem depois das novas
// tentativas, a varredura não pode ser encerrada como se tivesse terminado:
// a rodada para sem avançar (a próxima refaz) e o Histórico registra falha da
// origem. Banco (em memória) e origem são mocks.
// ---------------------------------------------------------------------------
const linhaDeRodada = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: vi.fn((tabela: string) => {
      if (tabela === "importacao_varredura") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
          upsert: async () => ({ error: null }),
        };
      }
      if (tabela === "importacoes") {
        return {
          insert: async (linha: unknown) => {
            linhaDeRodada(linha);
            return { error: null };
          },
        };
      }
      throw new Error(`tabela inesperada no teste: ${tabela}`);
    }),
  },
}));

const { rodadaProposicoes } = await import("./proposicoes.functions");

beforeEach(() => {
  linhaDeRodada.mockClear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("proposições da Câmara", () => {
  it("503 persistente na listagem interrompe a rodada sem encerrar a varredura e vira erro da origem", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 503 })),
    );
    const rodada = rodadaProposicoes({ ano: 2024, siglaTipo: "PL", maxPaginas: 1 }, null);
    await vi.runAllTimersAsync();
    const r = await rodada;

    expect(r.erros).toEqual([expect.stringContaining("lista p1:")]);
    expect(r.varredura.haMais).toBe(true);
    expect(r.varredura.cursor).toBe(0);
    expect(linhaDeRodada).toHaveBeenCalledWith(
      expect.objectContaining({ fonte: "camara_props", resultado: "erro_origem" }),
    );
  });
});
