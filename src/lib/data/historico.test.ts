import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Gravação no Histórico enquanto a migration das colunas de gatilho e
// execução ainda não chegou ao banco: a linha não pode se perder.
// ---------------------------------------------------------------------------
const insert = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: () => ({ insert }) },
}));

const { inserirImportacoes } = await import("./historico.server");

const linha = {
  fonte: "camara_vot",
  importados: 3,
  gatilho: "ferramenta",
  execucao_id: "7d1f3c2a-9b8e-4f6d-a5c4-3b2a1f0e9d8c",
};

describe("historico/inserção tolerante à migration pendente", () => {
  beforeEach(() => insert.mockReset());

  it("banco com as colunas: grava a linha inteira de uma vez", async () => {
    insert.mockResolvedValueOnce({ error: null });
    expect(await inserirImportacoes(linha)).toBeNull();
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(linha);
  });

  it("banco sem as colunas novas: grava de novo sem elas", async () => {
    insert
      .mockResolvedValueOnce({
        error: {
          code: "PGRST204",
          message: "Could not find the 'execucao_id' column of 'importacoes' in the schema cache",
        },
      })
      .mockResolvedValueOnce({ error: null });
    expect(await inserirImportacoes(linha)).toBeNull();
    expect(insert).toHaveBeenLastCalledWith({ fonte: "camara_vot", importados: 3 });
  });

  it("banco sem as colunas de métricas: tira só elas e mantém gatilho e execução", async () => {
    const comMetricas = {
      ...linha,
      duracao_ms: 148_000,
      itens_processados: 270,
      subrequisicoes: 950,
      motivo_parada: "tempo",
    };
    insert
      .mockResolvedValueOnce({
        error: {
          code: "PGRST204",
          message: "Could not find the 'duracao_ms' column of 'importacoes' in the schema cache",
        },
      })
      .mockResolvedValueOnce({ error: null });
    expect(await inserirImportacoes(comMetricas)).toBeNull();
    expect(insert).toHaveBeenLastCalledWith(linha);
  });

  it("sem nenhuma das colunas novas: tira um grupo por vez até gravar", async () => {
    const comMetricas = { ...linha, duracao_ms: 1, motivo_parada: "fim" };
    insert
      .mockResolvedValueOnce({
        error: { code: "PGRST204", message: "Could not find the 'motivo_parada' column" },
      })
      .mockResolvedValueOnce({
        error: { code: "PGRST204", message: "Could not find the 'gatilho' column" },
      })
      .mockResolvedValueOnce({ error: null });
    expect(await inserirImportacoes(comMetricas)).toBeNull();
    expect(insert).toHaveBeenLastCalledWith({ fonte: "camara_vot", importados: 3 });
  });

  it("outro erro do banco não é mascarado", async () => {
    insert.mockResolvedValueOnce({ error: { code: "23502", message: "null value" } });
    expect(await inserirImportacoes(linha)).toBe("null value");
    expect(insert).toHaveBeenCalledTimes(1);
  });
});
