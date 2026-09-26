import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Adaptadores de fonte do modo nomeado (`adaptadores/`): cada tarefa valida a
// sua janela natural, chama o núcleo da fonte como a ferramenta (`userId`
// nulo, gatilho `ferramenta`) e traduz o retorno para a resposta única — com
// o total da origem, quando existe, chegando à conferência da janela.
// Núcleos, checkpoint e banco são mocks.
// ---------------------------------------------------------------------------
const lerCheckpoint = vi.fn();
const lerCheckpointCgu = vi.fn();
const conferirEGravar = vi.fn();
const lerConferencias = vi.fn();
const ultimaConferenciaDaJanela = vi.fn();
const nucleos = {
  rodadaContratosPNCP: vi.fn(),
  rodadaConvenios: vi.fn(),
  rodadaCEAPMes: vi.fn(),
  rodadaCadastroCamara: vi.fn(),
  rodadaCEAPSMes: vi.fn(),
  rodadaMaterias: vi.fn(),
  rodadaProposicoes: vi.fn(),
  rodadaMunicipiosIBGE: vi.fn(),
  totalDaOrigemIBGE: vi.fn(),
  rodadaRelatorioSiconfi: vi.fn(),
};

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { rpc: vi.fn(), from: vi.fn() },
}));
vi.mock("@/lib/data/checkpoint.server", () => ({
  checkpointImportacao: { ler: lerCheckpoint, salvar: vi.fn() },
}));
vi.mock("@/lib/data/automacao/conferencia.server", () => ({
  conferirEGravar,
  contarRegistrosNaJanela: vi.fn(),
  lerConferencias,
  ultimaConferenciaDaJanela,
  conferirSemReimportar: vi.fn(),
}));
vi.mock("@/lib/data/pncp/ingest.functions", async (original) => ({
  ...(await original<typeof import("@/lib/data/pncp/ingest.functions")>()),
  rodadaContratosPNCP: nucleos.rodadaContratosPNCP,
}));
vi.mock("@/lib/data/real/sweep", async (original) => ({
  ...(await original<typeof import("@/lib/data/real/sweep")>()),
  checkpointCguVarredura: { ler: lerCheckpointCgu, salvar: vi.fn() },
}));
vi.mock("@/lib/data/real/convenios.functions", async (original) => ({
  ...(await original<typeof import("@/lib/data/real/convenios.functions")>()),
  rodadaConvenios: nucleos.rodadaConvenios,
}));
vi.mock("@/lib/data/camara/ingest.functions", async (original) => ({
  ...(await original<typeof import("@/lib/data/camara/ingest.functions")>()),
  rodadaCEAPMes: nucleos.rodadaCEAPMes,
  rodadaCadastroCamara: nucleos.rodadaCadastroCamara,
}));
vi.mock("@/lib/data/senado/ingest.functions", async (original) => ({
  ...(await original<typeof import("@/lib/data/senado/ingest.functions")>()),
  rodadaCEAPSMes: nucleos.rodadaCEAPSMes,
}));
vi.mock("@/lib/data/senado/materias.functions", async (original) => ({
  ...(await original<typeof import("@/lib/data/senado/materias.functions")>()),
  rodadaMaterias: nucleos.rodadaMaterias,
}));
vi.mock("@/lib/data/camara/proposicoes.functions", async (original) => ({
  ...(await original<typeof import("@/lib/data/camara/proposicoes.functions")>()),
  rodadaProposicoes: nucleos.rodadaProposicoes,
}));
vi.mock("@/lib/data/ibge/ingest.functions", async (original) => ({
  ...(await original<typeof import("@/lib/data/ibge/ingest.functions")>()),
  rodadaMunicipiosIBGE: nucleos.rodadaMunicipiosIBGE,
  totalDaOrigemIBGE: nucleos.totalDaOrigemIBGE,
}));
vi.mock("@/lib/data/siconfi/ingest.functions", async (original) => ({
  ...(await original<typeof import("@/lib/data/siconfi/ingest.functions")>()),
  rodadaRelatorioSiconfi: nucleos.rodadaRelatorioSiconfi,
}));

const { executarRodadaNomeada, consultarPendentes } = await import("./nomeado");

const EXECUCAO = "7d1f3c2a-9b8e-4f6d-a5c4-3b2a1f0e9d8c";
const FERRAMENTA = { gatilho: "ferramenta", execucaoId: EXECUCAO };
const CONFERENCIA = { estado: "aprovada", motivo: "ok" };

/** Varredura que terminou nesta rodada. */
const FIM = {
  haMais: false,
  cursor: 3,
  totalAcumulado: 30,
  orcamentoEsgotado: false,
  custoEsgotado: false,
};

const pedir = (tarefa: string, params: unknown) =>
  executarRodadaNomeada({ tarefa, params, execucao_id: EXECUCAO });

beforeEach(() => {
  lerCheckpoint.mockReset();
  lerCheckpoint.mockResolvedValue(null);
  lerCheckpointCgu.mockReset();
  lerCheckpointCgu.mockResolvedValue(null);
  conferirEGravar.mockReset();
  conferirEGravar.mockResolvedValue(CONFERENCIA);
  lerConferencias.mockReset();
  lerConferencias.mockResolvedValue([]);
  ultimaConferenciaDaJanela.mockReset();
  for (const n of Object.values(nucleos)) n.mockReset();
});

/** A entrada da conferência que a rota montou na última rodada. */
const entradaDaConferencia = () => conferirEGravar.mock.calls[0][1];

describe("PNCP", () => {
  const MARCO = { dataInicial: "2024-03-01", dataFinal: "2024-03-31" };

  it("importa um mês e leva o totalRegistros à conferência", async () => {
    nucleos.rodadaContratosPNCP.mockResolvedValue({
      importados: 30,
      paginas: 1,
      erros: [],
      origem: { total: 30, descartados: 0 },
      varredura: FIM,
    });
    const r = await pedir("pncp", MARCO);
    expect(nucleos.rodadaContratosPNCP).toHaveBeenCalledWith(
      { ...MARCO, maxPaginas: 2000 },
      null,
      FERRAMENTA,
    );
    expect(r).toMatchObject({ importados: { contratos: 30 }, parada: "fim" });
    expect(entradaDaConferencia()).toMatchObject({
      janela: { ano: 2024, mes: 3 },
      origem: { total: 30, descartados: 0 },
    });
  });

  it("janela maior que um mês é recusada", async () => {
    const r = await pedir("pncp", { dataInicial: "2024-03-01", dataFinal: "2024-04-30" });
    expect(r).toHaveProperty("recusa");
    expect(nucleos.rodadaContratosPNCP).not.toHaveBeenCalled();
  });
});

describe("convênios por período", () => {
  const MARCO = { dataInicial: "2024-03-01", dataFinal: "2024-03-31" };

  it("importa um mês; a origem não informa total", async () => {
    nucleos.rodadaConvenios.mockResolvedValue({
      meta: {
        importados: 45,
        erros: [],
        varredura: {
          ultimaPagina: 3,
          completa: true,
          haMais: false,
          processados: 15,
          totalAcumulado: 45,
          orcamentoEsgotado: false,
        },
      },
    });
    const r = await pedir("convenios", MARCO);
    // A varredura dos convênios mora em `cgu_varredura`, não na genérica.
    expect(lerCheckpointCgu).toHaveBeenCalledWith("convenios#geral#2024-03-01#2024-03-31");
    expect(nucleos.rodadaConvenios).toHaveBeenCalledWith(
      { ...MARCO, maxPaginas: 5000, delayMs: 800, orcamentoMs: 180000 },
      null,
      FERRAMENTA,
    );
    expect(r).toMatchObject({
      importados: { convenios: 15 },
      cursor: 3,
      totalAcumulado: 45,
      parada: "fim",
    });
    expect(entradaDaConferencia()).toMatchObject({ janela: { ano: 2024, mes: 3 }, origem: null });
  });

  it("antes de 2017 está fora da janela da fonte", async () => {
    const r = await pedir("convenios", { dataInicial: "2016-03-01", dataFinal: "2016-03-31" });
    expect(r).toHaveProperty("recusa");
  });
});

describe("CEAP e CEAPS", () => {
  const varredura = { ...FIM, totalDeputados: 513 };

  it("CEAP importa um mês, sem total da origem", async () => {
    nucleos.rodadaCEAPMes.mockResolvedValue({
      importados: 30,
      deputadosProcessados: 12,
      erros: [],
      varredura,
    });
    const r = await pedir("camara_ceap", { ano: 2024, mes: 3 });
    expect(nucleos.rodadaCEAPMes).toHaveBeenCalledWith({ ano: 2024, mes: 3 }, null, FERRAMENTA);
    expect(r).toMatchObject({ importados: { despesas: 30, deputados: 12 } });
    expect(entradaDaConferencia()).toMatchObject({ janela: { ano: 2024, mes: 3 }, origem: null });
  });

  it("CEAP antes de 2009 está fora da janela da fonte", async () => {
    expect(await pedir("camara_ceap", { ano: 2008, mes: 3 })).toHaveProperty("recusa");
  });

  it("CEAPS leva o tamanho da lista do mês à conferência", async () => {
    nucleos.rodadaCEAPSMes.mockResolvedValue({
      importados: 30,
      senadoresProcessados: 70,
      erros: [],
      origem: { total: 31, descartados: 1 },
      varredura,
    });
    const r = await pedir("senado_ceaps", { ano: 2024, mes: 3 });
    expect(r).toMatchObject({ importados: { despesas: 30 } });
    expect(entradaDaConferencia()).toMatchObject({ origem: { total: 31, descartados: 1 } });
  });
});

describe("matérias e proposições (janela anual)", () => {
  it("matérias: um ano de uma sigla, ancorado em janeiro", async () => {
    nucleos.rodadaMaterias.mockResolvedValue({
      importados: 28,
      autores: 28,
      erros: [],
      origem: { total: 30, descartados: 2 },
      varredura: FIM,
    });
    const r = await pedir("senado_mat", { ano: 2023 });
    expect(nucleos.rodadaMaterias).toHaveBeenCalledWith(
      { ano: 2023, sigla: "PL" },
      null,
      FERRAMENTA,
    );
    expect(r).toMatchObject({ importados: { materias: 28, autores: 28 } });
    expect(entradaDaConferencia()).toMatchObject({
      janela: { ano: 2023, mes: 1 },
      origem: { total: 30, descartados: 2 },
      recente: false,
    });
  });

  it("janela completa: a conferência é a da sigla", async () => {
    lerCheckpoint.mockResolvedValue({ cursor: 30, total: 30, completa: true });
    ultimaConferenciaDaJanela.mockResolvedValue({ estado: "aprovada", motivo: "ok" });
    await pedir("senado_mat", { ano: 2023, sigla: "PEC" });
    expect(ultimaConferenciaDaJanela).toHaveBeenCalledWith(
      "senado_mat",
      { ano: 2023, mes: 1 },
      "PEC",
    );
    expect(nucleos.rodadaMaterias).not.toHaveBeenCalled();
  });

  it("o ano corrente ainda pode crescer na origem: é recente", async () => {
    nucleos.rodadaMaterias.mockResolvedValue({
      importados: 1,
      autores: 1,
      erros: [],
      origem: null,
      varredura: FIM,
    });
    await pedir("senado_mat", { ano: new Date().getFullYear() });
    expect(entradaDaConferencia()).toMatchObject({ recente: true });
  });

  it("proposições levam o X-Total-Count à conferência", async () => {
    nucleos.rodadaProposicoes.mockResolvedValue({
      importados: 30,
      autores: 40,
      erros: [],
      origem: { total: 30, descartados: 0 },
      varredura: FIM,
    });
    const r = await pedir("camara_props", { ano: 2024, siglaTipo: "PDL" });
    expect(nucleos.rodadaProposicoes).toHaveBeenCalledWith(
      { ano: 2024, siglaTipo: "PDL", maxPaginas: 200 },
      null,
      FERRAMENTA,
    );
    expect(r).toMatchObject({ importados: { proposicoes: 30, autores: 40 } });
    expect(entradaDaConferencia()).toMatchObject({ origem: { total: 30, descartados: 0 } });
  });

  it("ano no futuro é recusado", async () => {
    const r = await pedir("camara_props", { ano: new Date().getFullYear() + 1 });
    expect(r).toHaveProperty("recusa");
  });
});

describe("cadastros", () => {
  it("IBGE: na última rodada busca o total nacional", async () => {
    nucleos.rodadaMunicipiosIBGE.mockResolvedValue({ importados: 400, erros: [], varredura: FIM });
    nucleos.totalDaOrigemIBGE.mockResolvedValue({ total: 5571, descartados: 0 });
    const r = await pedir("ibge", {});
    expect(nucleos.rodadaMunicipiosIBGE).toHaveBeenCalledWith(null, FERRAMENTA);
    expect(r).toMatchObject({ importados: { municipios: 400 } });
    expect(entradaDaConferencia()).toMatchObject({
      janela: null,
      origem: { total: 5571, descartados: 0 },
    });
    // Sem célula no tempo: a cobertura se confere pela contagem.
    expect(conferirEGravar.mock.calls[0][2]).toBeNull();
  });

  it("IBGE: rodada intermediária não busca o total", async () => {
    nucleos.rodadaMunicipiosIBGE.mockResolvedValue({
      importados: 400,
      erros: [],
      varredura: { ...FIM, haMais: true, orcamentoEsgotado: true },
    });
    await pedir("ibge", {});
    expect(nucleos.totalDaOrigemIBGE).not.toHaveBeenCalled();
  });

  it("IBGE: falha ao buscar o total deixa a conferência inconclusiva", async () => {
    nucleos.rodadaMunicipiosIBGE.mockResolvedValue({ importados: 400, erros: [], varredura: FIM });
    nucleos.totalDaOrigemIBGE.mockRejectedValue(new Error("IBGE 503"));
    await pedir("ibge", {});
    expect(entradaDaConferencia()).toMatchObject({ falhaAoConsultarOrigem: "IBGE 503" });
  });

  it("cadastro da Câmara: chamada única, sempre roda, total com as repetições", async () => {
    nucleos.rodadaCadastroCamara.mockResolvedValue({
      importados: 648,
      legislatura: 57,
      erros: [],
      origem: { total: 879, descartados: 231 },
    });
    const r = await pedir("camara_cadastro", {});
    expect(lerCheckpoint).not.toHaveBeenCalled();
    expect(nucleos.rodadaCadastroCamara).toHaveBeenCalledWith({}, null, FERRAMENTA);
    expect(r).toMatchObject({
      importados: { deputados: 648 },
      haMais: false,
      cursor: null,
      totalAcumulado: 648,
      parada: "fim",
    });
    expect(entradaDaConferencia()).toMatchObject({
      janela: null,
      acumulado: 648,
      origem: { total: 879, descartados: 231 },
    });
  });
});

describe("SICONFI relatório", () => {
  const RGF = { codIbge: "35", exercicio: 2023, periodo: 3, tipoRelatorio: "RGF" };

  it("um relatório de um ente; a janela é a célula tipo × exercício × período", async () => {
    nucleos.rodadaRelatorioSiconfi.mockResolvedValue({
      importados: 120,
      requisicoes: 5,
      aviso: "Sem RGF publicado para o(s) poder(es) J.",
      erros: [],
    });
    const r = await pedir("siconfi_relatorio", RGF);
    expect(nucleos.rodadaRelatorioSiconfi).toHaveBeenCalledWith(RGF, null, FERRAMENTA);
    expect(r).toMatchObject({
      importados: { linhas: 120 },
      avisos: ["info: Sem RGF publicado para o(s) poder(es) J."],
      haMais: false,
      parada: "fim",
    });
    expect(entradaDaConferencia()).toMatchObject({
      janela: { ano: 2023, mes: 3 },
      acumulado: 120,
      origem: null,
    });
  });

  it("DCA é anual: a célula é o período 0", async () => {
    nucleos.rodadaRelatorioSiconfi.mockResolvedValue({ importados: 0, requisicoes: 2, erros: [] });
    await pedir("siconfi_relatorio", { codIbge: "35", exercicio: 2023, tipoRelatorio: "DCA" });
    expect(entradaDaConferencia()).toMatchObject({ janela: { ano: 2023, mes: 0 } });
  });

  it.each([
    ["RGF sem período", { codIbge: "35", exercicio: 2023, tipoRelatorio: "RGF" }],
    ["RGF no 4º período", { ...RGF, periodo: 4 }],
    ["DCA com período", { codIbge: "35", exercicio: 2023, periodo: 1, tipoRelatorio: "DCA" }],
    ["exercício antes de 2013", { ...RGF, exercicio: 2012 }],
  ])("%s é recusado", async (_nome, params) => {
    expect(await pedir("siconfi_relatorio", params)).toHaveProperty("recusa");
    expect(nucleos.rodadaRelatorioSiconfi).not.toHaveBeenCalled();
  });
});

describe("pendentes das fontes novas", () => {
  const pendentes = (tarefa: string, params?: unknown) =>
    consultarPendentes({ consulta: "pendentes", tarefa, params });

  it("PNCP é mensal", async () => {
    const r = await pendentes("pncp");
    expect(lerConferencias).toHaveBeenCalledWith("pncp");
    expect("janelas" in r && r.janelas[0].dataInicio.endsWith("-01")).toBe(true);
  });

  it("proposições: por ano e tipo, nos tipos do painel quando o pedido não diz qual", async () => {
    const r = await pendentes("camara_props");
    for (const tipo of ["PL", "PEC", "PLP", "MPV", "PDL", "PRC"]) {
      expect(lerConferencias).toHaveBeenCalledWith("camara_props", tipo);
    }
    const janelas = "janelas" in r ? r.janelas : [];
    const ano = new Date().getFullYear();
    expect(janelas.slice(0, 6).map((j) => [j.ano, j.mes, j.escopo])).toEqual(
      ["PL", "PEC", "PLP", "MPV", "PDL", "PRC"].map((t) => [ano, 1, t]),
    );
    expect(janelas.at(-1)).toMatchObject({ ano: 1988, escopo: "PRC" });
  });

  it("matérias: aprovar as PL de um ano não tira as PEC do mesmo ano", async () => {
    lerConferencias.mockImplementation(async (_fonte: string, sigla: string) =>
      sigla === "PL"
        ? [
            {
              ano: 2024,
              mes: 1,
              estado: "aprovada",
              motivo: "ok",
              execucao_id: "e",
              consultado_em: "2026-09-01",
            },
          ]
        : [],
    );
    const r = await pendentes("senado_mat", { sigla: "PL" });
    const pl = "janelas" in r ? r.janelas : [];
    expect(pl.every((j) => j.escopo === "PL")).toBe(true);
    expect(pl.some((j) => j.ano === 2024)).toBe(false);

    const todas = await pendentes("senado_mat");
    const de2024 = ("janelas" in todas ? todas.janelas : []).filter((j) => j.ano === 2024);
    expect(de2024.map((j) => j.escopo)).toEqual(["PLS", "PEC", "PLP", "PDL", "PRC", "MPV"]);
  });

  it("cadastros têm uma janela só", async () => {
    expect(await pendentes("ibge")).toMatchObject({ janelas: [{ ano: 0, mes: 0, ultima: null }] });
    expect(lerConferencias).toHaveBeenCalledWith("ibge");
    await pendentes("camara_cadastro");
    expect(lerConferencias).toHaveBeenCalledWith("camara_deputados");
  });

  it("SICONFI: por ente e relatório, nos períodos do tipo", async () => {
    const r = await pendentes("siconfi_relatorio", { codIbge: "35", tipoRelatorio: "RGF" });
    expect(lerConferencias).toHaveBeenCalledWith("siconfi", {
      orgaoCod: "35",
      escopoComeca: "RGF",
    });
    const janelas = "janelas" in r ? r.janelas : [];
    expect(janelas.at(-1)).toMatchObject({ ano: 2013, mes: 1 });
    expect(janelas.every((j) => j.mes >= 1 && j.mes <= 3)).toBe(true);
  });

  it("SICONFI sem o ente é recusado", async () => {
    expect(await pendentes("siconfi_relatorio")).toHaveProperty("recusa");
  });
});
