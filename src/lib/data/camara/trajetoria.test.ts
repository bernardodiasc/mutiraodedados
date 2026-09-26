import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Trajetória dos deputados: cada rodada relê /historico de um lote e regrava
// os eventos de cada deputado. Uma consulta que falha não pode apagar a
// trajetória já gravada, e a falha precisa chegar ao log da rodada. Banco
// (em memória) e origem são mocks.
// ---------------------------------------------------------------------------
type Evento = { deputado_id: number; descricao: string | null };

const eventos: Evento[] = [];
const inserirImportacoes = vi.fn(async (_linha: unknown) => null);

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
      if (tabela === "camara_deputado_eventos") {
        return {
          delete: () => ({
            in: async (_coluna: string, ids: number[]) => {
              for (let i = eventos.length - 1; i >= 0; i--)
                if (ids.includes(eventos[i].deputado_id)) eventos.splice(i, 1);
              return { error: null };
            },
          }),
          insert: async (linhas: Evento[]) => {
            eventos.push(...linhas);
            return { error: null };
          },
        };
      }
      throw new Error(`tabela inesperada no teste: ${tabela}`);
    }),
  },
}));
vi.mock("@/lib/data/historico.server", () => ({
  inserirImportacoes,
  registrarRodadaImportacao: vi.fn(),
}));

const { rodadaTrajetoriaCamara } = await import("./ingest.functions");

const historico = (descricao: string) =>
  new Response(
    JSON.stringify({
      dados: [{ idLegislatura: 56, situacao: "Exercício", descricaoStatus: descricao }],
    }),
  );

beforeEach(() => {
  eventos.splice(
    0,
    eventos.length,
    { deputado_id: 1, descricao: "antigo 1" },
    { deputado_id: 2, descricao: "antigo 2" },
  );
  inserirImportacoes.mockClear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("trajetória da Câmara", () => {
  it("falha da origem num deputado mantém os eventos dele e vira erro da origem na rodada", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("/deputados/2/") ? new Response("", { status: 503 }) : historico("novo 1"),
      ),
    );
    const rodada = rodadaTrajetoriaCamara({ idLegislatura: 56, offset: 0 }, null);
    await vi.runAllTimersAsync();
    const r = await rodada;

    expect(eventos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ deputado_id: 1, descricao: "novo 1" }),
        expect.objectContaining({ deputado_id: 2, descricao: "antigo 2" }),
      ]),
    );
    expect(eventos).toHaveLength(2);
    expect(r.erros).toEqual([expect.stringContaining("deputado 2")]);
    // Falha passageira: a próxima rodada refaz o mesmo lote.
    expect(r.proximoOffset).toBe(0);
    expect(inserirImportacoes).toHaveBeenCalledWith(
      expect.objectContaining({ fonte: "camara_trajetoria", resultado: "erro_origem" }),
    );
  });

  it("lista vazia da origem é resposta, não falha: apaga os eventos do deputado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("/deputados/2/")
          ? new Response(JSON.stringify({ dados: [] }))
          : historico("novo 1"),
      ),
    );
    const r = await rodadaTrajetoriaCamara({ idLegislatura: 56, offset: 0 }, null);

    expect(eventos).toEqual([expect.objectContaining({ deputado_id: 1, descricao: "novo 1" })]);
    expect(r.erros).toEqual([]);
    expect(inserirImportacoes).toHaveBeenCalledWith(
      expect.objectContaining({ resultado: "com_dados", importados: 2 }),
    );
  });
});
