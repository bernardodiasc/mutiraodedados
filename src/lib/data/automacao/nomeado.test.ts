import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Modo nomeado de `/api/cron-importar`: tarefa + janela pedidas no corpo,
// sem passar pela fila. Núcleos, checkpoint e banco são mocks — aqui interessa
// o contrato da rota: validação, janela completa e o formato da resposta.
// ---------------------------------------------------------------------------
const rpc = vi.fn(async () => ({ data: null, error: null }));
const lerCheckpoint = vi.fn();
const rodadaVotacoesCamara = vi.fn();
const rodadaVotacoesSenado = vi.fn();
const conferirEGravar = vi.fn();
const contarRegistrosNaJanela = vi.fn();
const lerConferencias = vi.fn();
const ultimaConferenciaDaJanela = vi.fn();
const conferirSemReimportar = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { rpc, from: vi.fn() },
}));
vi.mock("@/lib/data/checkpoint.server", () => ({
  checkpointImportacao: { ler: lerCheckpoint, salvar: vi.fn() },
}));
vi.mock("@/lib/data/automacao/conferencia.server", () => ({
  conferirEGravar,
  contarRegistrosNaJanela,
  lerConferencias,
  ultimaConferenciaDaJanela,
  conferirSemReimportar,
}));
vi.mock("@/lib/data/pncp/ingest.functions", async (original) => ({
  ...(await original<typeof import("@/lib/data/pncp/ingest.functions")>()),
  rodadaContratosPNCP: vi.fn(),
}));
vi.mock("@/lib/data/real/convenios.functions", async (original) => ({
  ...(await original<typeof import("@/lib/data/real/convenios.functions")>()),
  rodadaConvenios: vi.fn(),
}));
vi.mock("@/lib/data/camara/ingest.functions", async (original) => ({
  ...(await original<typeof import("@/lib/data/camara/ingest.functions")>()),
  rodadaCEAPMes: vi.fn(),
}));
vi.mock("@/lib/data/senado/ingest.functions", async (original) => ({
  ...(await original<typeof import("@/lib/data/senado/ingest.functions")>()),
  rodadaCEAPSMes: vi.fn(),
}));
vi.mock("@/lib/data/camara/votacoes.functions", async (original) => ({
  ...(await original<typeof import("@/lib/data/camara/votacoes.functions")>()),
  rodadaVotacoesCamara,
}));
vi.mock("@/lib/data/senado/votacoes.functions", async (original) => ({
  ...(await original<typeof import("@/lib/data/senado/votacoes.functions")>()),
  rodadaVotacoesSenado,
}));
vi.mock("@/lib/data/senado/materias.functions", async (original) => ({
  ...(await original<typeof import("@/lib/data/senado/materias.functions")>()),
  rodadaMaterias: vi.fn(),
}));
vi.mock("@/lib/data/camara/proposicoes.functions", async (original) => ({
  ...(await original<typeof import("@/lib/data/camara/proposicoes.functions")>()),
  rodadaProposicoes: vi.fn(),
}));
vi.mock("@/lib/data/convenios-origem/ingest.functions", async (original) => ({
  ...(await original<typeof import("@/lib/data/convenios-origem/ingest.functions")>()),
  rodadaConveniosOrigem: vi.fn(),
}));
vi.mock("@/lib/data/ibge/ingest.functions", async (original) => ({
  ...(await original<typeof import("@/lib/data/ibge/ingest.functions")>()),
  rodadaMunicipiosIBGE: vi.fn(),
}));

const { executarTiqueAutomacao } = await import("./tique.server");

const SEGREDO = "segredo-de-teste";
const EXECUCAO = "7d1f3c2a-9b8e-4f6d-a5c4-3b2a1f0e9d8c";
const MARCO_2024 = { dataInicio: "2024-03-01", dataFim: "2024-03-31" };

function chamar(corpo?: unknown): Promise<Response> {
  return executarTiqueAutomacao(
    new Request("https://exemplo.test/api/cron-importar", {
      method: "POST",
      headers: { "x-cron-secret": SEGREDO, "content-type": "application/json" },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    }),
  );
}

const CONFERENCIA = { estado: "aprovada", motivo: "Janela completa: 3 de 3 registros da origem." };

function rodadaVotacoes(parcial: Record<string, unknown> = {}) {
  return {
    votacoes: 12,
    votos: 5130,
    erros: [] as string[],
    origem: null as { total: number; descartados: number } | null,
    varredura: {
      haMais: true,
      cursor: 12,
      totalAcumulado: 40,
      orcamentoEsgotado: true,
      custoEsgotado: false,
    },
    ...parcial,
  };
}

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", SEGREDO);
  rpc.mockClear();
  lerCheckpoint.mockReset();
  lerCheckpoint.mockResolvedValue(null);
  rodadaVotacoesCamara.mockReset();
  rodadaVotacoesSenado.mockReset();
  conferirEGravar.mockReset();
  conferirEGravar.mockResolvedValue(CONFERENCIA);
  contarRegistrosNaJanela.mockReset();
  lerConferencias.mockReset();
  ultimaConferenciaDaJanela.mockReset();
  ultimaConferenciaDaJanela.mockResolvedValue(null);
  conferirSemReimportar.mockReset();
  conferirSemReimportar.mockResolvedValue(CONFERENCIA);
});

describe("/api/cron-importar — modo fila continua sendo o padrão", () => {
  it("sem corpo reivindica a fila", async () => {
    await chamar();
    expect(rpc).toHaveBeenCalledWith("automacao_reivindicar_tarefa");
  });

  it("corpo vazio `{}` (o que o pg_net manda) também é modo fila", async () => {
    await chamar({});
    expect(rpc).toHaveBeenCalledWith("automacao_reivindicar_tarefa");
  });
});

describe("/api/cron-importar — modo nomeado", () => {
  it("roda a rodada pedida sem tocar na fila e responde no formato único", async () => {
    rodadaVotacoesCamara.mockResolvedValue(
      rodadaVotacoes({
        erros: ["vot 123: timeout", "info: aviso qualquer"],
      }),
    );
    const r = await chamar({ tarefa: "camara_vot", params: MARCO_2024, execucao_id: EXECUCAO });

    expect(r.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
    expect(rodadaVotacoesCamara).toHaveBeenCalledWith({ ...MARCO_2024, maxPaginas: 2000 }, null, {
      gatilho: "ferramenta",
      execucaoId: EXECUCAO,
    });
    expect(await r.json()).toEqual({
      tarefa: "camara_vot",
      params: { ...MARCO_2024, maxPaginas: 2000 },
      execucao_id: EXECUCAO,
      importados: { votacoes: 12, votos: 5130 },
      erros: ["vot 123: timeout"],
      avisos: ["info: aviso qualquer"],
      haMais: true,
      cursor: 12,
      totalAcumulado: 40,
      parada: "tempo",
      conferencia: null,
    });
    // Rodada intermediária não confere a janela.
    expect(conferirEGravar).not.toHaveBeenCalled();
  });

  it("Senado votações pelo mesmo contrato", async () => {
    rodadaVotacoesSenado.mockResolvedValue(
      rodadaVotacoes({
        votacoes: 3,
        votos: 243,
        varredura: {
          haMais: false,
          cursor: 3,
          totalAcumulado: 3,
          orcamentoEsgotado: false,
          custoEsgotado: false,
        },
      }),
    );
    const r = await chamar({ tarefa: "senado_vot", params: MARCO_2024, execucao_id: EXECUCAO });
    expect(rodadaVotacoesSenado).toHaveBeenCalledWith(MARCO_2024, null, {
      gatilho: "ferramenta",
      execucaoId: EXECUCAO,
    });
    expect(await r.json()).toMatchObject({
      importados: { votacoes: 3, votos: 243 },
      haMais: false,
      parada: "fim",
      conferencia: CONFERENCIA,
    });
  });

  it("na última rodada confere a execução inteira e devolve o veredito", async () => {
    rodadaVotacoesCamara.mockResolvedValue(
      rodadaVotacoes({
        origem: { total: 819, descartados: 0 },
        varredura: {
          haMais: false,
          cursor: 819,
          totalAcumulado: 819,
          orcamentoEsgotado: false,
          custoEsgotado: false,
        },
      }),
    );
    contarRegistrosNaJanela.mockResolvedValue(819);
    const r = await chamar({ tarefa: "camara_vot", params: MARCO_2024, execucao_id: EXECUCAO });

    expect(conferirEGravar).toHaveBeenCalledWith(
      EXECUCAO,
      {
        janela: { ano: 2024, mes: 3 },
        terminou: true,
        acumulado: 819,
        origem: { total: 819, descartados: 0 },
        recente: false,
        findingsNovos: null,
      },
      expect.any(Function),
    );
    // A célula é contada na tabela da fonte, dentro da janela.
    const contar = conferirEGravar.mock.calls[0][2] as () => Promise<number>;
    expect(await contar()).toBe(819);
    expect(contarRegistrosNaJanela).toHaveBeenCalledWith("camara_votacoes_cache", {
      ...MARCO_2024,
      maxPaginas: 2000,
    });
    expect((await r.json()).conferencia).toEqual(CONFERENCIA);
  });

  it("falha ao conferir responde 500", async () => {
    rodadaVotacoesSenado.mockResolvedValue(
      rodadaVotacoes({
        varredura: {
          haMais: false,
          cursor: 1,
          totalAcumulado: 1,
          orcamentoEsgotado: false,
          custoEsgotado: false,
        },
      }),
    );
    conferirEGravar.mockRejectedValue(new Error("conferência: gravação: boom"));
    const r = await chamar({ tarefa: "senado_vot", params: MARCO_2024, execucao_id: EXECUCAO });
    expect(r.status).toBe(500);
  });

  it("rodada que parou sem fim, sem tempo e sem teto parou por erro", async () => {
    rodadaVotacoesCamara.mockResolvedValue(
      rodadaVotacoes({
        erros: ["lista: TRANSIENT: 503"],
        varredura: {
          haMais: true,
          cursor: 0,
          totalAcumulado: 0,
          orcamentoEsgotado: false,
          custoEsgotado: false,
        },
      }),
    );
    const r = await chamar({ tarefa: "camara_vot", params: MARCO_2024, execucao_id: EXECUCAO });
    expect(await r.json()).toMatchObject({ parada: "erro", haMais: true });
  });

  it("teto de subrequisições é um motivo de parada próprio", async () => {
    rodadaVotacoesCamara.mockResolvedValue(
      rodadaVotacoes({
        varredura: {
          haMais: true,
          cursor: 9,
          totalAcumulado: 9,
          orcamentoEsgotado: false,
          custoEsgotado: true,
        },
      }),
    );
    const r = await chamar({ tarefa: "camara_vot", params: MARCO_2024, execucao_id: EXECUCAO });
    expect(await r.json()).toMatchObject({ parada: "subrequisicoes" });
  });

  it("janela já completa e aprovada: não refaz nem confere, devolve o estado", async () => {
    lerCheckpoint.mockResolvedValue({ cursor: 57, total: 57, completa: true });
    ultimaConferenciaDaJanela.mockResolvedValue({ estado: "aprovada", motivo: "ok" });
    const r = await chamar({ tarefa: "camara_vot", params: MARCO_2024, execucao_id: EXECUCAO });
    expect(rodadaVotacoesCamara).not.toHaveBeenCalled();
    expect(lerCheckpoint).toHaveBeenCalledWith("camara_vot#2024-03-01#2024-03-31");
    expect(ultimaConferenciaDaJanela).toHaveBeenCalledWith("camara_vot", { ano: 2024, mes: 3 });
    expect(await r.json()).toMatchObject({
      importados: { votacoes: 0, votos: 0 },
      erros: [],
      haMais: false,
      cursor: 57,
      totalAcumulado: 57,
      parada: "janela_completa",
      conferencia: null,
    });
    expect(conferirEGravar).not.toHaveBeenCalled();
    expect(conferirSemReimportar).not.toHaveBeenCalled();
  });

  it("janela já completa sem conferência aprovada: só confere, sem reimportar", async () => {
    lerCheckpoint.mockResolvedValue({ cursor: 57, total: 57, completa: true });
    ultimaConferenciaDaJanela.mockResolvedValue({ estado: "inconclusiva", motivo: "x" });
    const r = await chamar({ tarefa: "senado_vot", params: MARCO_2024, execucao_id: EXECUCAO });

    expect(rodadaVotacoesSenado).not.toHaveBeenCalled();
    expect(conferirSemReimportar).toHaveBeenCalledWith({
      fonte: "senado_vot",
      execucaoId: EXECUCAO,
      entrada: {
        janela: { ano: 2024, mes: 3 },
        acumulado: 57,
        recente: false,
        findingsNovos: null,
      },
      totalDaOrigem: expect.any(Function),
      contarNaCelula: expect.any(Function),
      descricao: "Senado: votações de 2024-03-01 a 2024-03-31",
    });
    expect(await r.json()).toMatchObject({
      parada: "janela_completa",
      haMais: false,
      conferencia: CONFERENCIA,
    });
  });

  it("janela já completa e nunca conferida também é só conferida", async () => {
    lerCheckpoint.mockResolvedValue({ cursor: 57, total: 57, completa: true });
    await chamar({ tarefa: "camara_vot", params: MARCO_2024, execucao_id: EXECUCAO });
    expect(conferirSemReimportar).toHaveBeenCalled();
    expect(rodadaVotacoesCamara).not.toHaveBeenCalled();
  });

  it("janela já completa com `reprocessar` refaz do zero", async () => {
    lerCheckpoint.mockResolvedValue({ cursor: 57, total: 57, completa: true });
    rodadaVotacoesSenado.mockResolvedValue(rodadaVotacoes());
    await chamar({
      tarefa: "senado_vot",
      params: MARCO_2024,
      execucao_id: EXECUCAO,
      reprocessar: true,
    });
    expect(rodadaVotacoesSenado).toHaveBeenCalled();
  });

  it("janela parcial segue do cursor, sem precisar de `reprocessar`", async () => {
    lerCheckpoint.mockResolvedValue({ cursor: 20, total: 20, completa: false });
    rodadaVotacoesCamara.mockResolvedValue(rodadaVotacoes());
    await chamar({ tarefa: "camara_vot", params: MARCO_2024, execucao_id: EXECUCAO });
    expect(rodadaVotacoesCamara).toHaveBeenCalled();
  });

  describe("pedidos recusados com 400, sem rodar nada", () => {
    const casos: [string, unknown][] = [
      ["tarefa sem executor nomeado", { tarefa: "xyz", params: MARCO_2024, execucao_id: EXECUCAO }],
      ["sem execucao_id", { tarefa: "camara_vot", params: MARCO_2024 }],
      [
        "execucao_id que não é uuid",
        { tarefa: "camara_vot", params: MARCO_2024, execucao_id: "janela-1" },
      ],
      [
        "data fora do formato",
        {
          tarefa: "camara_vot",
          params: { dataInicio: "01/03/2024", dataFim: "2024-03-31" },
          execucao_id: EXECUCAO,
        },
      ],
      [
        "janela maior que um mês",
        {
          tarefa: "camara_vot",
          params: { dataInicio: "2024-03-01", dataFim: "2024-04-30" },
          execucao_id: EXECUCAO,
        },
      ],
      [
        "janela invertida",
        {
          tarefa: "senado_vot",
          params: { dataInicio: "2024-03-20", dataFim: "2024-03-01" },
          execucao_id: EXECUCAO,
        },
      ],
      [
        "antes do início da fonte",
        {
          tarefa: "senado_vot",
          params: { dataInicio: "2001-03-01", dataFim: "2001-03-31" },
          execucao_id: EXECUCAO,
        },
      ],
    ];

    for (const [nome, corpo] of casos) {
      it(nome, async () => {
        const r = await chamar(corpo);
        expect(r.status).toBe(400);
        expect((await r.json()).erro).toEqual(expect.any(String));
        expect(rodadaVotacoesCamara).not.toHaveBeenCalled();
        expect(rodadaVotacoesSenado).not.toHaveBeenCalled();
        expect(rpc).not.toHaveBeenCalled();
      });
    }
  });

  it("corpo que não é JSON é recusado", async () => {
    const r = await executarTiqueAutomacao(
      new Request("https://exemplo.test/api/cron-importar", {
        method: "POST",
        headers: { "x-cron-secret": SEGREDO },
        body: "tarefa=camara_vot",
      }),
    );
    expect(r.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("/api/cron-importar — consulta de pendentes", () => {
  it("lista as janelas sem conferência aprovada, sem importar nada", async () => {
    lerConferencias.mockResolvedValue([
      {
        ano: 2003,
        mes: 3,
        estado: "aprovada",
        motivo: "ok",
        execucao_id: EXECUCAO,
        consultado_em: "2026-09-01T00:00:00Z",
      },
    ]);
    const r = await chamar({ consulta: "pendentes", tarefa: "camara_vot" });
    expect(r.status).toBe(200);
    const corpo = await r.json();
    expect(lerConferencias).toHaveBeenCalledWith("camara_vot");
    expect(corpo).toMatchObject({ consulta: "pendentes", tarefa: "camara_vot" });
    const meses = corpo.janelas.map((j: { ano: number; mes: number }) => `${j.ano}-${j.mes}`);
    expect(meses).toContain("2003-4");
    expect(meses).not.toContain("2003-3");
    expect(meses[meses.length - 1]).toBe("2003-1");
    expect(rodadaVotacoesCamara).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("tarefa sem modo nomeado é recusada", async () => {
    const r = await chamar({ consulta: "pendentes", tarefa: "xyz" });
    expect(r.status).toBe(400);
    expect(lerConferencias).not.toHaveBeenCalled();
  });

  it("consulta desconhecida é recusada", async () => {
    const r = await chamar({ consulta: "outra", tarefa: "camara_vot" });
    expect(r.status).toBe(400);
  });
});
