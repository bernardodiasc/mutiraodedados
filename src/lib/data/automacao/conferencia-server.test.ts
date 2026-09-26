import { describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// A conferência grava o veredito na linha da ÚLTIMA rodada da execução. Uma
// varredura do SICONFI grava uma linha por consulta e passa das mil linhas
// que o PostgREST devolve de uma vez: a leitura tem de paginar. O banco é um
// mock com o teto de mil linhas por resposta.
// ---------------------------------------------------------------------------
const LINHAS = Array.from({ length: 2345 }, (_, i) => ({
  id: `linha-${i + 1}`,
  ano: 2023,
  mes: 0,
  resultado: "com_dados",
  erros: [],
}));
const atualizadas: string[] = [];

function from() {
  let intervalo: [number, number] = [0, 999];
  let idAtualizado = "";
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "is", "order"]) q[m] = () => q;
  q.range = (de: number, ate: number) => {
    intervalo = [de, Math.min(ate, de + 999)];
    return q;
  };
  q.update = () => q;
  q.eq = (coluna: string, valor: string) => {
    if (coluna === "id") idAtualizado = valor;
    return q;
  };
  q.then = (ok: (v: unknown) => unknown) => {
    if (idAtualizado) {
      atualizadas.push(idAtualizado);
      return ok({ error: null });
    }
    return ok({ data: LINHAS.slice(intervalo[0], intervalo[1] + 1), error: null });
  };
  return q;
}

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from } }));
vi.mock("@/lib/data/historico.server", () => ({ inserirImportacoes: vi.fn() }));

const { conferirEGravar } = await import("./conferencia.server");

describe("conferência — execução com mais de mil linhas", () => {
  it("lê todas as rodadas e grava o veredito na última", async () => {
    const c = await conferirEGravar(
      "e-1",
      {
        janela: { ano: 2023, mes: 0 },
        terminou: true,
        acumulado: 5000,
        origem: null,
        recente: false,
        findingsNovos: null,
      },
      async () => 5000,
    );
    expect(c.rodadas).toBe(2345);
    expect(atualizadas).toEqual(["linha-2345"]);
  });
});
