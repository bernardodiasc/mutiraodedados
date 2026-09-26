import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Modo nomeado das fontes da API do Portal da Transparência: licitações por
// órgão, emendas por ano e convênios por ente. Núcleos, checkpoint e banco
// são mocks — aqui interessa o contrato de cada adaptador: janela natural,
// cursor na tabela certa, escopo (a linha da matriz), contagem "não se
// aplica" e a célula contada na conferência.
// ---------------------------------------------------------------------------

/** Consulta encadeada do supabase-js: grava os filtros e resolve com `count`. */
type Consulta = { tabela: string; filtros: unknown[][] };
const consultas: Consulta[] = [];
let contagem = 0;
function from(tabela: string) {
  const c: Consulta = { tabela, filtros: [] };
  consultas.push(c);
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "or", "gte", "lte", "is", "limit"]) {
    q[m] = (...args: unknown[]) => {
      c.filtros.push([m, ...args]);
      return q;
    };
  }
  q.then = (ok: (v: unknown) => unknown) => ok({ count: contagem, error: null });
  return q;
}

const lerCheckpointImportacao = vi.fn();
const lerCheckpointCgu = vi.fn();
const rodadaLicitacoes = vi.fn();
const rodadaEmendas = vi.fn();
const rodadaConveniosPorEnte = vi.fn();
const conferirEGravar = vi.fn();
const lerConferencias = vi.fn();
const ultimaConferenciaDaJanela = vi.fn();
const conferirSemReimportar = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { rpc: vi.fn(), from },
}));
vi.mock("@/lib/data/checkpoint.server", () => ({
  checkpointImportacao: { ler: lerCheckpointImportacao, salvar: vi.fn() },
}));
vi.mock("@/lib/data/automacao/conferencia.server", () => ({
  conferirEGravar,
  contarRegistrosNaJanela: vi.fn(),
  lerConferencias,
  ultimaConferenciaDaJanela,
  conferirSemReimportar,
}));
vi.mock("@/lib/data/real/sweep", async (original) => ({
  ...(await original<typeof import("@/lib/data/real/sweep")>()),
  checkpointCguVarredura: { ler: lerCheckpointCgu, salvar: vi.fn() },
}));
vi.mock("@/lib/data/real/licitacoes.functions", async (original) => ({
  ...(await original<typeof import("@/lib/data/real/licitacoes.functions")>()),
  rodadaLicitacoes,
}));
vi.mock("@/lib/data/real/emendas.functions", async (original) => ({
  ...(await original<typeof import("@/lib/data/real/emendas.functions")>()),
  rodadaEmendas,
}));
vi.mock("@/lib/data/transferegov/ingest.functions", async (original) => ({
  ...(await original<typeof import("@/lib/data/transferegov/ingest.functions")>()),
  rodadaConveniosPorEnte,
}));

const { executarRodadaNomeada, consultarPendentes } = await import("./nomeado");

const EXECUCAO = "7d1f3c2a-9b8e-4f6d-a5c4-3b2a1f0e9d8c";
const MARCO = { dataInicial: "2024-03-01", dataFinal: "2024-03-31" };
const ORIGEM = { gatilho: "ferramenta", execucaoId: EXECUCAO };
const CONFERENCIA = { estado: "aprovada", motivo: "Janela completa: 30 registros." };

/** O que `varrerPaginado` devolve. */
function varredura(parcial: Record<string, unknown> = {}) {
  return {
    processados: 30,
    cursor: 2,
    totalAcumulado: 30,
    ultimaPagina: 2,
    completa: true,
    haMais: false,
    orcamentoEsgotado: false,
    erros: [] as string[],
    avisos: [] as string[],
    ...parcial,
  };
}

beforeEach(() => {
  consultas.length = 0;
  contagem = 0;
  for (const f of [
    lerCheckpointImportacao,
    lerCheckpointCgu,
    rodadaLicitacoes,
    rodadaEmendas,
    rodadaConveniosPorEnte,
    conferirEGravar,
    lerConferencias,
    ultimaConferenciaDaJanela,
    conferirSemReimportar,
  ]) {
    f.mockReset();
  }
  lerCheckpointImportacao.mockResolvedValue(null);
  lerCheckpointCgu.mockResolvedValue(null);
  conferirEGravar.mockResolvedValue(CONFERENCIA);
  conferirSemReimportar.mockResolvedValue(CONFERENCIA);
  ultimaConferenciaDaJanela.mockResolvedValue(null);
  lerConferencias.mockResolvedValue([]);
});

const pedido = (tarefa: string, params: unknown, extra: Record<string, unknown> = {}) =>
  executarRodadaNomeada({ tarefa, params, execucao_id: EXECUCAO, ...extra });

describe("modo nomeado — licitações da CGU", () => {
  const params = { codigoOrgao: "26000", ...MARCO };

  it("roda uma rodada do órgão e responde no formato único", async () => {
    rodadaLicitacoes.mockResolvedValue(
      varredura({
        processados: 15,
        haMais: true,
        completa: false,
        orcamentoEsgotado: true,
        avisos: ["info: varredura parcial"],
      }),
    );
    const r = await pedido("cgu_licitacoes", params);
    expect(rodadaLicitacoes).toHaveBeenCalledWith(
      expect.objectContaining({ ...params, delayMs: 800, orcamentoMs: 180000 }),
      null,
      ORIGEM,
    );
    expect(r).toMatchObject({
      importados: { licitacoes: 15 },
      erros: [],
      avisos: ["info: varredura parcial"],
      haMais: true,
      cursor: 2,
      parada: "tempo",
      conferencia: null,
    });
    expect(conferirEGravar).not.toHaveBeenCalled();
  });

  it("na última rodada confere sem total da origem e conta a célula órgão × mês", async () => {
    rodadaLicitacoes.mockResolvedValue(varredura());
    contagem = 30;
    const r = await pedido("cgu_licitacoes", params);
    expect(conferirEGravar).toHaveBeenCalledWith(
      EXECUCAO,
      {
        janela: { ano: 2024, mes: 3 },
        terminou: true,
        acumulado: 30,
        origem: null,
        recente: false,
        findingsNovos: null,
      },
      expect.any(Function),
    );
    const contar = conferirEGravar.mock.calls[0][2] as () => Promise<number>;
    expect(await contar()).toBe(30);
    expect(consultas[0]).toEqual({
      tabela: "cgu_licitacoes_cache",
      filtros: [
        ["select", "id", { count: "exact" }],
        ["eq", "orgao_cod", "26000"],
        [
          "or",
          "and(data_abertura.gte.2024-03-01,data_abertura.lte.2024-03-31),and(data_abertura.is.null,ano.eq.2024,mes_referencia.eq.3)",
        ],
        ["limit", 0],
      ],
    });
    expect(r).toMatchObject({ parada: "fim", conferencia: CONFERENCIA });
  });

  it("recusa janela maior que um mês e órgão fora do Portal, sem rodar", async () => {
    expect(await pedido("cgu_licitacoes", { ...params, dataFinal: "2024-04-30" })).toMatchObject({
      recusa: expect.stringMatching(/maior que um mês/),
    });
    expect(await pedido("cgu_licitacoes", { ...params, codigoOrgao: "01000" })).toMatchObject({
      recusa: expect.stringMatching(/não é coberto pelo Portal/),
    });
    expect(await pedido("cgu_licitacoes", { ...MARCO })).toHaveProperty("recusa");
    expect(rodadaLicitacoes).not.toHaveBeenCalled();
  });

  it("janela completa: lê o cursor em cgu_varredura e confere na linha do órgão", async () => {
    lerCheckpointCgu.mockResolvedValue({ cursor: 3, total: 40, completa: true });
    const r = await pedido("cgu_licitacoes", params);
    expect(lerCheckpointCgu).toHaveBeenCalledWith("licitacoes#26000#2024-03-01#2024-03-31");
    expect(lerCheckpointImportacao).not.toHaveBeenCalled();
    expect(ultimaConferenciaDaJanela).toHaveBeenCalledWith(
      "cgu_licitacoes",
      { ano: 2024, mes: 3 },
      "26000",
    );
    expect(conferirSemReimportar).toHaveBeenCalledWith(
      expect.objectContaining({ fonte: "cgu_licitacoes", escopo: "26000" }),
    );
    // O Portal não informa total: a conferência sem reimportação não chama a origem.
    const { totalDaOrigem } = conferirSemReimportar.mock.calls[0][0];
    expect(await totalDaOrigem()).toBeNull();
    expect(rodadaLicitacoes).not.toHaveBeenCalled();
    expect(r).toMatchObject({ importados: { licitacoes: 0 }, parada: "janela_completa" });
  });

  it("pendentes do órgão pedido filtram as conferências por ele", async () => {
    expect(
      await consultarPendentes({
        consulta: "pendentes",
        tarefa: "cgu_licitacoes",
        params: { codigoOrgao: "MEC" },
      }),
    ).toHaveProperty("recusa");
    const r = await consultarPendentes({
      consulta: "pendentes",
      tarefa: "cgu_licitacoes",
      params: { codigoOrgao: "26000" },
    });
    expect(lerConferencias).toHaveBeenCalledWith("cgu_licitacoes", "26000");
    expect("janelas" in r && r.janelas[0].dataInicio.endsWith("-01")).toBe(true);
    expect("janelas" in r && r.janelas.every((j) => j.escopo === "26000")).toBe(true);
  });
});

describe("modo nomeado — emendas da CGU", () => {
  it("janela natural é o ano: célula (ano, mês 1), cursor em cgu_varredura", async () => {
    rodadaEmendas.mockResolvedValue(varredura({ processados: 7, totalAcumulado: 700 }));
    contagem = 700;
    const r = await pedido("cgu_emendas", { ano: 2023 });
    expect(lerCheckpointCgu).toHaveBeenCalledWith("emendas#2023");
    expect(rodadaEmendas).toHaveBeenCalledWith(
      expect.objectContaining({ ano: 2023 }),
      null,
      ORIGEM,
    );
    expect(conferirEGravar).toHaveBeenCalledWith(
      EXECUCAO,
      expect.objectContaining({ janela: { ano: 2023, mes: 1 }, acumulado: 700, origem: null }),
      expect.any(Function),
    );
    const contar = conferirEGravar.mock.calls[0][2] as () => Promise<number>;
    expect(await contar()).toBe(700);
    expect(consultas[0].tabela).toBe("cgu_transferegov_emendas_cache");
    expect(consultas[0].filtros).toContainEqual(["eq", "ano", 2023]);
    expect(r).toMatchObject({ importados: { emendas: 7 }, totalAcumulado: 700 });
  });

  it("ano fora da janela da fonte é recusado", async () => {
    expect(await pedido("cgu_emendas", { ano: 2013 })).toHaveProperty("recusa");
    expect(rodadaEmendas).not.toHaveBeenCalled();
  });

  it("pendentes: uma janela por ano, sem escopo", async () => {
    const r = await consultarPendentes({ consulta: "pendentes", tarefa: "cgu_emendas" });
    expect(lerConferencias).toHaveBeenCalledWith("cgu_emendas");
    const janelas = "janelas" in r ? r.janelas : [];
    expect(janelas.every((j) => j.mes === 1 && j.dataFim.endsWith("-12-31"))).toBe(true);
    expect(janelas.at(-1)).toMatchObject({ ano: 2014, dataInicio: "2014-01-01" });
  });
});

describe("modo nomeado — convênios por ente", () => {
  it("sem ente: o mês do país, linha única (escopo vazio)", async () => {
    rodadaConveniosPorEnte.mockResolvedValue({
      importados: 45,
      erros: [],
      varredura: {
        haMais: false,
        cursor: 3,
        totalAcumulado: 45,
        orcamentoEsgotado: false,
        custoEsgotado: false,
      },
    });
    contagem = 45;
    const r = await pedido("transferegov", MARCO);
    expect(lerCheckpointImportacao).toHaveBeenCalledWith("transferegov#2024-03-01#2024-03-31");
    expect(rodadaConveniosPorEnte).toHaveBeenCalledWith(
      { ...MARCO, maxPaginas: 2000 },
      null,
      ORIGEM,
    );
    const contar = conferirEGravar.mock.calls[0][2] as () => Promise<number>;
    expect(await contar()).toBe(45);
    expect(consultas[0]).toEqual({
      tabela: "convenios_cache",
      filtros: [
        ["select", "id", { count: "exact" }],
        ["eq", "ano", 2024],
        ["eq", "mes_referencia", 3],
        ["limit", 0],
      ],
    });
    expect(r).toMatchObject({ importados: { convenios: 45 }, parada: "fim" });
  });

  it("com UF: escopo próprio, e a célula é contada só naquela UF", async () => {
    lerCheckpointImportacao.mockResolvedValue({ cursor: 2, total: 20, completa: true });
    ultimaConferenciaDaJanela.mockResolvedValue({ estado: "aprovada", motivo: "ok" });
    await pedido("transferegov", { ...MARCO, codigoUF: "35" });
    expect(lerCheckpointImportacao).toHaveBeenCalledWith(
      "transferegov#2024-03-01#2024-03-31#uf=35",
    );
    expect(ultimaConferenciaDaJanela).toHaveBeenCalledWith(
      "transferegov",
      { ano: 2024, mes: 3 },
      "uf:35",
    );

    rodadaConveniosPorEnte.mockResolvedValue({
      importados: 2,
      erros: [],
      varredura: {
        haMais: false,
        cursor: 1,
        totalAcumulado: 2,
        orcamentoEsgotado: false,
        custoEsgotado: false,
      },
    });
    await pedido("transferegov", { ...MARCO, codigoUF: "35" }, { reprocessar: true });
    const contar = conferirEGravar.mock.calls[0][2] as () => Promise<number>;
    await contar();
    expect(consultas.at(-1)?.filtros).toContainEqual(["eq", "uf", "SP"]);
  });

  it("recusa ente inválido, município e UF juntos, e janela maior que um mês", async () => {
    for (const params of [
      { ...MARCO, codigoUF: "SP" },
      { ...MARCO, codigoIbgeMunicipio: "355030" },
      { ...MARCO, codigoUF: "35", codigoIbgeMunicipio: "3550308" },
      { dataInicial: "2024-03-01", dataFinal: "2024-04-30" },
    ]) {
      expect(await pedido("transferegov", params)).toHaveProperty("recusa");
    }
    expect(rodadaConveniosPorEnte).not.toHaveBeenCalled();
  });

  it("pendentes do município filtram as conferências pelo escopo do ente", async () => {
    await consultarPendentes({
      consulta: "pendentes",
      tarefa: "transferegov",
      params: { codigoIbgeMunicipio: "3550308" },
    });
    expect(lerConferencias).toHaveBeenCalledWith("transferegov", "municipio:3550308");
    await consultarPendentes({ consulta: "pendentes", tarefa: "transferegov" });
    expect(lerConferencias).toHaveBeenLastCalledWith("transferegov", "");
  });
});
