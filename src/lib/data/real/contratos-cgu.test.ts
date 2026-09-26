import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Núcleo dos contratos da CGU por órgão (`rodadaContratosCgu`): a janela de
// vigência guarda só o início no mês, a linha de rodada casa com a célula
// órgão × mês da cobertura, o teto de custo corta a rodada e a falha
// passageira de um detalhe refaz a página. Banco e Portal são mocks.
// ---------------------------------------------------------------------------

const inseridas: Record<string, unknown>[] = [];
const contratosGravados: Record<string, unknown>[] = [];
const varredura = new Map<string, Record<string, unknown>>();
const portalGet = vi.fn();
const portalGetComTexto = vi.fn();

function from(tabela: string) {
  let chave: string | null = null;
  const q: Record<string, unknown> = {
    select: () => q,
    eq: (_col: string, valor: string) => {
      chave = valor;
      return q;
    },
    maybeSingle: async () => ({
      data: tabela === "cgu_varredura" && chave ? (varredura.get(chave) ?? null) : null,
      error: null,
    }),
    upsert: async (linhas: Record<string, unknown> | Record<string, unknown>[]) => {
      const lista = Array.isArray(linhas) ? linhas : [linhas];
      if (tabela === "contratos_cache") contratosGravados.push(...lista);
      if (tabela === "cgu_varredura") for (const l of lista) varredura.set(String(l.orgao_cod), l);
      return { error: null };
    },
    insert: async (linhas: Record<string, unknown> | Record<string, unknown>[]) => {
      if (tabela === "importacoes") inseridas.push(...(Array.isArray(linhas) ? linhas : [linhas]));
      return { error: null };
    },
  };
  return q;
}

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from } }));
vi.mock("@/lib/data/real/portal-client", async (original) => ({
  ...(await original<typeof import("@/lib/data/real/portal-client")>()),
  PORTAL_BASE: "https://portal.test",
  portalGet,
  portalGetComTexto,
}));
vi.mock("@/lib/data/qa", async (original) => ({
  ...(await original<typeof import("@/lib/data/qa")>()),
  flagQA: vi.fn(),
  sincronizarQaCgu: vi.fn(),
}));

const { rodadaContratosCgu, importarContratosCguSchema } = await import("./portal.functions");
const { TETO_SUBREQUISICOES_PORTAL } = await import("./sweep");

const MARCO = { codigoOrgao: "26000", dataInicial: "2024-03-01", dataFinal: "2024-03-31" };
const params = (parcial: Record<string, unknown> = {}) =>
  importarContratosCguSchema.parse({ ...MARCO, delayMs: 0, ...parcial });

/** Contrato cru da listagem, com início de vigência no dia dado. */
const contrato = (id: number, inicio = "2024-03-10") => ({
  id,
  numero: `N${id}`,
  objeto: "Serviço",
  dataAssinatura: inicio,
  dataInicioVigencia: inicio,
  valorInicialCompra: 100,
  valorFinalCompra: 100,
  fornecedor: { cnpjFormatado: "00.000.000/0001-00", nome: "Fornecedor" },
});

const detalhe = { data: { valorInicialCompra: 100, valorFinalCompra: 100 }, rawText: "{}" };
const linhaDeRodada = () => inseridas.filter((l) => !l.log_kind);

beforeEach(() => {
  inseridas.length = 0;
  contratosGravados.length = 0;
  varredura.clear();
  portalGet.mockReset();
  portalGetComTexto.mockReset();
  portalGetComTexto.mockResolvedValue(detalhe);
});

describe("contratos da CGU — rodada de um órgão num mês", () => {
  it("guarda só o início de vigência no mês e marca a célula órgão × mês", async () => {
    portalGet.mockResolvedValueOnce([contrato(1), contrato(2, "2024-02-20")]);
    const r = await rodadaContratosCgu(params(), null, {
      gatilho: "ferramenta",
      execucaoId: "exec-1",
    });
    expect(r).toMatchObject({ processados: 1, haMais: false, completa: true, cursor: 1 });
    // Só o contrato mantido custou um detalhe.
    expect(portalGetComTexto).toHaveBeenCalledTimes(1);
    expect(contratosGravados.map((c) => c.id)).toEqual(["1"]);
    expect(linhaDeRodada()).toEqual([
      expect.objectContaining({
        fonte: "cgu",
        escopo: "26000",
        orgao_cod: "26000",
        ano: 2024,
        mes: 3,
        importados: 1,
        resultado: "com_dados",
        gatilho: "ferramenta",
        execucao_id: "exec-1",
        data_inicial: "2024-03-01",
        data_final: "2024-03-31",
      }),
    ]);
    // A varredura da janela fica completa na chave legada dos contratos.
    expect(varredura.get("26000#2024-03-01#2024-03-31")).toMatchObject({ completa: true });
  });

  it("mês sem contratos: rodada vazia com resultado legítimo", async () => {
    portalGet.mockResolvedValueOnce([]);
    const r = await rodadaContratosCgu(params(), null);
    expect(r).toMatchObject({ processados: 0, haMais: false });
    expect(linhaDeRodada()[0]).toMatchObject({ resultado: "sem_dados", gatilho: "cron" });
  });

  it("para no teto de custo: um detalhe por contrato conta como subrequisição", async () => {
    portalGet.mockImplementation(async () => Array.from({ length: 15 }, (_, i) => contrato(i)));
    const r = await rodadaContratosCgu(params(), null);
    expect(r.custoEsgotado).toBe(true);
    expect(r.haMais).toBe(true);
    // Cada página cheia custa 1 listagem + 15 detalhes + as gravações.
    const paginas = portalGet.mock.calls.length;
    expect(paginas).toBeGreaterThan(1);
    expect(paginas * 16).toBeLessThanOrEqual(TETO_SUBREQUISICOES_PORTAL);
    expect(r.cursor).toBe(paginas);
    expect(r.avisos.join(" ")).toMatch(/teto de subrequisições/);
    expect(linhaDeRodada()[0].endpoint).toMatch(/teto de subrequisições/);
  });

  it("retoma do cursor: a rodada seguinte começa na página depois da última", async () => {
    varredura.set("26000#2024-03-01#2024-03-31", {
      ultima_pagina: 4,
      completa: false,
      total_importado: 60,
    });
    portalGet.mockResolvedValueOnce([contrato(99)]);
    const r = await rodadaContratosCgu(params(), null);
    expect(portalGet.mock.calls[0][1]).toMatchObject({ pagina: "5" });
    expect(r).toMatchObject({ processados: 1, totalAcumulado: 61, haMais: false });
  });

  it("detalhe com falha passageira interrompe sem avançar nem gravar a página", async () => {
    portalGet.mockResolvedValueOnce([contrato(1), contrato(2)]);
    portalGetComTexto.mockRejectedValueOnce(
      new Error("TRANSIENT: Portal 429 (serviço indisponível)"),
    );
    const r = await rodadaContratosCgu(params(), null);
    expect(r).toMatchObject({ processados: 0, haMais: true, cursor: 0 });
    expect(r.erros).toEqual(["detalhe 1: TRANSIENT: Portal 429 (serviço indisponível)"]);
    expect(contratosGravados).toEqual([]);
    expect(linhaDeRodada()[0]).toMatchObject({ resultado: "erro_origem" });
  });

  it("detalhe com erro definitivo cai para o valor da listagem e registra o erro", async () => {
    portalGet.mockResolvedValueOnce([contrato(1)]);
    portalGetComTexto.mockRejectedValueOnce(new Error("Portal API 400: id inválido"));
    const r = await rodadaContratosCgu(params(), null);
    expect(r).toMatchObject({ processados: 1, haMais: false });
    expect(r.erros).toEqual(["detalhe 1: Portal API 400: id inválido"]);
    expect(contratosGravados).toEqual([expect.objectContaining({ id: "1", valor: 100 })]);
  });

  it("órgão catalogado como fora do Portal é recusado antes de consultar", async () => {
    await expect(rodadaContratosCgu(params({ codigoOrgao: "01000" }), null)).rejects.toThrow(
      /não é coberto pelo Portal/,
    );
    expect(portalGet).not.toHaveBeenCalled();
  });

  it("sem janela, varre o histórico do órgão e a linha não ancora célula", async () => {
    portalGet.mockResolvedValueOnce([contrato(1, "2019-05-02")]);
    const r = await rodadaContratosCgu(
      importarContratosCguSchema.parse({ codigoOrgao: "26000", delayMs: 0 }),
      "admin-1",
    );
    expect(r.processados).toBe(1);
    expect(portalGet.mock.calls[0][1]).not.toHaveProperty("dataInicial");
    expect(linhaDeRodada()[0]).toMatchObject({
      escopo: "26000",
      ano: null,
      mes: null,
      gatilho: "painel",
    });
    expect(varredura.has("26000")).toBe(true);
  });
});
