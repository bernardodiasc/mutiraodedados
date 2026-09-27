import { describe, expect, it } from "vitest";
import {
  estadoAgregado,
  estadoDaJanela,
  type ResumoJanela,
  resumirJanelas,
  ultimaImportacaoValida,
} from "./cobertura-estado";
import type { ResultadoClassificado } from "./resultado-rodada";

// ---------------------------------------------------------------------------
// Estado de cobertura de uma janela, derivado do que a importação já grava: a
// última rodada (resultado e motivo de parada), a conferência vigente e se a
// célula tem registros no cache. Um exemplo por estado e pela precedência.
// ---------------------------------------------------------------------------

const AGORA = new Date("2026-09-26T12:00:00Z");
const HORA = 3_600_000;
const antes = (horas: number) => new Date(AGORA.getTime() - horas * HORA).toISOString();

const rodada = (
  resultado: ResultadoClassificado,
  motivoParada: string | null = "fim",
  horas = 48,
) => ({ resultado, motivoParada, em: antes(horas) });

const conferencia = (
  estado: "aprovada" | "reprovada" | "inconclusiva",
  contagem: string | null = "confere",
  horas = 47,
) => ({ estado, contagem, em: antes(horas) });

const janela = (r: Partial<ResumoJanela>): ResumoJanela => ({
  temRegistros: false,
  ultimaRodada: null,
  conferencia: null,
  ...r,
});

describe("estadoDaJanela", () => {
  it("sem nenhuma rodada: não consultado", () => {
    expect(estadoDaJanela(janela({}), AGORA)).toBe("nao_consultado");
  });

  it("aprovada com o total da origem conferido: concluído no universo enumerado", () => {
    const j = janela({
      temRegistros: true,
      ultimaRodada: rodada("com_dados"),
      conferencia: conferencia("aprovada", "confere"),
    });
    expect(estadoDaJanela(j, AGORA)).toBe("concluido");
  });

  it("aprovada sem total da origem: estado à parte", () => {
    const j = janela({
      temRegistros: true,
      ultimaRodada: rodada("com_dados"),
      conferencia: conferencia("aprovada", "sem_total_da_origem"),
    });
    expect(estadoDaJanela(j, AGORA)).toBe("concluido_sem_total");
  });

  it("aprovada sem registros: vazio confirmado, pela contagem ou pelo total zero", () => {
    for (const contagem of ["vazia_legitima", "confere"]) {
      const j = janela({
        ultimaRodada: rodada("sem_dados"),
        conferencia: conferencia("aprovada", contagem),
      });
      expect(estadoDaJanela(j, AGORA)).toBe("vazio_confirmado");
    }
  });

  it("conferência reprovada ou falha nossa na última rodada: erro, mesmo com registros", () => {
    expect(
      estadoDaJanela(
        janela({
          temRegistros: true,
          ultimaRodada: rodada("com_dados"),
          conferencia: conferencia("reprovada", "divergente"),
        }),
        AGORA,
      ),
    ).toBe("erro");
    expect(
      estadoDaJanela(janela({ temRegistros: true, ultimaRodada: rodada("erro_nosso") }), AGORA),
    ).toBe("erro");
  });

  it("origem fora do ar, período não publicado ou conferência inconclusiva: indisponível", () => {
    expect(estadoDaJanela(janela({ ultimaRodada: rodada("erro_origem") }), AGORA)).toBe(
      "indisponivel",
    );
    expect(estadoDaJanela(janela({ ultimaRodada: rodada("nao_publicado") }), AGORA)).toBe(
      "indisponivel",
    );
    expect(
      estadoDaJanela(
        janela({
          temRegistros: true,
          ultimaRodada: rodada("com_dados"),
          conferencia: conferencia("inconclusiva", "divergente"),
        }),
        AGORA,
      ),
    ).toBe("indisponivel");
  });

  it("varredura parada no meio, com rodada nas últimas 24 h: processando", () => {
    const j = janela({ temRegistros: true, ultimaRodada: rodada("com_dados", "tempo", 2) });
    expect(estadoDaJanela(j, AGORA)).toBe("processando");
  });

  it("varredura parada no meio há mais de 24 h: parcial", () => {
    const j = janela({ temRegistros: true, ultimaRodada: rodada("com_dados", "tempo", 30) });
    expect(estadoDaJanela(j, AGORA)).toBe("parcial");
  });

  it("importada e nunca conferida: parcial, com ou sem registros", () => {
    expect(
      estadoDaJanela(janela({ temRegistros: true, ultimaRodada: rodada("com_dados") }), AGORA),
    ).toBe("parcial");
    expect(estadoDaJanela(janela({ ultimaRodada: rodada("sem_dados") }), AGORA)).toBe("parcial");
  });

  it("registros sem rodada (carga antiga, fora do Histórico): parcial", () => {
    expect(estadoDaJanela(janela({ temRegistros: true }), AGORA)).toBe("parcial");
  });

  it("conferência mais antiga que a última rodada não vale: a execução nova ainda não foi conferida", () => {
    const j = janela({
      temRegistros: true,
      ultimaRodada: rodada("com_dados", "tempo", 1),
      conferencia: conferencia("reprovada", "divergente", 50),
    });
    expect(estadoDaJanela(j, AGORA)).toBe("processando");
  });
});

describe("resumirJanelas", () => {
  it("conta as janelas do universo por estado e as concluídas (inclui vazio confirmado)", () => {
    const r = resumirJanelas([
      "concluido",
      "concluido_sem_total",
      "vazio_confirmado",
      "parcial",
      "nao_consultado",
      "erro",
    ]);
    expect(r).toMatchObject({ total: 6, concluidas: 3 });
    expect(r.porEstado.parcial).toBe(1);
    expect(r.porEstado.indisponivel).toBe(0);
  });
});

describe("ultimaImportacaoValida", () => {
  it("é o horário da conferência aprovada mais recente, ou null", () => {
    expect(
      ultimaImportacaoValida([
        { estado: "aprovada", em: "2026-09-01T00:00:00Z" },
        { estado: "reprovada", em: "2026-09-20T00:00:00Z" },
        { estado: "aprovada", em: "2026-09-10T00:00:00Z" },
      ]),
    ).toBe("2026-09-10T00:00:00Z");
    expect(ultimaImportacaoValida([{ estado: "inconclusiva", em: "2026-09-10T00:00:00Z" }])).toBe(
      null,
    );
  });
});

describe("estadoAgregado", () => {
  it("vale o pior estado que pede atenção", () => {
    expect(estadoAgregado(["concluido", "erro", "parcial"])).toBe("erro");
    expect(estadoAgregado(["concluido", "indisponivel", "parcial"])).toBe("indisponivel");
  });

  it("concluídas misturadas com não consultadas: parcial", () => {
    expect(estadoAgregado(["concluido", "nao_consultado"])).toBe("parcial");
    expect(estadoAgregado(["vazio_confirmado", "concluido_sem_total"])).toBe("concluido_sem_total");
  });

  it("todas iguais: o próprio estado; nenhuma: não consultado", () => {
    expect(estadoAgregado(["concluido", "concluido"])).toBe("concluido");
    expect(estadoAgregado(["nao_consultado"])).toBe("nao_consultado");
    expect(estadoAgregado([])).toBe("nao_consultado");
  });
});
