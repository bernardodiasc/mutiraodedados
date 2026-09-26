import { describe, expect, it } from "vitest";
import { conferirJanela, type EntradaConferencia } from "./conferencia";

// ---------------------------------------------------------------------------
// Conferência mínima — a das tarefas de cruzamento (lacunas e sinais do TSE,
// doador↔fornecedor). Elas não importam registros de uma origem: cruzam o que
// já está no banco. Só valem "terminou" e "log limpo"; contagem e reflexo na
// cobertura não se aplicam, e os findings novos são só informados.
// ---------------------------------------------------------------------------

function entrada(parcial: Partial<EntradaConferencia> = {}): EntradaConferencia {
  return {
    janela: { ano: 2022, mes: 1 },
    terminou: true,
    rodadas: [{ ano: 2022, mes: 1, resultado: "sem_dados", erros: [] }],
    acumulado: 0,
    origem: null,
    registrosNaCelula: null,
    recente: false,
    findingsNovos: 0,
    minima: true,
    ...parcial,
  };
}

describe("conferência mínima", () => {
  it("terminou com o log limpo e nenhum finding: aprovada, contagem e cobertura não se aplicam", () => {
    const c = conferirJanela(entrada());
    expect(c.estado).toBe("aprovada");
    expect(c.motivo).toBe("Tarefa concluída: 0 findings novos.");
    expect(c.checagens.contagem.situacao).toBe("nao_se_aplica");
    expect(c.checagens.cobertura.situacao).toBe("nao_se_aplica");
  });

  it("informa os findings novos no motivo", () => {
    const c = conferirJanela(entrada({ acumulado: 120, findingsNovos: 7 }));
    expect(c.estado).toBe("aprovada");
    expect(c.motivo).toBe("Tarefa concluída: 7 findings novos.");
    expect(c.findingsNovos).toBe(7);
  });

  it("erro nosso numa rodada reprova", () => {
    const c = conferirJanela(
      entrada({
        rodadas: [{ ano: 2022, mes: 1, resultado: "erro_nosso", erros: ["rpc: violates"] }],
      }),
    );
    expect(c.estado).toBe("reprovada");
  });

  it("falha da origem deixa inconclusiva", () => {
    const c = conferirJanela(
      entrada({
        rodadas: [{ ano: 2022, mes: 1, resultado: "erro_origem", erros: ["API 1: timeout"] }],
      }),
    );
    expect(c.estado).toBe("inconclusiva");
  });

  it("sem nenhuma rodada registrada reprova", () => {
    expect(conferirJanela(entrada({ rodadas: [] })).estado).toBe("reprovada");
  });
});
