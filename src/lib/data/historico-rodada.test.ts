import { describe, it, expect } from "vitest";
import {
  anoMesDaJanela,
  ehPeriodoRecente,
  montarLinhaRodada,
  motivoParada,
} from "./historico-rodada";
import type { ResultadoRodada } from "./runner";

function rodada(parcial: Partial<ResultadoRodada> = {}): ResultadoRodada {
  return {
    concluido: false,
    proximoCursor: 4,
    processados: 30,
    totalAcumulado: 90,
    cursorInicial: 1,
    cursorFinal: 3,
    orcamentoEsgotado: false,
    custoEsgotado: false,
    custoGasto: 12,
    semRetomada: false,
    erros: [],
    ...parcial,
  };
}

describe("historico-rodada/motivo de parada", () => {
  it("completa vence qualquer outro estado", () => {
    expect(motivoParada(rodada({ concluido: true, orcamentoEsgotado: true }))).toBe("completa");
  });

  it("tempo esgotado", () => {
    expect(motivoParada(rodada({ orcamentoEsgotado: true }))).toBe(
      "parcial: tempo da rodada esgotado",
    );
  });

  it("teto de subrequisições", () => {
    expect(motivoParada(rodada({ custoEsgotado: true }))).toBe(
      "parcial: teto de subrequisições da rodada",
    );
  });

  it("parcial sem causa específica (interrupção por erro)", () => {
    expect(motivoParada(rodada())).toBe("parcial");
  });
});

describe("historico-rodada/ano e mês da janela", () => {
  it("janela dentro de um mês ancora a célula da cobertura", () => {
    expect(anoMesDaJanela("2024-03-01", "2024-03-31")).toEqual({ ano: 2024, mes: 3 });
  });

  it("janela cruzando meses não ancora célula", () => {
    expect(anoMesDaJanela("2024-03-01", "2024-04-30")).toEqual({ ano: null, mes: null });
  });

  it("data inválida não ancora célula", () => {
    expect(anoMesDaJanela("ontem", "2024-03-31")).toEqual({ ano: null, mes: null });
  });
});

describe("historico-rodada/linha", () => {
  const meta = {
    fonte: "pncp",
    endpoint: "GET https://pncp.gov.br/api/consulta/v1/contratos/publicacao",
    unidade: "páginas",
    userId: "u1",
    ano: 2024,
    mes: 3,
  };

  it("consulta vazia gera linha com zero — o marcador de 'consultado, sem dados'", () => {
    const l = montarLinhaRodada(
      meta,
      rodada({ concluido: true, processados: 0, cursorInicial: 1, cursorFinal: 1 }),
    );
    expect(l.importados).toBe(0);
    expect(l.total_bruto).toBe(0);
    expect(l.ano).toBe(2024);
    expect(l.mes).toBe(3);
    expect(l.endpoint).toContain("completa");
  });

  it("registra o intervalo de passos e o motivo", () => {
    const l = montarLinhaRodada(meta, rodada({ orcamentoEsgotado: true }));
    expect(l.endpoint).toContain("páginas 1–3");
    expect(l.endpoint).toContain("parcial: tempo da rodada esgotado");
  });

  it("rodada que não executou nenhum passo diz isso em vez de um intervalo impossível", () => {
    const l = montarLinhaRodada(meta, rodada({ cursorInicial: 5, cursorFinal: 4, processados: 0 }));
    expect(l.endpoint).toContain("nenhum passo executado");
    expect(l.endpoint).not.toContain("5–4");
  });

  it("duração entra em segundos quando informada", () => {
    const l = montarLinhaRodada({ ...meta, duracaoMs: 148_600 }, rodada());
    expect(l.endpoint).toContain("149s");
  });

  it("erros da rodada viajam para a linha", () => {
    const l = montarLinhaRodada(meta, rodada({ erros: ["p3: TRANSIENT: 503"] }));
    expect(l.erros).toEqual(["p3: TRANSIENT: 503"]);
  });
});

describe("historico-rodada/classificação na linha", () => {
  const meta = {
    fonte: "pncp",
    endpoint: "GET https://pncp.gov.br/api/consulta/v1/contratos",
    unidade: "páginas",
    userId: "u1",
  };

  it("rodada com dados", () => {
    expect(montarLinhaRodada(meta, rodada({ processados: 500 })).resultado).toBe("com_dados");
  });

  it("zero limpo com período fechado é ausência real", () => {
    expect(montarLinhaRodada(meta, rodada({ processados: 0, erros: [] })).resultado).toBe(
      "sem_dados",
    );
  });

  it("zero com 404 nosso não passa por ausência — é o caso do PNCP", () => {
    const l = montarLinhaRodada(meta, rodada({ processados: 0, erros: ["p1: PNCP API 404"] }));
    expect(l.resultado).toBe("erro_nosso");
  });

  it("período recente sem dados vira 'ainda não publicado'", () => {
    const l = montarLinhaRodada({ ...meta, periodoRecente: true }, rodada({ processados: 0 }));
    expect(l.resultado).toBe("nao_publicado");
  });

  it("período fora da janela é marcado como tal", () => {
    const l = montarLinhaRodada({ ...meta, foraDaJanela: true }, rodada({ processados: 0 }));
    expect(l.resultado).toBe("fora_da_janela");
  });
});

describe("historico-rodada/período recente", () => {
  const hoje = new Date(2026, 7, 20); // 20/08/2026

  it("o mês corrente é recente", () => {
    expect(ehPeriodoRecente(2026, 8, hoje)).toBe(true);
  });

  it("dois meses atrás ainda é recente (órgãos publicam com atraso)", () => {
    expect(ehPeriodoRecente(2026, 6, hoje)).toBe(true);
  });

  it("três meses atrás já não é", () => {
    expect(ehPeriodoRecente(2026, 5, hoje)).toBe(false);
  });

  it("ano antigo não é recente", () => {
    expect(ehPeriodoRecente(2019, 12, hoje)).toBe(false);
  });

  it("sem ano, não dá para dizer — trata como não recente", () => {
    expect(ehPeriodoRecente(null, null, hoje)).toBe(false);
  });

  it("fonte anual sem mês usa dezembro como referência", () => {
    expect(ehPeriodoRecente(2026, null, hoje)).toBe(true);
    expect(ehPeriodoRecente(2025, null, hoje)).toBe(false);
  });

  it("a linha do Histórico usa isso sozinha, sem o caller passar nada", () => {
    const l = montarLinhaRodada(
      { fonte: "pncp", endpoint: "GET x", unidade: "páginas", userId: "u", ano: 2019, mes: 3 },
      rodada({ processados: 0, erros: [] }),
    );
    expect(l.resultado).toBe("sem_dados");
  });
});
