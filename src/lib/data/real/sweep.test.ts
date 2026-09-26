import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Linha de rodada das varreduras do Portal (`varrerPaginado`). Ela marca a
// célula da cobertura e é o que a conferência da janela lê: precisa sair com
// `resultado`, `ano`/`mes`, o escopo da linha da matriz, o gatilho e a
// execução. Banco e Portal são mocks.
// ---------------------------------------------------------------------------

const inseridas: Record<string, unknown>[] = [];
const portalGet = vi.fn();

function from(tabela: string) {
  const q = {
    select: () => q,
    eq: () => q,
    maybeSingle: async () => ({ data: null, error: null }),
    upsert: async () => ({ error: null }),
    insert: async (linhas: Record<string, unknown> | Record<string, unknown>[]) => {
      if (tabela === "importacoes") inseridas.push(...(Array.isArray(linhas) ? linhas : [linhas]));
      return { error: null };
    },
  };
  return q;
}

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from } }));
vi.mock("@/lib/data/real/portal-client", () => ({
  PORTAL_BASE: "https://portal.test",
  portalGet,
}));
vi.mock("@/lib/data/qa", () => ({ flagQA: vi.fn() }));

const { varrerPaginado } = await import("./sweep");

type Item = { id: number };

function opcoes(parcial: Record<string, unknown> = {}) {
  return {
    entidade: "licitacoes",
    fonte: "cgu_licitacoes",
    endpoint: "/licitacoes",
    orgaoCodLog: "26000",
    escopo: "26000",
    ano: 2024,
    mes: 3,
    userId: null,
    varreduraKey: "licitacoes#26000#2024-03-01#2024-03-31",
    tamPagina: 15,
    maxPaginas: 100,
    delayMs: 0,
    orcamentoMs: 60_000,
    montarParams: (pagina: number) => ({ pagina: String(pagina) }),
    mapPagina: (list: Item[]) => list,
    upsertBatch: async () => [],
    ...parcial,
  };
}

/** A linha de rodada: a única sem `log_kind` (as de requisição têm). */
const linhaDeRodada = () => inseridas.filter((l) => !l.log_kind);

beforeEach(() => {
  inseridas.length = 0;
  portalGet.mockReset();
});

describe("varrerPaginado — linha de rodada", () => {
  it("grava resultado, ano/mês, escopo, gatilho e execução", async () => {
    portalGet.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);
    const r = await varrerPaginado<Item, Item>(
      opcoes({ origem: { gatilho: "ferramenta", execucaoId: "exec-1" } }),
    );
    expect(r).toMatchObject({ processados: 2, cursor: 1, haMais: false, completa: true });
    expect(linhaDeRodada()).toEqual([
      expect.objectContaining({
        fonte: "cgu_licitacoes",
        escopo: "26000",
        orgao_cod: "26000",
        ano: 2024,
        mes: 3,
        importados: 2,
        resultado: "com_dados",
        gatilho: "ferramenta",
        execucao_id: "exec-1",
        erros: [],
      }),
    ]);
  });

  it("sem operador e sem ferramenta, o gatilho é o cron; vazio em mês antigo é sem_dados", async () => {
    portalGet.mockResolvedValueOnce([]);
    await varrerPaginado<Item, Item>(opcoes());
    expect(linhaDeRodada()[0]).toMatchObject({
      gatilho: "cron",
      execucao_id: null,
      importados: 0,
      resultado: "sem_dados",
    });
  });

  it("falha passageira do Portal interrompe a rodada e classifica como erro da origem", async () => {
    portalGet.mockRejectedValueOnce(new Error("TRANSIENT: Portal 429 (serviço indisponível)"));
    const r = await varrerPaginado<Item, Item>(opcoes());
    expect(r).toMatchObject({ haMais: true, orcamentoEsgotado: false });
    expect(r.erros).toEqual(["p1: TRANSIENT: Portal 429 (serviço indisponível)"]);
    expect(linhaDeRodada()[0]).toMatchObject({ resultado: "erro_origem" });
  });

  it("avisos de quem chamou vão para a linha, sem virar erro", async () => {
    portalGet.mockResolvedValueOnce([{ id: 1 }]);
    const r = await varrerPaginado<Item, Item>(opcoes({ avisos: ["info: detalhe incompleto"] }));
    expect(r.avisos).toEqual(["info: detalhe incompleto"]);
    expect(linhaDeRodada()[0]).toMatchObject({
      resultado: "com_dados",
      erros: ["info: detalhe incompleto"],
    });
  });
});
