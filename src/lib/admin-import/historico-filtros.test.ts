import { describe, expect, it } from "vitest";
import {
  aplicarFiltrosHistorico,
  lerConferencia,
  formatarDuracao,
  itensPorSegundo,
  lerFiltrosHistorico,
  lerResumoHistorico,
  mudarFiltroHistorico,
  parametrosResumoHistorico,
  resumirMotivo,
} from "./historico-filtros";

const EXECUCAO = "5b0c7f1e-2d3a-4c8b-9e6f-1a2b3c4d5e6f";

describe("lerFiltrosHistorico — filtros do Histórico vindos da URL", () => {
  it("aceita todos os filtros válidos", () => {
    expect(
      lerFiltrosHistorico({
        fonte: "camara_vot",
        gatilho: "ferramenta",
        resultado: "erro_nosso",
        conferencia: "reprovada",
        de: "2026-09-01",
        ate: "2026-09-26",
        execucao: EXECUCAO,
        parada: "tempo",
      }),
    ).toEqual({
      parada: "tempo",
      fonte: "camara_vot",
      gatilho: "ferramenta",
      resultado: "erro_nosso",
      conferencia: "reprovada",
      de: "2026-09-01",
      ate: "2026-09-26",
      execucao: EXECUCAO,
    });
  });

  it("sem parâmetros, não filtra nada", () => {
    expect(lerFiltrosHistorico({})).toEqual({});
  });

  it("descarta valores desconhecidos em vez de quebrar a tela", () => {
    expect(
      lerFiltrosHistorico({
        fonte: "fonte_que_nao_existe",
        gatilho: "manual",
        resultado: 3,
        conferencia: "aprovadissima",
        de: "2026-02-30",
        ate: "26/09/2026",
        execucao: "nao-e-uuid",
        parada: "cansou",
      }),
    ).toEqual({});
  });

  it("período digitado ao contrário vira o intervalo certo", () => {
    expect(lerFiltrosHistorico({ de: "2026-09-26", ate: "2026-09-01" })).toEqual({
      de: "2026-09-01",
      ate: "2026-09-26",
    });
  });

  it("aceita execução em maiúsculas e guarda em minúsculas", () => {
    expect(lerFiltrosHistorico({ execucao: EXECUCAO.toUpperCase() })).toEqual({
      execucao: EXECUCAO,
    });
  });
});

/** Consulta falsa que só anota os filtros pedidos, na ordem. */
interface ConsultaFalsa {
  eq(coluna: string, valor: string): ConsultaFalsa;
  gte(coluna: string, valor: string): ConsultaFalsa;
  lt(coluna: string, valor: string): ConsultaFalsa;
}

function consultaAnotada() {
  const chamadas: string[] = [];
  const q: ConsultaFalsa = {
    eq(coluna, valor) {
      chamadas.push(`${coluna} = ${valor}`);
      return q;
    },
    gte(coluna, valor) {
      chamadas.push(`${coluna} >= ${valor}`);
      return q;
    },
    lt(coluna, valor) {
      chamadas.push(`${coluna} < ${valor}`);
      return q;
    },
  };
  return { q, chamadas };
}

describe("aplicarFiltrosHistorico — filtros na consulta de importacoes", () => {
  it("sem filtros, não restringe a consulta", () => {
    const { q, chamadas } = consultaAnotada();
    aplicarFiltrosHistorico(q, {});
    expect(chamadas).toEqual([]);
  });

  it("traduz cada filtro na coluna certa", () => {
    const { q, chamadas } = consultaAnotada();
    aplicarFiltrosHistorico(q, {
      fonte: "pncp",
      gatilho: "cron",
      resultado: "erro_origem",
      conferencia: "inconclusiva",
      execucao: EXECUCAO,
      parada: "subrequisicoes",
    });
    expect(chamadas).toEqual([
      "fonte = pncp",
      "gatilho = cron",
      "resultado = erro_origem",
      "conferencia->>estado = inconclusiva",
      `execucao_id = ${EXECUCAO}`,
      "motivo_parada = subrequisicoes",
    ]);
  });

  it("período é o dia inteiro no horário de Brasília, fim incluído", () => {
    const { q, chamadas } = consultaAnotada();
    aplicarFiltrosHistorico(q, { de: "2026-09-01", ate: "2026-09-30" });
    expect(chamadas).toEqual([
      "consultado_em >= 2026-09-01T00:00:00-03:00",
      "consultado_em < 2026-10-01T00:00:00-03:00",
    ]);
  });

  it("fim do período no último dia do ano vira o primeiro do ano seguinte", () => {
    const { q, chamadas } = consultaAnotada();
    aplicarFiltrosHistorico(q, { ate: "2025-12-31" });
    expect(chamadas).toEqual(["consultado_em < 2026-01-01T00:00:00-03:00"]);
  });
});

describe("mudarFiltroHistorico — um filtro muda, os outros ficam", () => {
  it("troca um filtro e mantém os demais", () => {
    expect(
      mudarFiltroHistorico({ fonte: "pncp", gatilho: "cron" }, { gatilho: "ferramenta" }),
    ).toEqual({ fonte: "pncp", gatilho: "ferramenta" });
  });

  it("valor vazio tira o filtro da URL", () => {
    expect(mudarFiltroHistorico({ fonte: "pncp", de: "2026-09-01" }, { fonte: "" })).toEqual({
      de: "2026-09-01",
    });
  });
});

describe("lerConferencia — veredito gravado em importacoes.conferencia", () => {
  it("lê estado e motivo, ignorando o resto do objeto", () => {
    expect(
      lerConferencia({
        estado: "reprovada",
        motivo: "Contagem divergente: 120 importados, origem diz 125.",
        checagens: { terminou: true },
      }),
    ).toEqual({
      estado: "reprovada",
      motivo: "Contagem divergente: 120 importados, origem diz 125.",
    });
  });

  it("sem motivo, o veredito continua valendo", () => {
    expect(lerConferencia({ estado: "aprovada" })).toEqual({ estado: "aprovada", motivo: "" });
  });

  it("nulo ou formato inesperado é rodada sem conferência", () => {
    expect(lerConferencia(null)).toBeNull();
    expect(lerConferencia(undefined)).toBeNull();
    expect(lerConferencia("aprovada")).toBeNull();
    expect(lerConferencia(["aprovada"])).toBeNull();
    expect(lerConferencia({ estado: "talvez", motivo: "x" })).toBeNull();
    expect(lerConferencia({ motivo: "sem estado" })).toBeNull();
  });
});

describe("resumirMotivo — motivo curto para a coluna", () => {
  it("motivo curto passa inteiro", () => {
    expect(resumirMotivo("Janela vazia na origem.")).toBe("Janela vazia na origem.");
  });

  it("motivo longo é cortado numa palavra, com reticências", () => {
    const motivo =
      "Contagem divergente em janela fechada: 1.203 importados e 12 descartados, origem informa 1.230";
    expect(resumirMotivo(motivo, 40)).toBe("Contagem divergente em janela fechada:…");
  });

  it("junta espaços e quebras de linha", () => {
    expect(resumirMotivo("  Log com\n erro  nosso ")).toBe("Log com erro nosso");
  });
});

describe("parametrosResumoHistorico — o mesmo recorte na função de resumo do banco", () => {
  it("sem filtros, nenhum parâmetro (todos ficam no padrão, sem filtro)", () => {
    expect(parametrosResumoHistorico({})).toEqual({});
  });

  it("período com as mesmas bordas da listagem (Brasília, fim incluído)", () => {
    expect(
      parametrosResumoHistorico({
        fonte: "camara_vot",
        parada: "tempo",
        de: "2026-09-01",
        ate: "2026-09-30",
      }),
    ).toEqual({
      p_fonte: "camara_vot",
      p_motivo_parada: "tempo",
      p_de: "2026-09-01T00:00:00-03:00",
      p_ate: "2026-10-01T00:00:00-03:00",
    });
  });
});

describe("lerResumoHistorico — soma e média do recorte", () => {
  it("médias sobre as rodadas com métricas, não sobre as linhas antigas", () => {
    const r = lerResumoHistorico({
      rodadas: 10,
      rodadas_com_metricas: 4,
      duracao_ms_soma: 600_000,
      itens_soma: 1_200,
      subrequisicoes_soma: 4_000,
      por_motivo: { tempo: 3, fim: 1 },
    });
    expect(r).toEqual({
      rodadas: 10,
      comMetricas: 4,
      duracaoTotalMs: 600_000,
      duracaoMediaMs: 150_000,
      itensTotal: 1_200,
      itensMedia: 300,
      subrequisicoesTotal: 4_000,
      subrequisicoesMedia: 1_000,
      itensPorSegundo: 2,
      porMotivo: { tempo: 3, fim: 1 },
    });
  });

  it("recorte só com linhas antigas: sem médias", () => {
    const r = lerResumoHistorico({
      rodadas: 5,
      rodadas_com_metricas: 0,
      duracao_ms_soma: null,
      itens_soma: null,
      subrequisicoes_soma: null,
      por_motivo: null,
    });
    expect(r.duracaoMediaMs).toBeNull();
    expect(r.itensMedia).toBeNull();
    expect(r.itensPorSegundo).toBeNull();
    expect(r.porMotivo).toEqual({});
  });

  it("números que o PostgREST devolve como texto (bigint) são lidos", () => {
    const r = lerResumoHistorico({
      rodadas: "2",
      rodadas_com_metricas: "2",
      duracao_ms_soma: "4000",
      itens_soma: "8",
      subrequisicoes_soma: "20",
      por_motivo: { fim: 2 },
    });
    expect(r.itensPorSegundo).toBe(2);
    expect(r.subrequisicoesMedia).toBe(10);
  });
});

describe("itensPorSegundo — derivado na tela", () => {
  it("itens sobre a duração", () => {
    expect(itensPorSegundo(270, 150_000)).toBeCloseTo(1.8);
  });

  it("linha antiga ou duração zero não tem taxa", () => {
    expect(itensPorSegundo(null, 150_000)).toBeNull();
    expect(itensPorSegundo(10, null)).toBeNull();
    expect(itensPorSegundo(10, 0)).toBeNull();
  });
});

describe("formatarDuracao — duração legível na coluna e no resumo", () => {
  it("menos de um minuto em segundos, com uma casa", () => {
    expect(formatarDuracao(12_345)).toBe("12,3 s");
  });

  it("minutos e segundos", () => {
    expect(formatarDuracao(148_600)).toBe("2 min 29 s");
  });

  it("horas e minutos", () => {
    expect(formatarDuracao(3_723_000)).toBe("1 h 2 min");
  });

  it("linha antiga não tem duração", () => {
    expect(formatarDuracao(null)).toBe("—");
  });
});
