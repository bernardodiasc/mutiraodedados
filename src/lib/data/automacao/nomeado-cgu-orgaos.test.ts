import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Modo nomeado dos casos mais caros da CGU: contratos por órgão, catálogo
// SIAFI e atividade dos órgãos — e as pendentes órgão × mês, que por padrão
// percorrem os órgãos ativos do catálogo. Núcleos, checkpoint e banco são
// mocks: aqui interessa o contrato de cada adaptador.
// ---------------------------------------------------------------------------

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
const rodadaContratosCgu = vi.fn();
const rodadaCatalogoSiafi = vi.fn();
const rodadaAtividadeOrgaos = vi.fn();
const orgaosAtivosDoCatalogo = vi.fn();
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
vi.mock("@/lib/data/real/portal.functions", async (original) => ({
  ...(await original<typeof import("@/lib/data/real/portal.functions")>()),
  rodadaContratosCgu,
}));
vi.mock("@/lib/data/real/orgaos-siafi.functions", async (original) => ({
  ...(await original<typeof import("@/lib/data/real/orgaos-siafi.functions")>()),
  rodadaCatalogoSiafi,
  rodadaAtividadeOrgaos,
  orgaosAtivosDoCatalogo,
}));

const { executarRodadaNomeada, consultarPendentes } = await import("./nomeado");
const { pendentesPorOrgao } = await import("./adaptadores/por-orgao");

const EXECUCAO = "7d1f3c2a-9b8e-4f6d-a5c4-3b2a1f0e9d8c";
const MARCO = { dataInicial: "2024-03-01", dataFinal: "2024-03-31" };
const ORIGEM = { gatilho: "ferramenta", execucaoId: EXECUCAO };
const CONFERENCIA = { estado: "aprovada", motivo: "Janela completa." };

/** O que `rodadaContratosCgu` devolve. */
function rodadaContratos(parcial: Record<string, unknown> = {}) {
  return {
    orgao: { cod: "26000" },
    contratos: [],
    fornecedores: [],
    processados: 12,
    cursor: 1,
    totalAcumulado: 12,
    ultimaPagina: 1,
    completa: true,
    haMais: false,
    orcamentoEsgotado: false,
    custoEsgotado: false,
    corrigidos: 0,
    erros: [] as string[],
    avisos: ["info: detalhes conferidos 12; valores corrigidos pela conferência 0"],
    ...parcial,
  };
}

const varreduraDoCatalogo = (parcial: Record<string, unknown> = {}) => ({
  haMais: false,
  cursor: 3,
  totalAcumulado: 40,
  orcamentoEsgotado: false,
  custoEsgotado: false,
  ...parcial,
});

beforeEach(() => {
  consultas.length = 0;
  contagem = 0;
  for (const f of [
    lerCheckpointImportacao,
    lerCheckpointCgu,
    rodadaContratosCgu,
    rodadaCatalogoSiafi,
    rodadaAtividadeOrgaos,
    orgaosAtivosDoCatalogo,
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
  orgaosAtivosDoCatalogo.mockResolvedValue([]);
});

const pedido = (tarefa: string, params: unknown, extra: Record<string, unknown> = {}) =>
  executarRodadaNomeada({ tarefa, params, execucao_id: EXECUCAO, ...extra });

describe("modo nomeado — contratos da CGU por órgão", () => {
  const params = { codigoOrgao: "26000", ...MARCO };

  it("roda uma rodada do órgão no mês e responde no formato único", async () => {
    rodadaContratosCgu.mockResolvedValue(
      rodadaContratos({
        haMais: true,
        completa: false,
        custoEsgotado: true,
        erros: ["detalhe 7: Portal API 400"],
      }),
    );
    const r = await pedido("cgu_contratos", params);
    expect(lerCheckpointCgu).toHaveBeenCalledWith("26000#2024-03-01#2024-03-31");
    expect(rodadaContratosCgu).toHaveBeenCalledWith(
      expect.objectContaining({ ...params, delayMs: 800, orcamentoMs: 180000 }),
      null,
      ORIGEM,
    );
    expect(r).toMatchObject({
      importados: { contratos: 12 },
      erros: ["detalhe 7: Portal API 400"],
      avisos: [expect.stringMatching(/^info: detalhes conferidos/)],
      haMais: true,
      parada: "subrequisicoes",
      conferencia: null,
    });
    expect(conferirEGravar).not.toHaveBeenCalled();
  });

  it("na última rodada confere a célula órgão × mês pelo início de vigência", async () => {
    rodadaContratosCgu.mockResolvedValue(rodadaContratos({ totalAcumulado: 40 }));
    contagem = 40;
    const r = await pedido("cgu_contratos", params);
    expect(conferirEGravar).toHaveBeenCalledWith(
      EXECUCAO,
      expect.objectContaining({ janela: { ano: 2024, mes: 3 }, acumulado: 40, origem: null }),
      expect.any(Function),
    );
    const contar = conferirEGravar.mock.calls[0][2] as () => Promise<number>;
    expect(await contar()).toBe(40);
    const consulta = consultas.find((c) => c.tabela === "contratos_cache");
    expect(consulta?.filtros).toContainEqual(["eq", "orgao_cod", "26000"]);
    expect(consulta?.filtros).toContainEqual([
      "or",
      "and(data_inicio_vigencia.gte.2024-03-01,data_inicio_vigencia.lte.2024-03-31),and(data_inicio_vigencia.is.null,ano.eq.2024,mes_referencia.eq.3)",
    ]);
    expect(r).toMatchObject({ parada: "fim", conferencia: CONFERENCIA });
  });

  it("janela completa sem conferência: confere sem reimportar, na linha do órgão", async () => {
    lerCheckpointCgu.mockResolvedValue({ cursor: 3, total: 40, completa: true });
    const r = await pedido("cgu_contratos", params);
    expect(rodadaContratosCgu).not.toHaveBeenCalled();
    expect(ultimaConferenciaDaJanela).toHaveBeenCalledWith("cgu", { ano: 2024, mes: 3 }, "26000");
    expect(conferirSemReimportar).toHaveBeenCalledWith(
      expect.objectContaining({ fonte: "cgu", escopo: "26000" }),
    );
    expect(r).toMatchObject({ importados: { contratos: 0 }, parada: "janela_completa" });
  });

  it("recusa: sem janela, janela maior que um mês, fora da disponibilidade e órgão fora do Portal", async () => {
    for (const p of [
      { codigoOrgao: "26000" },
      { codigoOrgao: "26000", dataInicial: "2024-03-01", dataFinal: "2024-04-30" },
      { codigoOrgao: "26000", dataInicial: "2010-03-01", dataFinal: "2010-03-31" },
      { codigoOrgao: "01000", ...MARCO },
    ]) {
      expect(await pedido("cgu_contratos", p)).toHaveProperty("recusa");
    }
    expect(rodadaContratosCgu).not.toHaveBeenCalled();
  });
});

describe("modo nomeado — catálogo SIAFI e atividade dos órgãos", () => {
  it("catálogo: cadastro retomável na linha `nomes` da fonte orgaos_siafi", async () => {
    rodadaCatalogoSiafi.mockResolvedValue({
      importados: 40,
      invalidos: 2,
      totalBruto: 42,
      erros: [],
      varredura: varreduraDoCatalogo(),
    });
    const r = await pedido("cgu_siafi", {});
    expect(lerCheckpointImportacao).toHaveBeenCalledWith("orgaos_siafi#nomes");
    expect(rodadaCatalogoSiafi).toHaveBeenCalledWith(
      { maxPaginas: 5000, delayMs: 120 },
      null,
      ORIGEM,
    );
    expect(conferirEGravar).toHaveBeenCalledWith(
      EXECUCAO,
      expect.objectContaining({ janela: null, acumulado: 40, origem: null, recente: false }),
      null,
    );
    expect(r).toMatchObject({ importados: { orgaos: 40 }, haMais: false, parada: "fim" });
  });

  it("catálogo parcial: segue na próxima rodada, sem conferência", async () => {
    rodadaCatalogoSiafi.mockResolvedValue({
      importados: 150,
      invalidos: 0,
      totalBruto: 150,
      erros: [],
      varredura: varreduraDoCatalogo({ haMais: true, orcamentoEsgotado: true }),
    });
    const r = await pedido("cgu_siafi", {});
    expect(r).toMatchObject({ haMais: true, parada: "tempo", conferencia: null });
  });

  it("atividade: um órgão por passo, na linha `atividade`; ativos e inativos como aviso", async () => {
    rodadaAtividadeOrgaos.mockResolvedValue({
      verificados: 30,
      ativos: 25,
      inativos: 5,
      total: 30,
      erros: [],
      varredura: varreduraDoCatalogo({ totalAcumulado: 30 }),
    });
    const r = await pedido("cgu_atividade", {});
    expect(lerCheckpointImportacao).toHaveBeenCalledWith("orgaos_siafi#atividade");
    expect(rodadaAtividadeOrgaos).toHaveBeenCalledWith({ delayMs: 250 }, null, ORIGEM);
    expect(r).toMatchObject({
      importados: { orgaos: 30 },
      erros: [],
      avisos: ["info: 25 ativos e 5 inativos nesta rodada, de 30 órgãos na sonda"],
      parada: "fim",
    });
  });

  it("janela completa do catálogo: confere sem reimportar, só na linha dele", async () => {
    lerCheckpointImportacao.mockResolvedValue({ cursor: 300, total: 900, completa: true });
    await pedido("cgu_siafi", {});
    expect(rodadaCatalogoSiafi).not.toHaveBeenCalled();
    expect(ultimaConferenciaDaJanela).toHaveBeenCalledWith("orgaos_siafi", null, "nomes");
    expect(conferirSemReimportar).toHaveBeenCalledWith(
      expect.objectContaining({ fonte: "orgaos_siafi", escopo: "nomes", contarNaCelula: null }),
    );
  });

  it("pendentes: uma janela de cadastro por rotina, cada uma na sua linha", async () => {
    const siafi = await consultarPendentes({ consulta: "pendentes", tarefa: "cgu_siafi" });
    expect(lerConferencias).toHaveBeenLastCalledWith("orgaos_siafi", "nomes");
    expect(siafi).toMatchObject({ janelas: [{ ano: 0, mes: 0, dataInicio: "", ultima: null }] });
    await consultarPendentes({ consulta: "pendentes", tarefa: "cgu_atividade" });
    expect(lerConferencias).toHaveBeenLastCalledWith("orgaos_siafi", "atividade");
  });
});

describe("pendentes por órgão — órgãos ativos do catálogo", () => {
  const HOJE = new Date(2024, 4, 15); // maio de 2024
  const conferencia = (escopo: string, ano: number, mes: number, estado = "aprovada") => ({
    ano,
    mes,
    escopo,
    estado,
    motivo: estado,
    execucao_id: null,
    consultado_em: "2024-05-01T00:00:00Z",
  });

  it("sem órgão no pedido: os ativos do catálogo, órgão × mês, do mais recente ao mais antigo", async () => {
    orgaosAtivosDoCatalogo.mockResolvedValue(["26000", "36000"]);
    lerConferencias.mockResolvedValue([
      conferencia("26000", 2024, 5),
      conferencia("36000", 2024, 4, "reprovada"),
    ]);
    const r = await pendentesPorOrgao("cgu", undefined, HOJE);
    expect(lerConferencias).toHaveBeenCalledWith("cgu");
    const janelas = "recusa" in r ? [] : r;
    expect(janelas.slice(0, 4).map((j) => [j.ano, j.mes, j.escopo])).toEqual([
      [2024, 5, "36000"],
      [2024, 4, "26000"],
      [2024, 4, "36000"],
      [2024, 3, "26000"],
    ]);
    expect(janelas[2].ultima).toMatchObject({ estado: "reprovada" });
    // Cada órgão vai de maio de 2024 até o início da fonte (2013).
    expect(janelas.at(-1)).toMatchObject({ ano: 2013, mes: 1, escopo: "36000" });
  });

  it("com a lista: só os órgãos pedidos, sem consultar o catálogo", async () => {
    const r = await pendentesPorOrgao("cgu_licitacoes", { codigosOrgao: ["36000", "26000"] }, HOJE);
    expect(orgaosAtivosDoCatalogo).not.toHaveBeenCalled();
    expect("recusa" in r ? [] : r.slice(0, 2).map((j) => j.escopo)).toEqual(["36000", "26000"]);
  });

  it("catálogo sem órgãos ativos: nenhuma pendente", async () => {
    expect(await pendentesPorOrgao("cgu", {}, HOJE)).toEqual([]);
    expect(lerConferencias).not.toHaveBeenCalled();
  });

  it("recusa código inválido e os dois recortes juntos", async () => {
    expect(await pendentesPorOrgao("cgu", { codigoOrgao: "MEC" })).toHaveProperty("recusa");
    expect(
      await pendentesPorOrgao("cgu", { codigoOrgao: "26000", codigosOrgao: ["36000"] }),
    ).toHaveProperty("recusa");
  });

  it("a rota usa as pendentes por órgão nos contratos e nas licitações", async () => {
    orgaosAtivosDoCatalogo.mockResolvedValue(["26000"]);
    await consultarPendentes({ consulta: "pendentes", tarefa: "cgu_contratos" });
    expect(lerConferencias).toHaveBeenLastCalledWith("cgu", "26000");
    await consultarPendentes({ consulta: "pendentes", tarefa: "cgu_licitacoes" });
    expect(lerConferencias).toHaveBeenLastCalledWith("cgu_licitacoes", "26000");
  });
});
