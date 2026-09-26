import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rodarComOrcamento, type Checkpoint, type EstadoCheckpoint } from "@/lib/data/runner";
import {
  JANELA_ORCAMENTO_MS,
  JANELA_TETO_SUBREQUISICOES,
  JANELA_TETO_SUBREQUISICOES_PARALELO,
} from "@/lib/data/janela-varredura";
import { PARALELISMO_VOTACOES_CAMARA } from "./votacoes-api";

// ---------------------------------------------------------------------------
// Quantas rodadas um mês grande de votações leva, com a origem simulada.
//
// Maio de 2026 tem 1.535 votações (X-Total-Count da Câmara). Na rodada real
// em sequência, cada votação levava ~0,55 s e custava 3 subrequisições
// contadas (detalhe, votos, gravação), mais uma quando há votos a gravar —
// 48 de 60 votações de uma amostra do mês não tinham votos nominais. A
// origem simulada reproduz isso num relógio falso.
// ---------------------------------------------------------------------------

const VOTACOES = 1_535;
const MS_POR_VOTACAO = 550;

function checkpointEmMemoria(): Checkpoint {
  let estado: EstadoCheckpoint | null = null;
  return {
    ler: async () => estado,
    salvar: async (_c, novo) => {
      estado = { ...novo };
      return { persistido: true, erro: null };
    },
  };
}

async function rodadasAteOFim(opcoes: { paralelismo: number; teto: number }) {
  const checkpoint = checkpointEmMemoria();
  const rodadas: { itens: number; parada: string }[] = [];
  for (let n = 0; n < 50; n++) {
    let pronta = false;
    const rodada = rodarComOrcamento({
      chave: "camara_vot#2026-05-01#2026-05-31",
      checkpoint,
      orcamentoMs: JANELA_ORCAMENTO_MS,
      orcamentoCusto: opcoes.teto,
      maxPassos: 5000,
      paralelismo: opcoes.paralelismo,
      agora: () => Date.now(),
      passo: async (cursor) => {
        if (cursor > VOTACOES) return { processados: 0, fim: true };
        await new Promise((r) => setTimeout(r, MS_POR_VOTACAO));
        return { processados: 1, fim: false, custo: cursor % 5 === 0 ? 4 : 3 };
      },
    }).finally(() => {
      pronta = true;
    });
    while (!pronta) await vi.advanceTimersByTimeAsync(10);
    const r = await rodada;
    rodadas.push({ itens: r.cursorFinal - r.cursorInicial + 1, parada: r.parada });
    if (r.concluido) break;
  }
  return rodadas;
}

describe("votações da Câmara: rodadas de um mês grande (origem simulada)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("em sequência, como antes: 6 rodadas de ~270 votações, paradas pelo tempo", async () => {
    const rodadas = await rodadasAteOFim({ paralelismo: 1, teto: JANELA_TETO_SUBREQUISICOES });
    expect(rodadas).toHaveLength(6);
    expect(rodadas[0]).toEqual({ itens: 273, parada: "tempo" });
  });

  it("com o paralelismo das votações: 2 rodadas", async () => {
    const rodadas = await rodadasAteOFim({
      paralelismo: PARALELISMO_VOTACOES_CAMARA,
      teto: JANELA_TETO_SUBREQUISICOES_PARALELO,
    });
    expect(rodadas.map((r) => r.itens)).toEqual([1_365, 170]);
    expect(rodadas).toHaveLength(2);
    expect(rodadas[0].parada).toBe("tempo");
    expect(rodadas.at(-1)?.parada).toBe("fim");
    expect(rodadas.reduce((s, r) => s + r.itens, 0)).toBe(VOTACOES);
  });
});
