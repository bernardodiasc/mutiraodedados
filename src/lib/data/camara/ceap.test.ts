import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Varredura da CEAP: um passo por deputado, com cursor salvo entre rodadas.
// Quando a origem não responde nem depois das novas tentativas, o deputado
// não pode ser pulado: a rodada para sem avançar o cursor (a próxima refaz) e
// o Histórico registra falha da origem. Banco (em memória) e origem são mocks.
// ---------------------------------------------------------------------------
const cursorSalvo = vi.fn();
const linhaDeRodada = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: vi.fn((tabela: string) => {
      if (tabela === "camara_deputado_legislaturas") {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({
                data: [{ deputado_id: 1 }, { deputado_id: 2 }],
                error: null,
              }),
            }),
          }),
        };
      }
      if (tabela === "importacao_varredura") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
          upsert: async (linha: unknown) => {
            cursorSalvo(linha);
            return { error: null };
          },
        };
      }
      if (tabela === "camara_despesas_cache") return { upsert: async () => ({ error: null }) };
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
vi.mock("@/lib/data/qa", async (original) => ({
  ...(await original<typeof import("@/lib/data/qa")>()),
  flagQA: vi.fn(async () => undefined),
}));

const { rodadaCEAPMes } = await import("./ingest.functions");

const semDespesas = () => new Response(JSON.stringify({ dados: [] }));

async function rodarComOrigemFalhando(falha: () => Response | Promise<Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => (url.includes("/deputados/1/") ? falha() : semDespesas())),
  );
  const rodada = rodadaCEAPMes({ ano: 2024, mes: 3 }, null);
  await vi.runAllTimersAsync();
  return rodada;
}

beforeEach(() => {
  cursorSalvo.mockClear();
  linhaDeRodada.mockClear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("CEAP da Câmara", () => {
  it("503 persistente num deputado interrompe a rodada sem avançar o cursor e vira erro da origem", async () => {
    const r = await rodarComOrigemFalhando(() => new Response("", { status: 503 }));

    expect(r.erros).toEqual([expect.stringContaining("dep 1:")]);
    expect(r.varredura.haMais).toBe(true);
    expect(r.varredura.cursor).toBe(0);
    expect(cursorSalvo).not.toHaveBeenCalledWith(expect.objectContaining({ cursor: 1 }));
    expect(linhaDeRodada).toHaveBeenCalledWith(
      expect.objectContaining({ fonte: "camara_ceap", resultado: "erro_origem" }),
    );
  });

  it("falha de rede persistente também é da origem, não nossa", async () => {
    const r = await rodarComOrigemFalhando(() => {
      throw new TypeError("fetch failed");
    });

    expect(r.varredura.cursor).toBe(0);
    expect(linhaDeRodada).toHaveBeenCalledWith(
      expect.objectContaining({ fonte: "camara_ceap", resultado: "erro_origem" }),
    );
  });
});
