import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Modo nomeado do TSE (arquivo tipo × ano × UF), do vínculo
// parlamentar↔candidato, dos cruzamentos por eleição e do CSV da origem.
// Núcleos, runners, checkpoint e banco são mocks — aqui interessa o contrato
// de cada adaptador: validação da janela, a rodada sem operador, o formato
// único da resposta, o cursor, a conferência e as pendentes.
// ---------------------------------------------------------------------------

/** Consulta encadeada do supabase-js: grava os filtros e resolve com `count`. */
type Consulta = { tabela: string; filtros: unknown[][] };
const consultas: Consulta[] = [];
let contagem = 0;
function from(tabela: string) {
  const c: Consulta = { tabela, filtros: [] };
  consultas.push(c);
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "like", "is", "not", "limit"]) {
    q[m] = (...args: unknown[]) => {
      c.filtros.push([m, ...args]);
      return q;
    };
  }
  q.then = (ok: (v: unknown) => unknown) => ok({ count: contagem, error: null });
  return q;
}

const lerCheckpoint = vi.fn();
const lerCheckpointTse = vi.fn();
const conferirEGravar = vi.fn();
const lerConferencias = vi.fn();
const ultimaConferenciaDaJanela = vi.fn();
const conferirSemReimportar = vi.fn();
const inserirImportacoes = vi.fn();
const sincronizarArquivoTse = vi.fn();
const sincronizarPonteParlamentar = vi.fn();
const rodadaConveniosOrigem = vi.fn();
const runners = {
  rodarEleitosSemContas: vi.fn(),
  rodarCandidatosSemBens: vi.fn(),
  rodarSerieHistorica: vi.fn(),
  rodarParlamentarSemMatch: vi.fn(),
  rodarEvolucaoPatrimonial: vi.fn(),
  rodarFornecedorConcentrado: vi.fn(),
  rodarDoadorVirouFornecedor: vi.fn(),
};

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { rpc: vi.fn(), from },
}));
vi.mock("@/lib/data/checkpoint.server", () => ({
  checkpointImportacao: { ler: lerCheckpoint, salvar: vi.fn() },
}));
vi.mock("@/lib/data/historico.server", () => ({ inserirImportacoes }));
vi.mock("@/lib/data/automacao/conferencia.server", () => ({
  conferirEGravar,
  contarRegistrosNaJanela: vi.fn(),
  lerConferencias,
  ultimaConferenciaDaJanela,
  conferirSemReimportar,
}));
vi.mock("@/lib/data/tse/ingest.server", () => ({
  sincronizarArquivoTse,
  checkpointTse: { ler: lerCheckpointTse, salvar: vi.fn() },
}));
vi.mock("@/lib/data/tse/ponte.server", () => ({ sincronizarPonteParlamentar }));
vi.mock("@/lib/data/tse/sinais.server", () => runners);
vi.mock("@/lib/data/convenios-origem/ingest.functions", async (original) => ({
  ...(await original<typeof import("@/lib/data/convenios-origem/ingest.functions")>()),
  rodadaConveniosOrigem,
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
/** A linha de rodada que o adaptador gravou no Histórico. */
const linhaGravada = () => inserirImportacoes.mock.calls[0][0];

const rodadaTse = (parcial: Record<string, unknown> = {}) => ({
  chave: "bens#2022#AC",
  importados: 200,
  linhasProcessadas: 200,
  totalAcumulado: 200,
  completa: true,
  haMais: false,
  erros: [],
  ...parcial,
});

const sinais = (regra: string, parcial: Record<string, unknown> = {}) => ({
  regra,
  candidatosAvaliados: 10,
  findingsGerados: 2,
  avisos: [],
  ...parcial,
});

beforeEach(() => {
  vi.clearAllMocks();
  consultas.length = 0;
  contagem = 0;
  lerCheckpoint.mockResolvedValue(null);
  lerCheckpointTse.mockResolvedValue(null);
  conferirEGravar.mockResolvedValue(CONFERENCIA);
  conferirSemReimportar.mockResolvedValue(CONFERENCIA);
  lerConferencias.mockResolvedValue([]);
  ultimaConferenciaDaJanela.mockResolvedValue(null);
  inserirImportacoes.mockResolvedValue(null);
  for (const r of Object.values(runners)) r.mockImplementation(async () => sinais("regra"));
});

describe("tse_arquivo", () => {
  it("recusa ano sem eleição, combinação que o TSE não publica e BR em eleição municipal", async () => {
    for (const params of [
      { tipo: "candidatos", ano: 2023, uf: "AC" },
      { tipo: "bens", ano: 2004, uf: "AC" },
      { tipo: "receitas", ano: 2026, uf: "AC" },
      { tipo: "candidatos", ano: 2024, uf: "BR" },
      { tipo: "votos", ano: 2022, uf: "AC" },
    ]) {
      expect(await pedido("tse_arquivo", params)).toHaveProperty("recusa");
    }
    expect(sincronizarArquivoTse).not.toHaveBeenCalled();
  });

  it("rodada parcial: sem operador, com a execução; a resposta no formato único", async () => {
    sincronizarArquivoTse.mockResolvedValue(
      rodadaTse({ linhasProcessadas: 5000, totalAcumulado: 4990, completa: false, haMais: true }),
    );
    const r = await pedido("tse_arquivo", { tipo: "bens", ano: 2022, uf: "AC" });
    expect(sincronizarArquivoTse).toHaveBeenCalledWith({
      tipo: "bens",
      ano: 2022,
      uf: "AC",
      userId: null,
      origem: ORIGEM,
      reprocessar: false,
    });
    expect(r).toMatchObject({
      importados: { registros: 200 },
      haMais: true,
      cursor: 5000,
      totalAcumulado: 4990,
      parada: "tempo",
      conferencia: null,
    });
    expect(conferirEGravar).not.toHaveBeenCalled();
  });

  it("última rodada: confere a eleição (âncora mes 1) e conta a UF no cache", async () => {
    sincronizarArquivoTse.mockResolvedValue(rodadaTse());
    contagem = 42;
    const r = await pedido("tse_arquivo", { tipo: "receitas", ano: 2022, uf: "SP" });
    expect(r).toMatchObject({ haMais: false, parada: "fim", conferencia: CONFERENCIA });
    expect(entradaDaConferencia()).toMatchObject({
      janela: { ano: 2022, mes: 1 },
      acumulado: 200,
      origem: null,
      recente: false,
    });
    expect(await conferirEGravar.mock.calls[0][2]()).toBe(42);
    expect(consultas[0]).toEqual({
      tabela: "tse_receitas_campanha_cache",
      filtros: [
        ["select", "sq_candidato", { count: "exact" }],
        ["eq", "ano_eleicao", 2022],
        ["eq", "uf", "SP"],
        ["limit", 0],
      ],
    });
  });

  it("em bens, a célula são as fichas da UF com o total declarado", async () => {
    sincronizarArquivoTse.mockResolvedValue(rodadaTse());
    await pedido("tse_arquivo", { tipo: "bens", ano: 2022, uf: "AC" });
    await conferirEGravar.mock.calls[0][2]();
    expect(consultas[0].tabela).toBe("tse_candidatos_cache");
    expect(consultas[0].filtros).toContainEqual(["not", "bens_total_declarado", "is", null]);
  });

  it("arquivo já completo: não reimporta, só confere na fonte e no escopo do Histórico", async () => {
    lerCheckpointTse.mockResolvedValue({ cursor: 900, total: 880, completa: true });
    const r = await pedido("tse_arquivo", { tipo: "bens", ano: 2022, uf: "AC" });
    expect(sincronizarArquivoTse).not.toHaveBeenCalled();
    expect(lerCheckpointTse).toHaveBeenCalledWith("bens#2022#AC");
    expect(ultimaConferenciaDaJanela).toHaveBeenCalledWith(
      "tse_bens",
      { ano: 2022, mes: 1 },
      "2022-AC",
    );
    expect(conferirSemReimportar.mock.calls[0][0]).toMatchObject({
      fonte: "tse_bens",
      escopo: "2022-AC",
      entrada: { janela: { ano: 2022, mes: 1 }, acumulado: 880 },
    });
    expect(r).toMatchObject({ parada: "janela_completa", importados: { registros: 0 } });
  });

  it("reprocessar um arquivo completo recomeça do zero", async () => {
    lerCheckpointTse.mockResolvedValue({ cursor: 900, total: 880, completa: true });
    sincronizarArquivoTse.mockResolvedValue(rodadaTse());
    await pedido("tse_arquivo", { tipo: "bens", ano: 2022, uf: "AC" }, { reprocessar: true });
    expect(sincronizarArquivoTse.mock.calls[0][0]).toMatchObject({ reprocessar: true });
  });

  it("pendentes: a matriz do tipo e da UF pedidos, sem os arquivos aprovados", async () => {
    lerConferencias.mockResolvedValue([
      {
        ano: 2022,
        mes: 1,
        escopo: "2022-SP",
        estado: "aprovada",
        motivo: "ok",
        execucao_id: "e",
        consultado_em: "2026-09-01T00:00:00Z",
      },
    ]);
    const r = await pendentes("tse_arquivo", { tipo: "bens", uf: "SP" });
    expect(lerConferencias).toHaveBeenCalledTimes(1);
    expect(lerConferencias).toHaveBeenCalledWith("tse_bens");
    if (!("janelas" in r)) throw new Error(r.recusa);
    expect(r.janelas.map((j) => `${j.ano} ${j.escopo}`)).not.toContain("2022 bens/SP");
    expect(r.janelas[0]).toMatchObject({ escopo: "bens/SP", mes: 1 });
    expect(r.janelas.every((j) => j.escopo === "bens/SP")).toBe(true);
  });

  it("pendentes: recusa tipo desconhecido", async () => {
    expect(await pendentes("tse_arquivo", { tipo: "votos" })).toHaveProperty("recusa");
  });
});

describe("tse_ponte", () => {
  it("um lote a partir do offset pedido; o próximo volta no cursor", async () => {
    sincronizarPonteParlamentar.mockResolvedValue({
      processados: 40,
      vinculados: 35,
      semMatch: 5,
      baixaConfianca: 1,
      proximoOffset: 80,
    });
    const r = await pedido("tse_ponte", { casa: "camara", offset: 40 });
    expect(sincronizarPonteParlamentar).toHaveBeenCalledWith("camara", 40);
    expect(r).toMatchObject({
      importados: { parlamentares: 40, vinculos: 35 },
      haMais: true,
      cursor: 80,
      totalAcumulado: 80,
      parada: "subrequisicoes",
      avisos: ["info: 1 vínculo(s) por nome, na fila de revisão."],
      erros: [],
    });
    expect(linhaGravada()).toMatchObject({
      fonte: "tse_ponte",
      escopo: "camara",
      gatilho: "ferramenta",
      execucao_id: EXECUCAO,
      user_id: null,
      resultado: "com_dados",
    });
  });

  it("último lote: termina e confere o total de parlamentares percorridos", async () => {
    sincronizarPonteParlamentar.mockResolvedValue({
      processados: 20,
      vinculados: 18,
      semMatch: 2,
      baixaConfianca: 0,
      proximoOffset: null,
    });
    const r = await pedido("tse_ponte", { casa: "senado", offset: 80 });
    expect(r).toMatchObject({ haMais: false, parada: "fim", totalAcumulado: 100 });
    expect(entradaDaConferencia()).toMatchObject({ janela: null, acumulado: 100 });
  });

  it("falha do núcleo: vira erro da rodada, gravada no Histórico, e a janela termina", async () => {
    sincronizarPonteParlamentar.mockRejectedValue(new Error("violates foreign key"));
    const r = await pedido("tse_ponte", { casa: "camara" });
    expect(sincronizarPonteParlamentar).toHaveBeenCalledWith("camara", 0);
    expect(r).toMatchObject({ haMais: false, erros: ["violates foreign key"] });
    expect(linhaGravada().resultado).toBe("erro_nosso");
  });

  it("pendentes: uma janela de cadastro por casa", async () => {
    const r = await pendentes("tse_ponte");
    if (!("janelas" in r)) throw new Error(r.recusa);
    expect(r.janelas.map((j) => j.escopo)).toEqual(["camara", "senado"]);
    expect(lerConferencias).toHaveBeenCalledWith("tse_ponte", "camara");
  });
});

describe("cruzamentos", () => {
  it("tse_sinais: os runners da eleição; conferência mínima com os findings novos", async () => {
    runners.rodarEvolucaoPatrimonial.mockResolvedValue(
      sinais("evolucao_patrimonial_atipica", { candidatosAvaliados: 7, findingsGerados: 3 }),
    );
    runners.rodarFornecedorConcentrado.mockResolvedValue(
      sinais("fornecedor_campanha_concentrado", { candidatosAvaliados: 5, findingsGerados: 1 }),
    );
    const r = await pedido("tse_sinais", { ano: 2022 });
    expect(runners.rodarEvolucaoPatrimonial).toHaveBeenCalledWith(2022);
    expect(runners.rodarFornecedorConcentrado).toHaveBeenCalledWith(2022);
    expect(runners.rodarDoadorVirouFornecedor).not.toHaveBeenCalled();
    expect(r).toMatchObject({
      importados: { avaliados: 12, findings: 4 },
      haMais: false,
      parada: "fim",
      conferencia: CONFERENCIA,
    });
    expect(entradaDaConferencia()).toMatchObject({
      janela: { ano: 2022, mes: 1 },
      minima: true,
      findingsNovos: 4,
      acumulado: 12,
    });
    expect(linhaGravada()).toMatchObject({
      fonte: "tse_sinais",
      ano: 2022,
      mes: 1,
      importados: 4,
      total_bruto: 12,
      execucao_id: EXECUCAO,
    });
  });

  it("tse_lacunas: runner que falha vira erro da rodada; os demais rodam", async () => {
    runners.rodarEleitosSemContas.mockRejectedValue(new Error("tse_eleitos_sem_contas: timeout"));
    runners.rodarCandidatosSemBens.mockResolvedValue(
      sinais("candidato_sem_bens", { avisos: ["info: regra desligada"] }),
    );
    const r = await pedido("tse_lacunas", { ano: 2024 });
    expect(runners.rodarCandidatosSemBens).toHaveBeenCalledWith(2024, true);
    expect(runners.rodarSerieHistorica).toHaveBeenCalledWith(2024);
    expect(runners.rodarParlamentarSemMatch).toHaveBeenCalled();
    expect(r).toMatchObject({
      erros: ["tse_eleitos_sem_contas: timeout"],
      avisos: ["info: regra desligada"],
    });
    expect(linhaGravada().resultado).toBe("erro_origem");
  });

  it("cruzamento_doador_fornecedor: só o cruzamento da eleição", async () => {
    await pedido("cruzamento_doador_fornecedor", { ano: 2022 });
    expect(runners.rodarDoadorVirouFornecedor).toHaveBeenCalledWith(2022);
    expect(linhaGravada().fonte).toBe("tse_doador_fornecedor");
  });

  it("recusa ano sem eleição", async () => {
    expect(await pedido("tse_sinais", { ano: 2023 })).toHaveProperty("recusa");
  });

  it("pendentes: uma janela por eleição, sem os anos sem eleição", async () => {
    const r = await pendentes("tse_lacunas");
    if (!("janelas" in r)) throw new Error(r.recusa);
    expect(lerConferencias).toHaveBeenCalledWith("tse_lacunas");
    expect(r.janelas.map((j) => j.ano).slice(0, 3)).toEqual([2026, 2024, 2022]);
    expect(r.janelas.every((j) => j.ano % 2 === 0 && j.mes === 1)).toBe(true);
  });
});

describe("convenios_origem", () => {
  it("uma rodada do CSV com a execução; atualizados na resposta", async () => {
    rodadaConveniosOrigem.mockResolvedValue({
      importados: 500,
      atualizados: 500,
      semEspelho: 20,
      erros: ["info: 20 sem espelho"],
      varredura: {
        haMais: true,
        cursor: 43,
        totalAcumulado: 21000,
        orcamentoEsgotado: false,
        custoEsgotado: true,
      },
    });
    const r = await pedido("convenios_origem", {});
    expect(rodadaConveniosOrigem).toHaveBeenCalledWith(null, ORIGEM);
    expect(lerCheckpoint).toHaveBeenCalledWith("convenios_origem#csv");
    expect(r).toMatchObject({
      importados: { atualizados: 500 },
      haMais: true,
      cursor: 43,
      parada: "subrequisicoes",
      avisos: ["info: 20 sem espelho"],
    });
  });

  it("pendentes: o cadastro, uma janela só", async () => {
    const r = await pendentes("convenios_origem");
    if (!("janelas" in r)) throw new Error(r.recusa);
    expect(r.janelas).toHaveLength(1);
    expect(lerConferencias).toHaveBeenCalledWith("convenios_origem");
  });
});
