import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QaFinding } from "@/lib/data/qa";

// ---------------------------------------------------------------------------
// Mock do supabaseAdmin — simula qa_findings em memória, com controle de erros.
// ---------------------------------------------------------------------------
type Existente = { id: string; fonte: string; entidade_id: string; regra: string; status: string };

const estado: {
  existentes: Existente[];
  insertsLote: unknown[][];
  insertsLinha: unknown[];
  updates: Array<{ payload: Record<string, unknown>; id: string }>;
  erroInsertLote: { code?: string; message: string } | null;
  erroInsertLinha: (linha: Record<string, unknown>) => { code?: string; message: string } | null;
  erroUpdate: { message: string } | null;
} = {
  existentes: [],
  insertsLote: [],
  insertsLinha: [],
  updates: [],
  erroInsertLote: null,
  erroInsertLinha: () => null,
  erroUpdate: null,
};

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        or: async () => ({ data: estado.existentes }),
      }),
      insert: async (payload: unknown) => {
        if (Array.isArray(payload)) {
          estado.insertsLote.push(payload);
          return { error: estado.erroInsertLote };
        }
        estado.insertsLinha.push(payload);
        return { error: estado.erroInsertLinha(payload as Record<string, unknown>) };
      },
      update: (payload: Record<string, unknown>) => ({
        eq: async (_col: string, id: string) => {
          estado.updates.push({ payload, id });
          return { error: estado.erroUpdate };
        },
      }),
    }),
  },
}));

const { flagQA } = await import("@/lib/data/qa");

function finding(sobre?: Partial<QaFinding>): QaFinding {
  return {
    fonte: "cgu",
    entidade_tipo: "contrato",
    entidade_id: "c1",
    regra: "valor_muito_baixo",
    severidade: "aviso",
    ...sobre,
  };
}

beforeEach(() => {
  estado.existentes = [];
  estado.insertsLote = [];
  estado.insertsLinha = [];
  estado.updates = [];
  estado.erroInsertLote = null;
  estado.erroInsertLinha = () => null;
  estado.erroUpdate = null;
});

describe("flagQA", () => {
  it("insere findings novos com defaults (tipo qualidade, origem heuristica, status aberto)", async () => {
    const inseridos = await flagQA([finding()]);
    expect(inseridos).toBe(1);
    expect(estado.insertsLote).toHaveLength(1);
    expect(estado.insertsLote[0][0]).toMatchObject({
      tipo: "qualidade",
      origem: "heuristica",
      status: "aberto",
      resolvido_em: null,
    });
  });

  it("deduplica pela chave (fonte, entidade_id, regra) dentro do mesmo lote", async () => {
    const inseridos = await flagQA([
      finding({ severidade: "aviso" }),
      finding({ severidade: "critico" }), // mesma chave — seria violação de unique
      finding({ entidade_id: "c2" }),
    ]);
    expect(inseridos).toBe(2);
    expect(estado.insertsLote[0]).toHaveLength(2);
  });

  it("atualiza finding aberto existente incluindo o tipo (regras híbridas mudam de veredito)", async () => {
    estado.existentes = [
      {
        id: "uuid-1",
        fonte: "tse",
        entidade_id: "123-2022",
        regra: "eleito_sem_prestacao_contas",
        status: "aberto",
      },
    ];
    const inseridos = await flagQA([
      finding({
        fonte: "tse",
        entidade_id: "123-2022",
        regra: "eleito_sem_prestacao_contas",
        tipo: "qualidade", // antes era 'lacuna'; a API passou a mostrar gasto
      }),
    ]);
    expect(inseridos).toBe(0);
    expect(estado.updates).toHaveLength(1);
    expect(estado.updates[0].id).toBe("uuid-1");
    expect(estado.updates[0].payload.tipo).toBe("qualidade");
  });

  it("não toca findings já resolvidos/falso-positivo", async () => {
    estado.existentes = [
      {
        id: "uuid-2",
        fonte: "cgu",
        entidade_id: "c1",
        regra: "valor_muito_baixo",
        status: "falso_positivo",
      },
    ];
    const inseridos = await flagQA([finding()]);
    expect(inseridos).toBe(0);
    expect(estado.updates).toHaveLength(0);
    expect(estado.insertsLote).toHaveLength(0);
  });

  it("fallback linha a linha quando o INSERT em lote falha; 23505 (corrida) é tolerado", async () => {
    estado.erroInsertLote = { code: "23505", message: "duplicate key" };
    estado.erroInsertLinha = (linha) =>
      (linha.entidade_id as string) === "c1" ? { code: "23505", message: "duplicate key" } : null;
    const inseridos = await flagQA([finding(), finding({ entidade_id: "c2" })]);
    // c1 caiu na corrida (23505, tolerado); c2 entrou.
    expect(inseridos).toBe(1);
    expect(estado.insertsLinha).toHaveLength(2);
  });

  it("propaga erros de escrita que não são corrida (23505)", async () => {
    estado.erroInsertLote = { message: "boom" };
    estado.erroInsertLinha = () => ({ code: "42501", message: "permission denied" });
    await expect(flagQA([finding()])).rejects.toThrow(/flagQA: 1 erro/);
  });

  it("propaga erro de UPDATE em finding aberto", async () => {
    estado.existentes = [
      {
        id: "uuid-3",
        fonte: "cgu",
        entidade_id: "c1",
        regra: "valor_muito_baixo",
        status: "aberto",
      },
    ];
    estado.erroUpdate = { message: "update falhou" };
    await expect(flagQA([finding()])).rejects.toThrow(/flagQA/);
  });

  it("findings que nascem corrigidos carregam resolvido_em", async () => {
    await flagQA([finding({ status: "corrigido_automaticamente" })]);
    const linha = estado.insertsLote[0][0] as Record<string, unknown>;
    expect(linha.status).toBe("corrigido_automaticamente");
    expect(linha.resolvido_em).toBeTruthy();
  });
});
