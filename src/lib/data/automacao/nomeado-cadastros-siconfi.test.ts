import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Modo nomeado dos cadastros (senadores, trajetória dos deputados) e do
// SICONFI em lote (ano todo de um ente, varredura de um conjunto). Núcleos,
// checkpoint e banco são mocks — aqui interessa o contrato de cada adaptador:
// janela natural, cursor, escopo da conferência, contagem contra a origem e a
// célula contada.
// ---------------------------------------------------------------------------

/**
 * Consulta encadeada do supabase-js: grava os filtros e resolve com `count`,
 * ou com `falha` (o erro e o status HTTP que o PostgREST devolveu).
 */
type Consulta = { tabela: string; filtros: unknown[][] };
const consultas: Consulta[] = [];
let contagem = 0;
let falha: { error: Record<string, unknown>; status: number } | null = null;
function from(tabela: string) {
  const c: Consulta = { tabela, filtros: [] };
  consultas.push(c);
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "like", "is", "gte", "lte", "limit"]) {
    q[m] = (...args: unknown[]) => {
      c.filtros.push([m, ...args]);
      return q;
    };
  }
  q.then = (ok: (v: unknown) => unknown) =>
    ok(falha ? { count: null, data: null, ...falha } : { count: contagem, error: null });
  return q;
}

const lerCheckpoint = vi.fn();
const conferirEGravar = vi.fn();
const lerConferencias = vi.fn();
const ultimaConferenciaDaJanela = vi.fn();
const conferirSemReimportar = vi.fn();
const rodadaCadastroSenado = vi.fn();
const rodadaTrajetoriaCamara = vi.fn();
const rodadaVarreduraSiconfi = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { rpc: vi.fn(), from },
}));
vi.mock("@/lib/data/checkpoint.server", () => ({
  checkpointImportacao: { ler: lerCheckpoint, salvar: vi.fn() },
}));
vi.mock("@/lib/data/automacao/conferencia.server", () => ({
  conferirEGravar,
  contarRegistrosNaJanela: vi.fn(),
  lerConferencias,
  ultimaConferenciaDaJanela,
  conferirSemReimportar,
}));
vi.mock("@/lib/data/senado/ingest.functions", async (original) => ({
  ...(await original<typeof import("@/lib/data/senado/ingest.functions")>()),
  rodadaCadastroSenado,
}));
vi.mock("@/lib/data/camara/ingest.functions", async (original) => ({
  ...(await original<typeof import("@/lib/data/camara/ingest.functions")>()),
  rodadaTrajetoriaCamara,
}));
vi.mock("@/lib/data/siconfi/ingest.functions", async (original) => ({
  ...(await original<typeof import("@/lib/data/siconfi/ingest.functions")>()),
  rodadaVarreduraSiconfi,
}));

const { executarRodadaNomeada, consultarPendentes } = await import("./nomeado");

const EXECUCAO = "7d1f3c2a-9b8e-4f6d-a5c4-3b2a1f0e9d8c";
const ORIGEM = { gatilho: "ferramenta", execucaoId: EXECUCAO };
const CONFERENCIA = { estado: "aprovada", motivo: "ok" };

const pedido = (tarefa: string, params: unknown, extra: Record<string, unknown> = {}) =>
  executarRodadaNomeada({ tarefa, params, execucao_id: EXECUCAO, ...extra });
const pendentes = (tarefa: string, params?: unknown) =>
  consultarPendentes({ consulta: "pendentes", tarefa, params });

/** A entrada da conferência que a rota montou na última rodada. */
const entradaDaConferencia = () => conferirEGravar.mock.calls[0][1];

beforeEach(() => {
  consultas.length = 0;
  contagem = 0;
  falha = null;
  for (const f of [
    lerCheckpoint,
    conferirEGravar,
    lerConferencias,
    ultimaConferenciaDaJanela,
    conferirSemReimportar,
    rodadaCadastroSenado,
    rodadaTrajetoriaCamara,
    rodadaVarreduraSiconfi,
  ]) {
    f.mockReset();
  }
  lerCheckpoint.mockResolvedValue(null);
  conferirEGravar.mockResolvedValue(CONFERENCIA);
  conferirSemReimportar.mockResolvedValue(CONFERENCIA);
  lerConferencias.mockResolvedValue([]);
  ultimaConferenciaDaJanela.mockResolvedValue(null);
});

describe("cadastro do Senado", () => {
  it("chamada única: leva o tamanho da lista à conferência, com os ilegíveis descartados", async () => {
    rodadaCadastroSenado.mockResolvedValue({
      importados: 81,
      erros: [],
      origem: { total: 82, descartados: 1 },
    });
    const r = await pedido("senado_cadastro", {});
    expect(lerCheckpoint).not.toHaveBeenCalled();
    expect(rodadaCadastroSenado).toHaveBeenCalledWith(null, ORIGEM);
    expect(r).toMatchObject({
      importados: { senadores: 81 },
      haMais: false,
      cursor: null,
      totalAcumulado: 81,
      parada: "fim",
      conferencia: CONFERENCIA,
    });
    expect(entradaDaConferencia()).toMatchObject({
      janela: null,
      acumulado: 81,
      origem: { total: 82, descartados: 1 },
      recente: false,
    });
    // Cadastro não tem célula no tempo: a cobertura exige contagem > 0.
    expect(conferirEGravar.mock.calls[0][2]).toBeNull();
  });

  it("é pendente enquanto a última conferência da fonte não for aprovada", async () => {
    expect(await pendentes("senado_cadastro")).toMatchObject({
      janelas: [{ ano: 0, mes: 0, ultima: null }],
    });
    expect(lerConferencias).toHaveBeenCalledWith("senado_senadores");
  });
});

describe("trajetória da Câmara", () => {
  it("devolve o próximo offset no cursor, e a conferência só vem no fim", async () => {
    rodadaTrajetoriaCamara.mockResolvedValue({
      legislatura: 57,
      total: 600,
      processados: 60,
      proximoOffset: 60,
      erros: [],
    });
    const r = await pedido("camara_trajetoria", { idLegislatura: 57 });
    expect(rodadaTrajetoriaCamara).toHaveBeenCalledWith(
      { idLegislatura: 57, offset: 0 },
      null,
      ORIGEM,
    );
    expect(r).toMatchObject({
      importados: { deputados: 60 },
      haMais: true,
      cursor: 60,
      totalAcumulado: 60,
      // O lote da rodada é o teto de subrequisições, não uma interrupção.
      parada: "subrequisicoes",
      conferencia: null,
    });
    expect(conferirEGravar).not.toHaveBeenCalled();
  });

  it("falha passageira devolve o mesmo offset e interrompe a rodada", async () => {
    rodadaTrajetoriaCamara.mockResolvedValue({
      legislatura: 57,
      total: 600,
      processados: 120,
      proximoOffset: 120,
      erros: ["TRANSIENT: Câmara 503"],
    });
    const r = await pedido("camara_trajetoria", { idLegislatura: 57, offset: 120 });
    expect(r).toMatchObject({ haMais: true, cursor: 120, parada: "erro" });
  });

  it("a última rodada confere a legislatura inteira, sem total da origem", async () => {
    rodadaTrajetoriaCamara.mockResolvedValue({
      legislatura: 57,
      total: 600,
      processados: 600,
      proximoOffset: null,
      erros: [],
    });
    const r = await pedido("camara_trajetoria", { idLegislatura: 57, offset: 540 });
    expect(rodadaTrajetoriaCamara.mock.calls[0][0]).toEqual({ idLegislatura: 57, offset: 540 });
    expect(r).toMatchObject({
      importados: { deputados: 60 },
      haMais: false,
      cursor: 600,
      totalAcumulado: 600,
      parada: "fim",
    });
    expect(entradaDaConferencia()).toMatchObject({ janela: null, acumulado: 600, origem: null });
  });

  it("sem legislatura, vale a atual", async () => {
    rodadaTrajetoriaCamara.mockResolvedValue({
      legislatura: 57,
      total: 0,
      processados: 0,
      proximoOffset: null,
      erros: [],
    });
    await pedido("camara_trajetoria", {});
    expect(rodadaTrajetoriaCamara.mock.calls[0][0]).toEqual({ offset: 0 });
  });

  it("pendentes: uma janela, a do cadastro", async () => {
    await pendentes("camara_trajetoria");
    expect(lerConferencias).toHaveBeenCalledWith("camara_trajetoria");
  });
});

/** O que o núcleo da varredura do SICONFI devolve. */
function varredura(parcial: Record<string, unknown> = {}) {
  return {
    importados: 1200,
    consultas: 10,
    semDados: 1,
    totalConsultas: 10,
    entes: 1,
    erros: [],
    varredura: {
      haMais: false,
      cursor: 10,
      totalAcumulado: 1200,
      orcamentoEsgotado: false,
      custoEsgotado: false,
    },
    ...parcial,
  };
}

describe("SICONFI — ano todo de um ente", () => {
  const SP_2023 = { codIbge: "35", exercicio: 2023 };

  it("é a varredura do ente num exercício: mesma chave, escopo e célula da conferência", async () => {
    rodadaVarreduraSiconfi.mockResolvedValue(varredura());
    contagem = 1200;
    const r = await pedido("siconfi_ano", SP_2023);
    expect(lerCheckpoint).toHaveBeenCalledWith("siconfi_varredura#ente#2023-2023#35");
    expect(rodadaVarreduraSiconfi).toHaveBeenCalledWith(
      { conjunto: "ente", codIbge: "35", exercicioInicial: 2023, exercicioFinal: 2023 },
      null,
      ORIGEM,
    );
    expect(r).toMatchObject({ importados: { linhas: 1200 }, parada: "fim" });
    expect(entradaDaConferencia()).toMatchObject({
      janela: { ano: 2023, mes: 0 },
      acumulado: 1200,
      origem: null,
      recente: false,
    });
    const contar = conferirEGravar.mock.calls[0][2] as () => Promise<number>;
    expect(await contar()).toBe(1200);
    expect(consultas[0]).toEqual({
      tabela: "siconfi_relatorios_cache",
      filtros: [
        // GET com limit 0, não HEAD: o erro do banco vem no corpo.
        ["select", "id", { count: "exact" }],
        ["eq", "exercicio", 2023],
        ["eq", "cod_ibge", "35"],
        ["limit", 0],
      ],
    });
  });

  it("falha na contagem traz o código e o texto do banco, nunca uma mensagem vazia", async () => {
    rodadaVarreduraSiconfi.mockResolvedValue(varredura());
    await pedido("siconfi_ano", SP_2023);
    const contar = conferirEGravar.mock.calls[0][2] as () => Promise<number>;
    falha = {
      error: {
        code: "57014",
        details: null,
        hint: null,
        message: "canceling statement due to statement timeout",
      },
      status: 500,
    };
    await expect(contar()).rejects.toThrow(
      "conferência: contagem em siconfi_relatorios_cache: 57014: canceling statement due to statement timeout",
    );
    // Resposta sem corpo: o supabase-js entrega `message: ""`; fica o status.
    falha = { error: { message: "" }, status: 500 };
    await expect(contar()).rejects.toThrow(
      "conferência: contagem em siconfi_relatorios_cache: HTTP 500, resposta sem corpo",
    );
  });

  it("retoma: rodada interrompida devolve o cursor, sem conferir", async () => {
    rodadaVarreduraSiconfi.mockResolvedValue(
      varredura({
        importados: 300,
        erros: ["São Paulo/2023 RREO 4: TRANSIENT: SICONFI 503"],
        varredura: {
          haMais: true,
          cursor: 3,
          totalAcumulado: 300,
          orcamentoEsgotado: false,
          custoEsgotado: false,
        },
      }),
    );
    const r = await pedido("siconfi_ano", SP_2023);
    expect(r).toMatchObject({ haMais: true, cursor: 3, parada: "erro", conferencia: null });
    expect(conferirEGravar).not.toHaveBeenCalled();
  });

  it("janela completa sem conferência aprovada é conferida sem reimportar, no escopo da varredura", async () => {
    lerCheckpoint.mockResolvedValue({ cursor: 10, total: 1200, completa: true });
    const r = await pedido("siconfi_ano", SP_2023);
    expect(rodadaVarreduraSiconfi).not.toHaveBeenCalled();
    expect(ultimaConferenciaDaJanela).toHaveBeenCalledWith(
      "siconfi",
      { ano: 2023, mes: 0 },
      "varredura:ente:35",
    );
    expect(conferirSemReimportar).toHaveBeenCalledWith(
      expect.objectContaining({ fonte: "siconfi", escopo: "varredura:ente:35" }),
    );
    expect(r).toMatchObject({ parada: "janela_completa", conferencia: CONFERENCIA });
  });

  it("recusa exercício fora da disponibilidade e ente mal escrito", async () => {
    expect(await pedido("siconfi_ano", { ...SP_2023, exercicio: 2012 })).toHaveProperty("recusa");
    expect(await pedido("siconfi_ano", { ...SP_2023, codIbge: "355" })).toHaveProperty("recusa");
    expect(rodadaVarreduraSiconfi).not.toHaveBeenCalled();
  });

  it("pendentes: exercícios encerrados do ente, pelas conferências da varredura dele", async () => {
    lerConferencias.mockResolvedValue([
      {
        ano: 2023,
        mes: 0,
        estado: "aprovada",
        motivo: "ok",
        execucao_id: "e",
        consultado_em: "2026-09-01",
      },
    ]);
    const r = await pendentes("siconfi_ano", { codIbge: "35" });
    expect(lerConferencias).toHaveBeenCalledWith("siconfi", "varredura:ente:35");
    const janelas = "janelas" in r ? r.janelas : [];
    expect(janelas.some((j) => j.ano === 2023)).toBe(false);
    expect(janelas.some((j) => j.ano === 2022 && j.mes === 0)).toBe(true);
    expect(janelas.at(-1)).toMatchObject({ ano: 2013, mes: 0 });
    expect(await pendentes("siconfi_ano")).toHaveProperty("recusa");
  });
});

describe("SICONFI — varredura de um conjunto", () => {
  const MUNICIPIOS_AC = {
    conjunto: "municipios",
    uf: "AC",
    exercicioInicial: 2022,
    exercicioFinal: 2022,
  };

  it("a janela é um exercício do conjunto; a célula conta os municípios da UF", async () => {
    rodadaVarreduraSiconfi.mockResolvedValue(varredura({ entes: 22 }));
    await pedido("siconfi_varredura", MUNICIPIOS_AC);
    expect(lerCheckpoint).toHaveBeenCalledWith("siconfi_varredura#municipios#2022-2022#AC");
    expect(rodadaVarreduraSiconfi).toHaveBeenCalledWith(MUNICIPIOS_AC, null, ORIGEM);
    expect(entradaDaConferencia()).toMatchObject({ janela: { ano: 2022, mes: 0 } });
    const contar = conferirEGravar.mock.calls[0][2] as () => Promise<number>;
    await contar();
    // AC = 12: os municípios do Acre têm código 12xxxxx. Faixa, não `like`:
    // o índice (exercicio, cod_ibge) só a percorre com a faixa.
    expect(consultas[0].filtros).toEqual(
      expect.arrayContaining([
        ["eq", "exercicio", 2022],
        ["gte", "cod_ibge", "1200000"],
        ["lte", "cod_ibge", "1299999"],
      ]),
    );
    expect(consultas[0].filtros.some(([m]) => m === "like")).toBe(false);
  });

  it("as UFs contam os entes de dois dígitos; as capitais, a lista delas", async () => {
    rodadaVarreduraSiconfi.mockResolvedValue(varredura());
    await pedido("siconfi_varredura", {
      conjunto: "ufs",
      exercicioInicial: 2022,
      exercicioFinal: 2022,
    });
    await pedido("siconfi_varredura", {
      conjunto: "capitais",
      exercicioInicial: 2022,
      exercicioFinal: 2022,
    });
    for (const [, , contar] of conferirEGravar.mock.calls)
      await (contar as () => Promise<number>)();
    // As 27 UFs pela lista de códigos, não por `like "__"`, que o índice não usa.
    const ufs = consultas[0].filtros.find(([m]) => m === "in");
    expect(ufs?.[1]).toBe("cod_ibge");
    expect([...(ufs?.[2] as string[])].sort()).toEqual(
      "11 12 13 14 15 16 17 21 22 23 24 25 26 27 28 29 31 32 33 35 41 42 43 50 51 52 53".split(" "),
    );
    const capitais = consultas[1].filtros.find(([m]) => m === "in");
    expect(capitais?.[1]).toBe("cod_ibge");
    expect(capitais?.[2]).toHaveLength(27);
  });

  it.each([
    ["mais de um exercício", { ...MUNICIPIOS_AC, exercicioInicial: 2021 }],
    ["municípios sem UF", { ...MUNICIPIOS_AC, uf: undefined }],
    ["UF que não existe", { ...MUNICIPIOS_AC, uf: "XX" }],
    ["ente sem código", { conjunto: "ente", exercicioInicial: 2022, exercicioFinal: 2022 }],
    [
      "exercício antes da fonte",
      { ...MUNICIPIOS_AC, exercicioInicial: 2012, exercicioFinal: 2012 },
    ],
  ])("recusa %s, sem rodar", async (_nome, params) => {
    expect(await pedido("siconfi_varredura", params)).toHaveProperty("recusa");
    expect(rodadaVarreduraSiconfi).not.toHaveBeenCalled();
  });

  it("pendentes: por exercício, do conjunto pedido", async () => {
    const r = await pendentes("siconfi_varredura", { conjunto: "municipios", uf: "AC" });
    expect(lerConferencias).toHaveBeenCalledWith("siconfi", "varredura:municipios:AC");
    expect("janelas" in r && r.janelas.every((j) => j.mes === 0)).toBe(true);
    expect(await pendentes("siconfi_varredura", { conjunto: "municipios" })).toHaveProperty(
      "recusa",
    );
    expect(await pendentes("siconfi_varredura")).toHaveProperty("recusa");
  });
});
