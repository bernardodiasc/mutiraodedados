import { describe, expect, it } from "vitest";
import {
  conferirJanela,
  janelaPendenteDeCadastro,
  janelasPendentes,
  janelasPendentesPorPeriodo,
  type ConferenciaGravada,
  type EntradaConferencia,
} from "./conferencia";

// ---------------------------------------------------------------------------
// Conferência de uma janela importada pela ferramenta: as regras de veredito
// (aprovada / inconclusiva / reprovada) e a lista de janelas pendentes.
// ---------------------------------------------------------------------------

const MARCO_2024 = { ano: 2024, mes: 3 };

function entrada(parcial: Partial<EntradaConferencia> = {}): EntradaConferencia {
  return {
    janela: MARCO_2024,
    terminou: true,
    rodadas: [{ ano: 2024, mes: 3, resultado: "com_dados", erros: [] }],
    acumulado: 819,
    origem: { total: 819, descartados: 0 },
    registrosNaCelula: 819,
    recente: false,
    findingsNovos: null,
    ...parcial,
  };
}

describe("conferência — aprovada", () => {
  it("janela fechada com a contagem igual ao total da origem", () => {
    const c = conferirJanela(entrada());
    expect(c.estado).toBe("aprovada");
    expect(c.motivo).toBe("Janela completa: 819 de 819 registros da origem.");
    expect(c.checagens).toEqual({
      terminou: true,
      log: {
        situacao: "limpo",
        escopo: "execucao",
        rodadasComErroNosso: 0,
        rodadasComErroDaOrigem: 0,
        avisos: 0,
      },
      contagem: { situacao: "confere", acumulado: 819, descartados: 0, totalOrigem: 819 },
      cobertura: { situacao: "refletida", registrosNaCelula: 819 },
    });
    expect(c.rodadas).toBe(1);
  });

  it("descartados somam com os importados para bater com a origem", () => {
    const c = conferirJanela(entrada({ acumulado: 40, origem: { total: 42, descartados: 2 } }));
    expect(c.estado).toBe("aprovada");
    expect(c.motivo).toBe("Janela completa: 40 de 42 registros da origem (2 descartados).");
  });

  it("avisos `info:` não sujam o log", () => {
    const c = conferirJanela(
      entrada({
        rodadas: [{ ano: 2024, mes: 3, resultado: "com_dados", erros: ["info: fallback"] }],
      }),
    );
    expect(c.estado).toBe("aprovada");
    expect(c.checagens.log.avisos).toBe(1);
  });

  it("inconsistência da origem não reprova: é aviso no log e descarte na contagem", () => {
    // Julho de 2026 na Câmara: 784 listadas, 4 com o detalhe em 404.
    const aviso = (id: string) =>
      `info: vot ${id} descartada: a Câmara lista a votação, mas o detalhe responde 404.`;
    const c = conferirJanela(
      entrada({
        janela: { ano: 2026, mes: 7 },
        rodadas: [
          { ano: 2026, mes: 7, resultado: "com_dados", erros: [aviso("2430854-61")] },
          {
            ano: 2026,
            mes: 7,
            resultado: "com_dados",
            erros: [aviso("2024320-94"), aviso("2129817-26"), aviso("535195-72")],
          },
          { ano: 2026, mes: 7, resultado: "com_dados", erros: [] },
        ],
        acumulado: 780,
        origem: { total: 784, descartados: 4 },
        registrosNaCelula: 780,
      }),
    );
    expect(c.estado).toBe("aprovada");
    expect(c.motivo).toBe("Janela completa: 780 de 784 registros da origem (4 descartados).");
    expect(c.checagens.log).toMatchObject({ situacao: "limpo", avisos: 4 });
  });

  it("janela vazia com a origem dizendo zero aprova", () => {
    const c = conferirJanela(
      entrada({
        rodadas: [{ ano: 2024, mes: 1, resultado: "sem_dados", erros: [] }],
        janela: { ano: 2024, mes: 1 },
        acumulado: 0,
        origem: { total: 0, descartados: 0 },
        registrosNaCelula: 0,
      }),
    );
    expect(c.estado).toBe("aprovada");
    expect(c.motivo).toBe("Janela completa, sem registros na origem.");
  });

  it("sem total da origem, contagem > 0 basta: a comparação não se aplica", () => {
    const c = conferirJanela(entrada({ origem: null, acumulado: 120, registrosNaCelula: 120 }));
    expect(c.estado).toBe("aprovada");
    expect(c.checagens.contagem.situacao).toBe("sem_total_da_origem");
    expect(c.motivo).toBe("Janela completa: 120 registros (a origem não informa total).");
  });

  it("sem total da origem, vazio com resultado legítimo aprova", () => {
    for (const resultado of ["sem_dados", "nao_publicado", "fora_da_janela"]) {
      const c = conferirJanela(
        entrada({
          origem: null,
          acumulado: 0,
          registrosNaCelula: 0,
          rodadas: [{ ano: 2024, mes: 3, resultado, erros: [] }],
        }),
      );
      expect(c.estado, resultado).toBe("aprovada");
      expect(c.checagens.contagem.situacao).toBe("vazia_legitima");
    }
  });

  it("várias rodadas: só a execução inteira limpa aprova", () => {
    const c = conferirJanela(
      entrada({
        rodadas: [
          { ano: 2024, mes: 3, resultado: "com_dados", erros: [] },
          { ano: 2024, mes: 3, resultado: "com_dados", erros: [] },
          { ano: 2024, mes: 3, resultado: "sem_dados", erros: [] },
        ],
      }),
    );
    expect(c.estado).toBe("aprovada");
    expect(c.rodadas).toBe(3);
  });

  it("informa os findings novos sem mudar o veredito", () => {
    const c = conferirJanela(entrada({ findingsNovos: 7 }));
    expect(c.estado).toBe("aprovada");
    expect(c.findingsNovos).toBe(7);
  });
});

describe("conferência — inconclusiva", () => {
  it("rodada que terminou em falha da origem", () => {
    const c = conferirJanela(
      entrada({
        rodadas: [
          { ano: 2024, mes: 3, resultado: "com_dados", erros: [] },
          { ano: 2024, mes: 3, resultado: "erro_origem", erros: ["vot 1: TRANSIENT: 503"] },
        ],
        acumulado: 818,
      }),
    );
    expect(c.estado).toBe("inconclusiva");
    expect(c.motivo).toBe("A origem falhou em 1 rodada(s), mesmo com as novas tentativas.");
    expect(c.checagens.log.situacao).toBe("erro_da_origem");
  });

  it("com falha da origem, contagem e cobertura em falta não reprovam", () => {
    const c = conferirJanela(
      entrada({
        rodadas: [
          { ano: 2024, mes: 3, resultado: "erro_origem", erros: ["lista: TRANSIENT: 503"] },
        ],
        acumulado: 0,
        registrosNaCelula: 0,
      }),
    );
    expect(c.estado).toBe("inconclusiva");
    expect(c.checagens.contagem.situacao).toBe("zero_com_origem");
    expect(c.checagens.cobertura.situacao).toBe("nao_refletida");
  });

  it("contagem divergente em janela recente", () => {
    const c = conferirJanela(entrada({ acumulado: 800, recente: true }));
    expect(c.estado).toBe("inconclusiva");
    expect(c.motivo).toBe(
      "Contagem diverge da origem: 800 importados + 0 descartados, a origem informa 819 (janela recente).",
    );
  });
});

describe("conferência — reprovada", () => {
  it("rodada com falha nossa", () => {
    const c = conferirJanela(
      entrada({
        rodadas: [{ ano: 2024, mes: 3, resultado: "erro_nosso", erros: ["vot 1: violates"] }],
      }),
    );
    expect(c.estado).toBe("reprovada");
    expect(c.motivo).toBe("Falha nossa em 1 rodada(s).");
  });

  it("erro sem classificação conta como nosso", () => {
    const c = conferirJanela(
      entrada({ rodadas: [{ ano: 2024, mes: 3, resultado: null, erros: ["algo estranho"] }] }),
    );
    expect(c.estado).toBe("reprovada");
    expect(c.checagens.log.rodadasComErroNosso).toBe(1);
  });

  it("falha nossa pesa mais que falha da origem", () => {
    const c = conferirJanela(
      entrada({
        rodadas: [
          { ano: 2024, mes: 3, resultado: "erro_origem", erros: ["TRANSIENT: 503"] },
          { ano: 2024, mes: 3, resultado: "erro_nosso", erros: ["db: violates"] },
        ],
      }),
    );
    expect(c.estado).toBe("reprovada");
  });

  it("contagem divergente em janela fechada (comparação exata)", () => {
    const c = conferirJanela(entrada({ acumulado: 818 }));
    expect(c.estado).toBe("reprovada");
    expect(c.motivo).toBe(
      "Contagem diverge da origem: 818 importados + 0 descartados, a origem informa 819.",
    );
    expect(c.checagens.contagem.situacao).toBe("divergente");
  });

  it("importar a mais que a origem também diverge", () => {
    expect(conferirJanela(entrada({ acumulado: 820 })).estado).toBe("reprovada");
  });

  it("zero onde a origem diz que há registros, mesmo em janela recente", () => {
    const c = conferirJanela(
      entrada({
        acumulado: 0,
        recente: true,
        registrosNaCelula: 0,
        rodadas: [{ ano: 2024, mes: 3, resultado: "nao_publicado", erros: [] }],
      }),
    );
    expect(c.estado).toBe("reprovada");
    expect(c.motivo).toBe("Nenhum registro importado, mas a origem informa 819.");
  });

  it("vazio sem total da origem e sem resultado que o explique", () => {
    const c = conferirJanela(
      entrada({
        origem: null,
        acumulado: 0,
        registrosNaCelula: 0,
        rodadas: [{ ano: 2024, mes: 3, resultado: "com_dados", erros: [] }],
      }),
    );
    expect(c.estado).toBe("reprovada");
    expect(c.checagens.contagem.situacao).toBe("vazia_sem_explicacao");
  });

  it("importou mas a célula da cobertura está vazia", () => {
    const c = conferirJanela(entrada({ registrosNaCelula: 0 }));
    expect(c.estado).toBe("reprovada");
    expect(c.motivo).toBe("A cobertura não reflete a janela 2024-03.");
    expect(c.checagens.cobertura.situacao).toBe("nao_refletida");
  });

  it("janela vazia sem tentativa ancorada na célula", () => {
    const c = conferirJanela(
      entrada({
        acumulado: 0,
        origem: { total: 0, descartados: 0 },
        registrosNaCelula: 0,
        rodadas: [{ ano: null, mes: null, resultado: "sem_dados", erros: [] }],
      }),
    );
    expect(c.estado).toBe("reprovada");
    expect(c.checagens.cobertura.situacao).toBe("nao_refletida");
  });

  it("fonte sem célula: a cobertura exige contagem > 0", () => {
    expect(conferirJanela(entrada({ registrosNaCelula: null })).checagens.cobertura.situacao).toBe(
      "refletida",
    );
    const vazia = conferirJanela(
      entrada({
        registrosNaCelula: null,
        acumulado: 0,
        origem: { total: 0, descartados: 0 },
        rodadas: [{ ano: null, mes: null, resultado: "sem_dados", erros: [] }],
      }),
    );
    expect(vazia.estado).toBe("reprovada");
  });

  it("cadastro (janela sem célula no tempo) confere pela contagem", () => {
    const cadastro = { janela: null, registrosNaCelula: null, rodadas: [] as never[] };
    const ok = conferirJanela(
      entrada({
        ...cadastro,
        rodadas: [{ ano: null, mes: null, resultado: "com_dados", erros: [] }],
        acumulado: 648,
        origem: { total: 879, descartados: 231 },
      }),
    );
    expect(ok.estado).toBe("aprovada");
    const vazio = conferirJanela(
      entrada({
        ...cadastro,
        rodadas: [{ ano: null, mes: null, resultado: "sem_dados", erros: [] }],
        acumulado: 0,
        origem: null,
      }),
    );
    expect(vazio.estado).toBe("reprovada");
    expect(vazio.motivo).toBe("A cobertura não reflete o cadastro.");
  });

  it("janela que não terminou", () => {
    const c = conferirJanela(entrada({ terminou: false }));
    expect(c.estado).toBe("reprovada");
    expect(c.motivo).toBe("A janela não terminou.");
  });

  it("nenhuma rodada registrada no Histórico", () => {
    const c = conferirJanela(entrada({ rodadas: [] }));
    expect(c.estado).toBe("reprovada");
    expect(c.motivo).toBe("Nenhuma rodada desta execução ficou registrada no Histórico.");
  });

  it("reprovada vence inconclusiva", () => {
    const c = conferirJanela(
      entrada({
        acumulado: 800,
        recente: true,
        rodadas: [{ ano: 2024, mes: 3, resultado: "erro_nosso", erros: ["db: x"] }],
      }),
    );
    expect(c.estado).toBe("reprovada");
    expect(c.motivo).toBe("Falha nossa em 1 rodada(s).");
  });
});

describe("conferência sem reimportação (janela já completa)", () => {
  const antiga = (resultado: string, erros: string[] = []) => ({
    ano: 2024,
    mes: 3,
    resultado,
    erros,
  });

  it("aprova e diz no motivo e no jsonb que não reimportou", () => {
    const c = conferirJanela(
      entrada({ semReimportacao: true, rodadas: [antiga("com_dados"), antiga("com_dados")] }),
    );
    expect(c.estado).toBe("aprovada");
    expect(c.semReimportacao).toBe(true);
    expect(c.motivo).toBe(
      "Janela completa: 819 de 819 registros da origem. Conferida sem reimportar.",
    );
    expect(c.checagens.log.escopo).toBe("ultima_rodada_da_janela");
    expect(c.rodadas).toBe(2);
  });

  it("log mais frouxo: só a última rodada da janela conta", () => {
    const c = conferirJanela(
      entrada({
        semReimportacao: true,
        rodadas: [antiga("erro_nosso", ["db: violates"]), antiga("com_dados")],
      }),
    );
    expect(c.estado).toBe("aprovada");
    expect(c.checagens.log.rodadasComErroNosso).toBe(0);
  });

  it("a última rodada da janela com falha nossa reprova", () => {
    const c = conferirJanela(
      entrada({
        semReimportacao: true,
        rodadas: [antiga("com_dados"), antiga("erro_nosso", ["db: violates"])],
      }),
    );
    expect(c.estado).toBe("reprovada");
  });

  it("item perdido numa rodada antiga aparece na contagem", () => {
    const c = conferirJanela(entrada({ semReimportacao: true, acumulado: 818 }));
    expect(c.estado).toBe("reprovada");
    expect(c.motivo).toMatch(/^Contagem diverge da origem.*Conferida sem reimportar\.$/);
  });

  it("sem rodada antiga no Histórico não reprova pelo log", () => {
    const c = conferirJanela(entrada({ semReimportacao: true, rodadas: [] }));
    expect(c.estado).toBe("aprovada");
  });

  // Janela vazia cuja rodada antiga não está no Histórico (o checkpoint diz
  // "completa", mas a linha que ancorava a célula não existe mais) — o caso
  // real das votações do Senado de janeiro de 2026.
  const vaziaSemHistorico = (parcial: Partial<EntradaConferencia> = {}) =>
    entrada({
      janela: { ano: 2026, mes: 1 },
      semReimportacao: true,
      rodadas: [],
      acumulado: 0,
      registrosNaCelula: 0,
      ...parcial,
    });

  it("vazia sem rodada no Histórico, com a origem dizendo zero agora, aprova", () => {
    const c = conferirJanela(vaziaSemHistorico({ origem: { total: 0, descartados: 0 } }));
    expect(c.estado).toBe("aprovada");
    expect(c.motivo).toBe("Janela completa, sem registros na origem. Conferida sem reimportar.");
    expect(c.checagens.cobertura.situacao).toBe("refletida");
  });

  it("vazia sem rodada no Histórico e sem total da origem pede reimportação", () => {
    const c = conferirJanela(vaziaSemHistorico({ origem: null }));
    expect(c.estado).toBe("inconclusiva");
    expect(c.motivo).toBe(
      "Nenhuma rodada da janela no Histórico: sem como conferir sem reimportar. Conferida sem reimportar.",
    );
    expect(c.checagens.contagem.situacao).toBe("vazia_sem_explicacao");
    expect(c.checagens.cobertura.situacao).toBe("nao_refletida");
  });

  it("registros no checkpoint e célula vazia, sem rodada no Histórico, pede reimportação", () => {
    const c = conferirJanela(vaziaSemHistorico({ acumulado: 819, origem: null }));
    expect(c.estado).toBe("inconclusiva");
    expect(c.checagens.cobertura.situacao).toBe("nao_refletida");
  });

  it("sem rodada no Histórico, zero onde a origem diz que há registros continua reprovando", () => {
    const c = conferirJanela(vaziaSemHistorico({ origem: { total: 12, descartados: 0 } }));
    expect(c.estado).toBe("reprovada");
    expect(c.checagens.contagem.situacao).toBe("zero_com_origem");
  });

  it("vazia com rodada antiga que não explica o vazio continua reprovando", () => {
    const c = conferirJanela(
      vaziaSemHistorico({
        origem: null,
        rodadas: [{ ano: 2026, mes: 1, resultado: "com_dados", erros: [] }],
      }),
    );
    expect(c.estado).toBe("reprovada");
  });

  it("falha ao consultar o total na origem é inconclusiva", () => {
    const c = conferirJanela(
      entrada({
        semReimportacao: true,
        origem: null,
        falhaAoConsultarOrigem: "TRANSIENT: Câmara API 503",
      }),
    );
    expect(c.estado).toBe("inconclusiva");
    expect(c.motivo).toBe(
      "Não foi possível consultar o total na origem (TRANSIENT: Câmara API 503). Conferida sem reimportar.",
    );
  });
});

describe("janelas pendentes", () => {
  const HOJE = new Date(2003, 4, 15); // maio de 2003 — a janela de camara_vot começa em 2003

  function gravada(
    ano: number,
    mes: number,
    estado: ConferenciaGravada["estado"],
    consultado_em: string,
  ): ConferenciaGravada {
    return { ano, mes, estado, motivo: "x", execucao_id: `e-${ano}-${mes}`, consultado_em };
  }

  it("enumera os meses da janela de disponibilidade, do mais recente ao mais antigo", () => {
    const p = janelasPendentes("camara_vot", [], HOJE);
    expect(p.map((j) => `${j.ano}-${j.mes}`)).toEqual([
      "2003-5",
      "2003-4",
      "2003-3",
      "2003-2",
      "2003-1",
    ]);
    expect(p[0]).toEqual({
      ano: 2003,
      mes: 5,
      dataInicio: "2003-05-01",
      dataFim: "2003-05-31",
      ultima: null,
    });
  });

  it("janela cuja última conferência é aprovada não é pendente", () => {
    const p = janelasPendentes(
      "camara_vot",
      [
        gravada(2003, 3, "aprovada", "2026-09-01T00:00:00Z"),
        gravada(2003, 4, "reprovada", "2026-09-01T00:00:00Z"),
      ],
      HOJE,
    );
    expect(p.map((j) => j.mes)).toEqual([5, 4, 2, 1]);
    expect(p[1].ultima).toMatchObject({ estado: "reprovada", execucao_id: "e-2003-4" });
  });

  it("vale a ÚLTIMA conferência da janela", () => {
    const p = janelasPendentes(
      "camara_vot",
      [
        gravada(2003, 3, "inconclusiva", "2026-09-02T00:00:00Z"),
        gravada(2003, 3, "aprovada", "2026-09-01T00:00:00Z"),
        gravada(2003, 2, "aprovada", "2026-09-02T00:00:00Z"),
        gravada(2003, 2, "reprovada", "2026-09-01T00:00:00Z"),
      ],
      HOJE,
    );
    expect(p.map((j) => j.mes)).toEqual([5, 4, 3, 1]);
  });

  it("conferência fora da janela de disponibilidade não cria pendência", () => {
    const p = janelasPendentes(
      "camara_vot",
      [gravada(2002, 12, "reprovada", "2026-09-01T00:00:00Z")],
      HOJE,
    );
    expect(p.every((j) => j.ano === 2003)).toBe(true);
  });
});

describe("janelas pendentes — fonte anual", () => {
  const HOJE = new Date(1990, 4, 15); // maio de 1990 — a janela de senado_mat começa em 1988

  it("uma janela por ano, ancorada em janeiro, incluindo o ano corrente", () => {
    const p = janelasPendentes("senado_mat", [], HOJE, "ano");
    expect(p.map((j) => j.ano)).toEqual([1990, 1989, 1988]);
    expect(p[0]).toEqual({
      ano: 1990,
      mes: 1,
      dataInicio: "1990-01-01",
      dataFim: "1990-12-31",
      ultima: null,
    });
  });

  it("ano com a última conferência aprovada sai da lista", () => {
    const p = janelasPendentes(
      "senado_mat",
      [
        {
          ano: 1989,
          mes: 1,
          estado: "aprovada",
          motivo: "x",
          execucao_id: "e",
          consultado_em: "2026-09-01",
        },
        {
          ano: 1988,
          mes: 1,
          estado: "reprovada",
          motivo: "x",
          execucao_id: "e",
          consultado_em: "2026-09-01",
        },
      ],
      HOJE,
      "ano",
    );
    expect(p.map((j) => j.ano)).toEqual([1990, 1988]);
    expect(p[1].ultima?.estado).toBe("reprovada");
  });
});

describe("janelas pendentes — cadastro", () => {
  it("nunca conferido: uma janela só, sem datas", () => {
    expect(janelaPendenteDeCadastro([])).toEqual([
      { ano: 0, mes: 0, dataInicio: "", dataFim: "", ultima: null },
    ]);
  });

  it("vale a última conferência da fonte, qualquer que seja a linha", () => {
    const aprovada = {
      ano: null,
      mes: null,
      estado: "aprovada" as const,
      motivo: "x",
      execucao_id: "e1",
      consultado_em: "2026-09-02",
    };
    const reprovada = { ...aprovada, estado: "reprovada" as const, consultado_em: "2026-09-01" };
    expect(janelaPendenteDeCadastro([reprovada, aprovada])).toEqual([]);
    expect(
      janelaPendenteDeCadastro([{ ...reprovada, consultado_em: "2026-09-03" }, aprovada])[0].ultima
        ?.estado,
    ).toBe("reprovada");
  });
});

describe("janelas pendentes — período do SICONFI", () => {
  const HOJE = new Date(2014, 8, 15); // setembro de 2014 — a janela do SICONFI começa em 2013

  it("quadrimestres já encerrados, do mais recente ao mais antigo", () => {
    const p = janelasPendentesPorPeriodo("siconfi", 3, [], HOJE);
    // 2014: só o 1º quadrimestre (jan–abr) e o 2º (mai–ago) terminaram.
    expect(p.map((j) => `${j.ano}/${j.mes}`)).toEqual([
      "2014/2",
      "2014/1",
      "2013/3",
      "2013/2",
      "2013/1",
    ]);
    expect(p[0]).toMatchObject({ dataInicio: "2014-05-01", dataFim: "2014-08-31" });
  });

  it("relatório anual (sem período): exercícios encerrados, com período 0", () => {
    const p = janelasPendentesPorPeriodo("siconfi", 0, [], HOJE);
    expect(p.map((j) => `${j.ano}/${j.mes}`)).toEqual(["2013/0"]);
    expect(p[0]).toMatchObject({ dataInicio: "2013-01-01", dataFim: "2013-12-31" });
  });

  it("período com a última conferência aprovada sai da lista", () => {
    const p = janelasPendentesPorPeriodo(
      "siconfi",
      3,
      [
        {
          ano: 2013,
          mes: 3,
          estado: "aprovada",
          motivo: "x",
          execucao_id: "e",
          consultado_em: "2026-09-01",
        },
      ],
      HOJE,
    );
    expect(p.map((j) => `${j.ano}/${j.mes}`)).toEqual(["2014/2", "2014/1", "2013/2", "2013/1"]);
  });
});
