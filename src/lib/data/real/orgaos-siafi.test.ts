import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Catálogo SIAFI e atividade dos órgãos, retomáveis: uma página (ou um
// órgão) por passo, cursor em `importacao_varredura`, orçamento de tempo e
// de custo, e a linha de rodada com `resultado` no Histórico. Banco, Portal e
// checkpoint são mocks.
// ---------------------------------------------------------------------------

const inseridas: Record<string, unknown>[] = [];
const upserts: Record<string, unknown>[][] = [];
const atualizacoes: { valores: Record<string, unknown>; cod: string }[] = [];
const checkpoints = new Map<string, { cursor: number; total: number; completa: boolean }>();
let catalogo: string[] = [];
let consultasDoCatalogo: unknown[][] = [];
const portalGet = vi.fn();
const codigosComDados = vi.fn();

function from(tabela: string) {
  const filtros: unknown[][] = [];
  let valores: Record<string, unknown> = {};
  const q: Record<string, unknown> = {};
  for (const m of ["select", "not", "order"]) {
    q[m] = (...args: unknown[]) => {
      filtros.push([m, ...args]);
      return q;
    };
  }
  q.eq = (col: string, valor: unknown) => {
    filtros.push(["eq", col, valor]);
    if (tabela === "orgaos_cache" && col === "cod") {
      atualizacoes.push({ valores, cod: String(valor) });
      return Promise.resolve({ error: null });
    }
    return q;
  };
  q.update = (v: Record<string, unknown>) => {
    valores = v;
    return q;
  };
  q.range = async (de: number, ate: number) => {
    consultasDoCatalogo.push(filtros);
    return { data: catalogo.slice(de, ate + 1).map((cod) => ({ cod })), error: null };
  };
  q.upsert = async (linhas: Record<string, unknown>[]) => {
    upserts.push(linhas);
    return { error: null };
  };
  q.insert = async (linhas: Record<string, unknown> | Record<string, unknown>[]) => {
    if (tabela === "importacoes") inseridas.push(...(Array.isArray(linhas) ? linhas : [linhas]));
    return { error: null };
  };
  return q;
}

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from } }));
vi.mock("@/lib/data/real/portal-client", () => ({ PORTAL_BASE: "https://portal.test", portalGet }));
vi.mock("@/lib/data/status.server", () => ({ codigosComDados }));
vi.mock("@/lib/data/checkpoint.server", () => ({
  checkpointImportacao: {
    ler: async (chave: string) => checkpoints.get(chave) ?? null,
    salvar: async (chave: string, estado: { cursor: number; total: number; completa: boolean }) => {
      checkpoints.set(chave, estado);
      return { persistido: true, erro: null };
    },
  },
}));

const {
  rodadaCatalogoSiafi,
  rodadaAtividadeOrgaos,
  orgaosAtivosDoCatalogo,
  sincronizarCatalogoSiafiSchema,
  verificarAtividadeSchema,
} = await import("./orgaos-siafi.functions");

const linhaDeRodada = () => inseridas.filter((l) => !l.log_kind);

beforeEach(() => {
  inseridas.length = 0;
  upserts.length = 0;
  atualizacoes.length = 0;
  checkpoints.clear();
  catalogo = [];
  consultasDoCatalogo = [];
  portalGet.mockReset();
  codigosComDados.mockReset();
  codigosComDados.mockResolvedValue([]);
});

describe("catálogo SIAFI — rodada retomável", () => {
  const params = () => sincronizarCatalogoSiafiSchema.parse({ delayMs: 0 });

  it("grava cada página ao ler, ignora os inválidos e termina na página vazia", async () => {
    portalGet
      .mockResolvedValueOnce([
        { codigo: "26000", descricao: "Ministério da Educação - Unidades com vínculo direto" },
        { codigo: "99999", descricao: "CODIGO INVALIDO" },
      ])
      .mockResolvedValueOnce([{ codigo: "36000", descricao: "Ministério da Saúde" }])
      .mockResolvedValueOnce([]);
    const r = await rodadaCatalogoSiafi(params(), null, {
      gatilho: "ferramenta",
      execucaoId: "exec-1",
    });
    expect(r).toMatchObject({ importados: 2, invalidos: 1, totalBruto: 3 });
    expect(r.varredura).toMatchObject({ haMais: false, cursor: 2, totalAcumulado: 2 });
    expect(upserts).toEqual([
      [{ cod: "26000", nome: "Ministério da Educação" }],
      [{ cod: "36000", nome: "Ministério da Saúde" }],
    ]);
    expect(linhaDeRodada()).toEqual([
      expect.objectContaining({
        fonte: "orgaos_siafi",
        escopo: "nomes",
        importados: 2,
        resultado: "com_dados",
        gatilho: "ferramenta",
        execucao_id: "exec-1",
      }),
    ]);
  });

  it("retoma do cursor gravado: a rodada seguinte pede a página seguinte", async () => {
    checkpoints.set("orgaos_siafi#nomes", { cursor: 40, total: 500, completa: false });
    portalGet.mockResolvedValueOnce([]);
    const r = await rodadaCatalogoSiafi(params(), null);
    expect(portalGet).toHaveBeenCalledWith("/orgaos-siafi", { pagina: "41" });
    expect(r.varredura).toMatchObject({ haMais: false, totalAcumulado: 500 });
  });

  it("para no teto de custo e devolve haMais", async () => {
    portalGet.mockResolvedValue([{ codigo: "26000", descricao: "MEC" }]);
    const r = await rodadaCatalogoSiafi(params(), null);
    expect(r.varredura).toMatchObject({ haMais: true, custoEsgotado: true });
    expect(checkpoints.get("orgaos_siafi#nomes")).toMatchObject({ completa: false });
  });

  it("429 persistente interrompe sem avançar: a rodada é da origem", async () => {
    portalGet.mockRejectedValueOnce(new Error("TRANSIENT: Portal 429 (serviço indisponível)"));
    const r = await rodadaCatalogoSiafi(params(), null);
    expect(r.varredura).toMatchObject({ haMais: true, cursor: 0 });
    expect(r.erros).toEqual(["p1: TRANSIENT: Portal 429 (serviço indisponível)"]);
    expect(linhaDeRodada()[0]).toMatchObject({ resultado: "erro_origem" });
  });
});

describe("atividade dos órgãos — rodada retomável", () => {
  const params = () => verificarAtividadeSchema.parse({ delayMs: 0 });

  it("sonda o catálogo e os órgãos com dados, um por passo, e grava ativo/inativo", async () => {
    catalogo = ["26000", "36000"];
    codigosComDados.mockResolvedValue(["20101", "26000"]);
    // 20101: execução no ano corrente pela árvore; 26000: nada em nenhum
    // ano (4 consultas); 36000: execução no ano anterior pelo próprio órgão.
    portalGet
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{}]);
    const r = await rodadaAtividadeOrgaos(params(), null);
    expect(r).toMatchObject({ verificados: 3, ativos: 2, inativos: 1, total: 3 });
    expect(r.varredura).toMatchObject({ haMais: false, cursor: 3 });
    expect(atualizacoes.map((a) => [a.cod, a.valores.ativo])).toEqual([
      ["20101", true],
      ["26000", false],
      ["36000", true],
    ]);
    const anoAtual = new Date().getFullYear();
    expect(atualizacoes[2].valores.ano_ultima_despesa).toBe(anoAtual - 1);
    expect(linhaDeRodada()[0]).toMatchObject({
      fonte: "orgaos_siafi",
      escopo: "atividade",
      importados: 3,
      resultado: "com_dados",
    });
  });

  it("retoma no órgão seguinte ao último verificado", async () => {
    catalogo = ["20101", "26000", "36000"];
    checkpoints.set("orgaos_siafi#atividade", { cursor: 2, total: 2, completa: false });
    portalGet.mockResolvedValue([{}]);
    const r = await rodadaAtividadeOrgaos(params(), null);
    expect(atualizacoes.map((a) => a.cod)).toEqual(["36000"]);
    expect(r.varredura).toMatchObject({ haMais: false, totalAcumulado: 3 });
  });

  it("falha passageira refaz o mesmo órgão na próxima rodada", async () => {
    catalogo = ["26000"];
    portalGet.mockRejectedValueOnce(new Error("TRANSIENT: Portal 503"));
    const r = await rodadaAtividadeOrgaos(params(), null);
    expect(r.varredura).toMatchObject({ haMais: true, cursor: 0 });
    expect(atualizacoes).toEqual([]);
  });

  it("catálogo vazio: termina sem passo", async () => {
    const r = await rodadaAtividadeOrgaos(params(), null);
    expect(r).toMatchObject({ verificados: 0, total: 0 });
    expect(r.varredura.haMais).toBe(false);
    expect(portalGet).not.toHaveBeenCalled();
  });
});

describe("órgãos ativos do catálogo", () => {
  it("só os ativos, cobertos pelo Portal e já sondados, em ordem de código", async () => {
    catalogo = ["26000", "36000"];
    expect(await orgaosAtivosDoCatalogo()).toEqual(["26000", "36000"]);
    expect(consultasDoCatalogo[0]).toEqual(
      expect.arrayContaining([
        ["eq", "ativo", true],
        ["eq", "disponivel_portal", true],
        ["not", "ultima_verificacao_atividade", "is", null],
        ["order", "cod"],
      ]),
    );
  });
});
