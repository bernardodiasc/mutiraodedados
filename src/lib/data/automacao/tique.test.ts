import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// A porta de `/api/cron-importar`: sem o CRON_SECRET certo, nada da fila é
// tocado. As rodadas e o banco são mocks — aqui só interessa a autorização.
// ---------------------------------------------------------------------------
const rpc = vi.fn(async () => ({ data: null, error: null }));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { rpc, from: vi.fn() },
}));
vi.mock("@/lib/data/pncp/ingest.functions", () => ({ rodadaContratosPNCP: vi.fn() }));
vi.mock("@/lib/data/real/convenios.functions", () => ({ rodadaConvenios: vi.fn() }));
vi.mock("@/lib/data/camara/ingest.functions", () => ({ rodadaCEAPMes: vi.fn() }));
vi.mock("@/lib/data/senado/ingest.functions", () => ({ rodadaCEAPSMes: vi.fn() }));
vi.mock("@/lib/data/camara/votacoes.functions", () => ({ rodadaVotacoesCamara: vi.fn() }));
vi.mock("@/lib/data/senado/votacoes.functions", () => ({ rodadaVotacoesSenado: vi.fn() }));
vi.mock("@/lib/data/senado/materias.functions", () => ({ rodadaMaterias: vi.fn() }));
vi.mock("@/lib/data/camara/proposicoes.functions", () => ({ rodadaProposicoes: vi.fn() }));
vi.mock("@/lib/data/convenios-origem/ingest.functions", () => ({
  rodadaConveniosOrigem: vi.fn(),
}));
vi.mock("@/lib/data/ibge/ingest.functions", () => ({ rodadaMunicipiosIBGE: vi.fn() }));
vi.mock("@/lib/data/automacao/nomeado", () => ({ executarRodadaNomeada: vi.fn() }));

const { executarTiqueAutomacao } = await import("./tique.server");

const SEGREDO = "segredo-de-teste";

function requisicao(method: string, segredo?: string): Request {
  const headers = new Headers();
  if (segredo !== undefined) headers.set("x-cron-secret", segredo);
  return new Request("https://exemplo.test/api/cron-importar", { method, headers });
}

describe("/api/cron-importar — autorização", () => {
  beforeEach(() => {
    rpc.mockClear();
    vi.stubEnv("CRON_SECRET", SEGREDO);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sem CRON_SECRET configurado a rota fica desligada — 401 até para quem manda header", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const r = await executarTiqueAutomacao(requisicao("POST", ""));
    expect(r.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sem header → 401 e corpo sem detalhe", async () => {
    const r = await executarTiqueAutomacao(requisicao("POST"));
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ erro: "não autorizado" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("secret errado → 401 com o mesmo corpo (não diz o que falhou)", async () => {
    const r = await executarTiqueAutomacao(requisicao("POST", "outro"));
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ erro: "não autorizado" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("comparação é exata: prefixo ou caixa diferente não passam", async () => {
    for (const quase of [SEGREDO.slice(0, -1), SEGREDO.toUpperCase(), ` ${SEGREDO}x`]) {
      const r = await executarTiqueAutomacao(requisicao("POST", quase));
      expect(r.status, `"${quase}"`).toBe(401);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("método errado sem secret → 401, não 405 (não revela a rota)", async () => {
    const r = await executarTiqueAutomacao(requisicao("GET"));
    expect(r.status).toBe(401);
  });

  it("secret certo com GET → 405, sem tocar na fila", async () => {
    const r = await executarTiqueAutomacao(requisicao("GET", SEGREDO));
    expect(r.status).toBe(405);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("secret certo com POST → reivindica a fila", async () => {
    const r = await executarTiqueAutomacao(requisicao("POST", SEGREDO));
    expect(rpc).toHaveBeenCalledWith("automacao_reivindicar_tarefa");
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ tarefa: null });
  });
});
