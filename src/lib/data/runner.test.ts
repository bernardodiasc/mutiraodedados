import { describe, it, expect } from "vitest";
import { rodarComOrcamento, type Checkpoint, type EstadoCheckpoint } from "./runner";

/** Checkpoint em memória, com o mesmo contrato do de banco. */
function checkpointFake(inicial: EstadoCheckpoint | null = null) {
  const estado: { valor: EstadoCheckpoint | null } = { valor: inicial };
  const gravacoes: EstadoCheckpoint[] = [];
  const cp: Checkpoint = {
    ler: async () => estado.valor,
    salvar: async (_chave, novo) => {
      estado.valor = { ...novo };
      gravacoes.push({ ...novo });
      return { persistido: true, erro: null };
    },
  };
  return { cp, estado, gravacoes };
}

/** Relógio manual: cada leitura avança um tanto fixo. */
function relogio(passoMs: number) {
  let t = 0;
  return () => {
    const atual = t;
    t += passoMs;
    return atual;
  };
}

describe("runner/varredura completa", () => {
  it("roda até o fim e devolve concluido sem próximo cursor", async () => {
    const { cp, estado } = checkpointFake();
    const r = await rodarComOrcamento({
      chave: "k",
      checkpoint: cp,
      orcamentoMs: 60_000,
      maxPassos: 10,
      passo: async (cursor) => ({ processados: 5, fim: cursor === 3 }),
      agora: () => 0,
    });
    expect(r.concluido).toBe(true);
    expect(r.proximoCursor).toBeNull();
    expect(r.processados).toBe(15);
    expect(r.cursorFinal).toBe(3);
    expect(estado.valor).toEqual({ cursor: 3, total: 15, completa: true });
  });

  it("o cursor começa em 1", async () => {
    const { cp } = checkpointFake();
    const vistos: number[] = [];
    await rodarComOrcamento({
      chave: "k",
      checkpoint: cp,
      orcamentoMs: 60_000,
      maxPassos: 3,
      passo: async (cursor) => {
        vistos.push(cursor);
        return { processados: 0, fim: cursor === 3 };
      },
      agora: () => 0,
    });
    expect(vistos).toEqual([1, 2, 3]);
  });
});

describe("runner/retomada", () => {
  it("continua de onde a rodada anterior parou", async () => {
    const { cp } = checkpointFake({ cursor: 4, total: 40, completa: false });
    const vistos: number[] = [];
    const r = await rodarComOrcamento({
      chave: "k",
      checkpoint: cp,
      orcamentoMs: 60_000,
      maxPassos: 2,
      passo: async (cursor) => {
        vistos.push(cursor);
        return { processados: 10, fim: false };
      },
      agora: () => 0,
    });
    expect(vistos).toEqual([5, 6]);
    expect(r.cursorInicial).toBe(5);
    expect(r.totalAcumulado).toBe(60);
    expect(r.proximoCursor).toBe(7);
  });

  it("varredura já completa recomeça do zero (permite reimportar após limpeza)", async () => {
    const { cp } = checkpointFake({ cursor: 9, total: 90, completa: true });
    const vistos: number[] = [];
    await rodarComOrcamento({
      chave: "k",
      checkpoint: cp,
      orcamentoMs: 60_000,
      maxPassos: 1,
      passo: async (cursor) => {
        vistos.push(cursor);
        return { processados: 1, fim: false };
      },
      agora: () => 0,
    });
    expect(vistos).toEqual([1]);
  });

  it("grava o checkpoint depois de cada passo, não só no fim", async () => {
    const { cp, gravacoes } = checkpointFake();
    await rodarComOrcamento({
      chave: "k",
      checkpoint: cp,
      orcamentoMs: 60_000,
      maxPassos: 3,
      passo: async (cursor) => ({ processados: 2, fim: cursor === 3 }),
      agora: () => 0,
    });
    // 3 gravações de progresso + 1 final
    expect(gravacoes.map((g) => g.cursor)).toEqual([1, 2, 3, 3]);
    expect(gravacoes.slice(0, 3).every((g) => !g.completa)).toBe(true);
    expect(gravacoes[3].completa).toBe(true);
  });
});

describe("runner/orçamento", () => {
  it("para ao estourar o tempo e devolve o próximo cursor", async () => {
    const { cp } = checkpointFake();
    const r = await rodarComOrcamento({
      chave: "k",
      checkpoint: cp,
      orcamentoMs: 2_500,
      maxPassos: 100,
      passo: async () => ({ processados: 1, fim: false }),
      agora: relogio(1_000), // 0, 1000, 2000, 3000 → para na 4ª leitura
    });
    expect(r.orcamentoEsgotado).toBe(true);
    expect(r.concluido).toBe(false);
    expect(r.proximoCursor).toBe(r.cursorFinal + 1);
  });

  it("confere o orçamento antes do passo, nunca no meio", async () => {
    const { cp } = checkpointFake();
    let executados = 0;
    await rodarComOrcamento({
      chave: "k",
      checkpoint: cp,
      orcamentoMs: 0,
      maxPassos: 5,
      passo: async () => {
        executados++;
        return { processados: 1, fim: false };
      },
      agora: relogio(1_000),
    });
    expect(executados).toBe(0);
  });

  it("maxPassos limita a rodada mesmo com orçamento sobrando", async () => {
    const { cp } = checkpointFake();
    const r = await rodarComOrcamento({
      chave: "k",
      checkpoint: cp,
      orcamentoMs: 60_000,
      maxPassos: 2,
      passo: async () => ({ processados: 1, fim: false }),
      agora: () => 0,
    });
    expect(r.processados).toBe(2);
    expect(r.concluido).toBe(false);
    expect(r.orcamentoEsgotado).toBe(false);
  });
});

describe("runner/interrupção", () => {
  it("não avança o cursor: a próxima rodada refaz o passo que falhou", async () => {
    const { cp, estado } = checkpointFake();
    const r = await rodarComOrcamento({
      chave: "k",
      checkpoint: cp,
      orcamentoMs: 60_000,
      maxPassos: 10,
      passo: async (cursor) =>
        cursor === 3
          ? { processados: 0, fim: false, interromper: true, erros: ["banco fora"] }
          : { processados: 4, fim: false },
      agora: () => 0,
    });
    expect(r.concluido).toBe(false);
    expect(r.cursorFinal).toBe(2);
    expect(r.proximoCursor).toBe(3);
    expect(r.erros).toContain("banco fora");
    expect(estado.valor).toEqual({ cursor: 2, total: 8, completa: false });
  });

  it("interrupção nunca marca a varredura como completa", async () => {
    const { cp, estado } = checkpointFake();
    await rodarComOrcamento({
      chave: "k",
      checkpoint: cp,
      orcamentoMs: 60_000,
      maxPassos: 10,
      passo: async () => ({ processados: 0, fim: true, interromper: true }),
      agora: () => 0,
    });
    expect(estado.valor?.completa).toBe(false);
  });
});

describe("runner/checkpoint indisponível", () => {
  it("a rodada segue, mas avisa que não retoma", async () => {
    const cp: Checkpoint = {
      ler: async () => null,
      salvar: async () => ({ persistido: false, erro: null }),
    };
    const r = await rodarComOrcamento({
      chave: "k",
      checkpoint: cp,
      orcamentoMs: 60_000,
      maxPassos: 2,
      passo: async () => ({ processados: 3, fim: false }),
      agora: () => 0,
    });
    expect(r.processados).toBe(6);
    expect(r.semRetomada).toBe(true);
    expect(r.erros.join(" ")).toContain("NÃO retoma");
  });

  it("varredura completa não avisa sobre retomada", async () => {
    const cp: Checkpoint = {
      ler: async () => null,
      salvar: async () => ({ persistido: false, erro: null }),
    };
    const r = await rodarComOrcamento({
      chave: "k",
      checkpoint: cp,
      orcamentoMs: 60_000,
      maxPassos: 2,
      passo: async () => ({ processados: 1, fim: true }),
      agora: () => 0,
    });
    expect(r.concluido).toBe(true);
    expect(r.erros.join(" ")).not.toContain("NÃO retoma");
  });

  it("erro de gravação vira erro da rodada, sem derrubá-la", async () => {
    const cp: Checkpoint = {
      ler: async () => null,
      salvar: async () => ({ persistido: true, erro: "cgu_varredura: timeout" }),
    };
    const r = await rodarComOrcamento({
      chave: "k",
      checkpoint: cp,
      orcamentoMs: 60_000,
      maxPassos: 1,
      passo: async () => ({ processados: 1, fim: false }),
      agora: () => 0,
    });
    expect(r.processados).toBe(1);
    expect(r.erros).toContain("cgu_varredura: timeout");
  });
});

describe("runner/orçamento de custo", () => {
  it("para ao atingir o teto de subrequisições", async () => {
    const { cp } = checkpointFake();
    const r = await rodarComOrcamento({
      chave: "k",
      checkpoint: cp,
      orcamentoMs: 60_000,
      orcamentoCusto: 10,
      maxPassos: 100,
      passo: async () => ({ processados: 1, fim: false, custo: 4 }),
      agora: () => 0,
    });
    // 4 + 4 + 4 = 12 ≥ 10 no terceiro passo
    expect(r.custoEsgotado).toBe(true);
    expect(r.custoGasto).toBe(12);
    expect(r.processados).toBe(3);
    expect(r.concluido).toBe(false);
    expect(r.proximoCursor).toBe(4);
  });

  it("sem orcamentoCusto, o custo é só contabilizado", async () => {
    const { cp } = checkpointFake();
    const r = await rodarComOrcamento({
      chave: "k",
      checkpoint: cp,
      orcamentoMs: 60_000,
      maxPassos: 3,
      passo: async () => ({ processados: 1, fim: false, custo: 50 }),
      agora: () => 0,
    });
    expect(r.custoEsgotado).toBe(false);
    expect(r.custoGasto).toBe(150);
    expect(r.processados).toBe(3);
  });

  it("o teto de custo não impede concluir quando a origem acaba antes", async () => {
    const { cp } = checkpointFake();
    const r = await rodarComOrcamento({
      chave: "k",
      checkpoint: cp,
      orcamentoMs: 60_000,
      orcamentoCusto: 10,
      maxPassos: 100,
      passo: async (cursor) => ({ processados: 1, fim: cursor === 2, custo: 4 }),
      agora: () => 0,
    });
    expect(r.concluido).toBe(true);
    expect(r.custoEsgotado).toBe(false);
  });
});

describe("sondagem do fim não ocupa posição", () => {
  it("varredura de N alvos termina com cursorFinal = N, não N+1", async () => {
    const { cp } = checkpointFake();
    const TOTAL = 10;
    const r = await rodarComOrcamento({
      chave: "k",
      checkpoint: cp,
      orcamentoMs: 60_000,
      maxPassos: 50,
      // Espelha o passo do SICONFI: fora do intervalo, devolve fim sem custo.
      passo: async (cursor) =>
        cursor > TOTAL ? { processados: 0, fim: true } : { processados: 3, fim: false },
      agora: () => 0,
    });
    expect(r.concluido).toBe(true);
    expect(r.cursorFinal).toBe(TOTAL);
    expect(r.processados).toBe(TOTAL * 3);
  });

  it("último passo que processa E termina ocupa a posição", async () => {
    const { cp } = checkpointFake();
    const r = await rodarComOrcamento({
      chave: "k",
      checkpoint: cp,
      orcamentoMs: 60_000,
      maxPassos: 50,
      // Última página parcial: veio com dados e já anuncia o fim.
      passo: async (cursor) => ({ processados: 5, fim: cursor === 3 }),
      agora: () => 0,
    });
    expect(r.cursorFinal).toBe(3);
  });

  it("passo vazio no MEIO da varredura avança — senão trava", async () => {
    const { cp } = checkpointFake();
    const r = await rodarComOrcamento({
      chave: "k",
      checkpoint: cp,
      orcamentoMs: 60_000,
      maxPassos: 50,
      // Consulta sem dados é rotina no SICONFI: 0 processados, mas não é fim.
      passo: async (cursor) => ({ processados: 0, fim: cursor > 4 }),
      agora: () => 0,
    });
    expect(r.cursorFinal).toBe(4);
    expect(r.concluido).toBe(true);
  });
});
