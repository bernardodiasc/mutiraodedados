import { describe, expect, it, vi } from "vitest";
import type { Conferencia, EstadoConferencia, JanelaPendente } from "./conferencia";
import { ORDEM } from "./dependencias";
import {
  codigoDeSaida,
  codigoDeSaidaDasFontes,
  executarFontes,
  executarPlano,
  importarJanela,
  interpretarArgs,
  janelasDasPendentes,
  janelasDoIntervalo,
  lerEnv,
  montarPlano,
  paramsDaJanela,
  resumoDasFontes,
  vereditoDaJanela,
  type CorpoNomeado,
  type Dependencias,
  type Janela,
  type Plano,
  type RespostaRodada,
} from "./importar-cli";

describe("importar/argumentos", () => {
  it("tarefa e intervalo, com os padrões", () => {
    expect(interpretarArgs(["camara_vot", "2024-03"])).toEqual({
      tarefas: ["camara_vot"],
      intervalo: "2024-03",
      pendentes: false,
      reprocessar: false,
      tetoRodadas: 30,
      params: {},
    });
  });

  it("--pendentes dispensa o intervalo, que passa a só restringir", () => {
    expect(interpretarArgs(["camara_vot", "--pendentes"])).toMatchObject({
      pendentes: true,
      intervalo: null,
    });
    expect(interpretarArgs(["camara_vot", "--pendentes", "2024"])).toMatchObject({
      pendentes: true,
      intervalo: "2024",
    });
  });

  it("--reprocessar e --teto-rodadas", () => {
    expect(
      interpretarArgs(["senado_vot", "2024-01..2024-03", "--reprocessar", "--teto-rodadas", "5"]),
    ).toMatchObject({ reprocessar: true, tetoRodadas: 5 });
  });

  it("tarefa que a tabela de dependências não conhece é recusada", () => {
    expect(() => interpretarArgs(["camara_votacoes", "2024-03"])).toThrow(/camara_votacoes/);
  });

  it("várias tarefas vão na ordem da tabela de dependências", () => {
    expect(interpretarArgs(["senado_vot", "camara_cadastro", "--pendentes", "2024"])).toMatchObject(
      { tarefas: ["camara_cadastro", "senado_vot"], intervalo: "2024" },
    );
  });

  it("--todas pede todas as tarefas da tabela", () => {
    expect(interpretarArgs(["--todas", "--pendentes"]).tarefas).toEqual(ORDEM);
    expect(() => interpretarArgs(["--todas", "camara_vot", "--pendentes"])).toThrow(/uso:/);
  });

  it("intervalo mal escrito é uso incorreto, antes de rodar qualquer fonte", () => {
    expect(() => interpretarArgs(["camara_vot", "2024-13"])).toThrow(/mês inválido/);
    expect(() => interpretarArgs(["camara_vot", "--pendentes", "2024-03..2024-01"])).toThrow(
      /invertido/,
    );
  });

  it("--param passa parâmetros próprios da tarefa", () => {
    expect(
      interpretarArgs([
        "siconfi_relatorio",
        "2023",
        "--param",
        "codIbge=35",
        "--param",
        "tipoRelatorio=RGF Simplificado",
      ]).params,
    ).toEqual({ codIbge: "35", tipoRelatorio: "RGF Simplificado" });
    expect(() => interpretarArgs(["senado_mat", "2023", "--param", "sigla"])).toThrow(
      /chave=valor/,
    );
  });

  it("o relatório do SICONFI exige o ente e o tipo", () => {
    expect(() => interpretarArgs(["siconfi_relatorio", "2023", "--param", "codIbge=35"])).toThrow(
      /tipoRelatorio/,
    );
  });

  it("cadastro não tem intervalo", () => {
    expect(interpretarArgs(["ibge"])).toMatchObject({ tarefas: ["ibge"], intervalo: null });
    expect(() => interpretarArgs(["camara_ceap"])).toThrow(/uso:/);
  });

  it("faltando o intervalo, explica o uso", () => {
    expect(() => interpretarArgs(["camara_vot"])).toThrow(/uso:/);
  });
});

describe("importar/janelas do intervalo", () => {
  it("um mês vira uma janela do primeiro ao último dia", () => {
    expect(janelasDoIntervalo("2024-02")).toEqual([
      { dataInicio: "2024-02-01", dataFim: "2024-02-29" },
    ]);
  });

  it("intervalo de meses é fatiado do mais recente para o mais antigo", () => {
    expect(janelasDoIntervalo("2023-11..2024-01")).toEqual([
      { dataInicio: "2024-01-01", dataFim: "2024-01-31" },
      { dataInicio: "2023-12-01", dataFim: "2023-12-31" },
      { dataInicio: "2023-11-01", dataFim: "2023-11-30" },
    ]);
  });

  it("um ano vira doze janelas", () => {
    const j = janelasDoIntervalo("2023");
    expect(j).toHaveLength(12);
    expect(j[0]).toEqual({ dataInicio: "2023-12-01", dataFim: "2023-12-31" });
    expect(j[11]).toEqual({ dataInicio: "2023-01-01", dataFim: "2023-01-31" });
  });

  it("intervalo invertido ou mal escrito é recusado", () => {
    expect(() => janelasDoIntervalo("2024-03..2024-01")).toThrow();
    expect(() => janelasDoIntervalo("março")).toThrow();
    expect(() => janelasDoIntervalo("2024-13")).toThrow();
  });
});

describe("importar/janelas por granularidade", () => {
  it("fonte anual: um ano por janela, do mais recente ao mais antigo", () => {
    expect(janelasDoIntervalo("2022..2023", "ano")).toEqual([
      { dataInicio: "2023-01-01", dataFim: "2023-12-31" },
      { dataInicio: "2022-01-01", dataFim: "2022-12-31" },
    ]);
    expect(janelasDoIntervalo("2023", "ano")).toHaveLength(1);
    expect(() => janelasDoIntervalo("2023-03", "ano")).toThrow(/AAAA ou AAAA\.\.AAAA/);
    // Nas fontes mensais, anos inteiros viram todos os meses deles.
    expect(janelasDoIntervalo("2022..2023")).toHaveLength(24);
  });

  it("cadastro: uma janela só, sem datas", () => {
    expect(janelasDoIntervalo(null, "cadastro")).toEqual([{ dataInicio: "", dataFim: "" }]);
  });

  it("SICONFI: os períodos do tipo em cada exercício", () => {
    expect(janelasDoIntervalo("2023", "periodo", { tipoRelatorio: "RGF" })).toEqual([
      { dataInicio: "2023-09-01", dataFim: "2023-12-31", periodo: 3 },
      { dataInicio: "2023-05-01", dataFim: "2023-08-31", periodo: 2 },
      { dataInicio: "2023-01-01", dataFim: "2023-04-30", periodo: 1 },
    ]);
    expect(janelasDoIntervalo("2022..2023", "periodo", { tipoRelatorio: "DCA" })).toEqual([
      { dataInicio: "2023-01-01", dataFim: "2023-12-31" },
      { dataInicio: "2022-01-01", dataFim: "2022-12-31" },
    ]);
  });

  it("cada tarefa recebe a janela no formato do seu schema", () => {
    const marco = { dataInicio: "2024-03-01", dataFim: "2024-03-31" };
    const ano = { dataInicio: "2024-01-01", dataFim: "2024-12-31" };
    expect(paramsDaJanela("pncp", marco)).toEqual({
      dataInicial: "2024-03-01",
      dataFinal: "2024-03-31",
    });
    expect(paramsDaJanela("convenios", marco)).toEqual({
      dataInicial: "2024-03-01",
      dataFinal: "2024-03-31",
    });
    expect(paramsDaJanela("camara_ceap", marco)).toEqual({ ano: 2024, mes: 3 });
    expect(paramsDaJanela("senado_ceaps", marco)).toEqual({ ano: 2024, mes: 3 });
    expect(paramsDaJanela("senado_mat", ano, {}, { sigla: "PEC" })).toEqual({
      ano: 2024,
      sigla: "PEC",
    });
    expect(paramsDaJanela("camara_props", ano)).toEqual({ ano: 2024 });
    expect(paramsDaJanela("camara_props", ano, {}, { siglaTipo: "PDL" })).toEqual({
      ano: 2024,
      siglaTipo: "PDL",
    });
    expect(paramsDaJanela("ibge", { dataInicio: "", dataFim: "" })).toEqual({});
    expect(paramsDaJanela("camara_cadastro", { dataInicio: "", dataFim: "" })).toEqual({});
    expect(
      paramsDaJanela(
        "camara_cadastro",
        { dataInicio: "", dataFim: "" },
        {},
        { idLegislatura: "56" },
      ),
    ).toEqual({ idLegislatura: 56 });
    expect(
      paramsDaJanela(
        "siconfi_relatorio",
        { dataInicio: "2023-09-01", dataFim: "2023-12-31", periodo: 3 },
        {},
        { codIbge: "35", tipoRelatorio: "RGF" },
      ),
    ).toEqual({ codIbge: "35", tipoRelatorio: "RGF", exercicio: 2023, periodo: 3 });
  });
});

describe("importar/.env.local", () => {
  it("lê chave=valor, com ou sem aspas, ignorando comentários", () => {
    expect(
      lerEnv('# comentário\nCRON_SECRET="abc=123"\n\nSITE_URL=https://exemplo.test\n'),
    ).toEqual({ CRON_SECRET: "abc=123", SITE_URL: "https://exemplo.test" });
  });
});

function resposta(parcial: Partial<RespostaRodada> = {}): RespostaRodada {
  return {
    importados: { votacoes: 5, votos: 2000 },
    erros: [],
    avisos: [],
    haMais: false,
    cursor: 5,
    totalAcumulado: 5,
    parada: "fim",
    conferencia: null,
    ...parcial,
  };
}

function conferencia(estado: EstadoConferencia, motivo = `motivo ${estado}`): Conferencia {
  return {
    estado,
    motivo,
    rodadas: 1,
    semReimportacao: false,
    janelaRecente: false,
    checagens: {
      terminou: true,
      log: {
        situacao: "limpo",
        escopo: "execucao",
        rodadasComErroNosso: 0,
        rodadasComErroDaOrigem: 0,
        avisos: 0,
      },
      contagem: { situacao: "confere", acumulado: 5, descartados: 0, totalOrigem: 5 },
      cobertura: { situacao: "refletida", registrosNaCelula: 5 },
    },
    findingsNovos: null,
  };
}

/** Resposta da última rodada, com a conferência da janela. */
const final = (estado: EstadoConferencia) => resposta({ conferencia: conferencia(estado) });

describe("importar/uma janela", () => {
  const pedido = {
    tarefa: "camara_vot",
    params: { dataInicio: "2024-03-01", dataFim: "2024-03-31" },
    execucaoId: "7d1f3c2a-9b8e-4f6d-a5c4-3b2a1f0e9d8c",
    reprocessar: false,
    tetoRodadas: 10,
  };

  it("repete rodadas com o mesmo execucao_id até haMais virar falso", async () => {
    const chamar = vi
      .fn()
      .mockResolvedValueOnce(resposta({ haMais: true, parada: "tempo" }))
      .mockResolvedValueOnce(resposta({ haMais: true, parada: "tempo" }))
      .mockResolvedValueOnce(resposta());
    const r = await importarJanela(pedido, chamar);
    expect(r.estado).toBe("terminou");
    expect(r.rodadas).toHaveLength(3);
    expect(chamar).toHaveBeenCalledTimes(3);
    for (const [corpo] of chamar.mock.calls) {
      expect(corpo).toEqual({
        tarefa: "camara_vot",
        params: pedido.params,
        execucao_id: pedido.execucaoId,
        reprocessar: false,
      });
    }
  });

  it("para no teto de rodadas", async () => {
    const chamar = vi.fn().mockResolvedValue(resposta({ haMais: true, parada: "tempo" }));
    const r = await importarJanela({ ...pedido, tetoRodadas: 4 }, chamar);
    expect(r.estado).toBe("teto");
    expect(chamar).toHaveBeenCalledTimes(4);
  });

  it("falha da chamada encerra a janela com o erro", async () => {
    const chamar = vi
      .fn()
      .mockResolvedValueOnce(resposta({ haMais: true }))
      .mockRejectedValueOnce(new Error("HTTP 400: janela maior que um mês"));
    const r = await importarJanela(pedido, chamar);
    expect(r.estado).toBe("falhou");
    expect(r.falha).toBe("HTTP 400: janela maior que um mês");
    expect(r.rodadas).toHaveLength(1);
  });
});

describe("importar/rodada interrompida", () => {
  it("rodada que parou por falha passageira encerra a tentativa", async () => {
    const chamar = vi
      .fn()
      .mockResolvedValueOnce(resposta({ haMais: true, parada: "tempo" }))
      .mockResolvedValueOnce(resposta({ haMais: true, parada: "erro" }));
    const r = await importarJanela(
      {
        tarefa: "camara_vot",
        params: {},
        execucaoId: "e",
        reprocessar: false,
        tetoRodadas: 10,
      },
      chamar,
    );
    expect(r.estado).toBe("interrompida");
    expect(chamar).toHaveBeenCalledTimes(2);
  });
});

describe("importar/veredito da tentativa", () => {
  it("vem da conferência da última rodada", () => {
    expect(
      vereditoDaJanela({ estado: "terminou", rodadas: [resposta(), final("aprovada")] }, 30),
    ).toEqual({ estado: "aprovada", motivo: "motivo aprovada" });
  });

  it("teto estourado é reprovada (laço)", () => {
    expect(vereditoDaJanela({ estado: "teto", rodadas: [] }, 30)).toEqual({
      estado: "reprovada",
      motivo: "Teto de 30 rodadas sem a janela terminar (laço).",
    });
  });

  it("rodada interrompida é inconclusiva; chamada que falhou é reprovada", () => {
    expect(vereditoDaJanela({ estado: "interrompida", rodadas: [] }, 30).estado).toBe(
      "inconclusiva",
    );
    expect(vereditoDaJanela({ estado: "falhou", rodadas: [], falha: "HTTP 500" }, 30)).toEqual({
      estado: "reprovada",
      motivo: "A chamada à rota falhou: HTTP 500",
    });
  });

  it("janela já completa, sem conferência nesta execução", () => {
    expect(
      vereditoDaJanela(
        { estado: "terminou", rodadas: [resposta({ parada: "janela_completa" })] },
        30,
      ).estado,
    ).toBe("sem_conferencia");
  });
});

const MAR = { dataInicio: "2024-03-01", dataFim: "2024-03-31" };
const FEV = { dataInicio: "2024-02-01", dataFim: "2024-02-29" };
const JAN = { dataInicio: "2024-01-01", dataFim: "2024-01-31" };
const DEZ = { dataInicio: "2023-12-01", dataFim: "2023-12-31" };

function plano(janelas: Janela[] = [MAR, FEV, JAN], parcial: Partial<Plano> = {}): Plano {
  return { tarefa: "camara_vot", janelas, reprocessar: false, tetoRodadas: 5, ...parcial };
}

/** Dependências de teste: `chamar` responde o que o roteiro mandar. */
function deps(
  roteiro: (corpo: CorpoNomeado) => RespostaRodada,
): Dependencias & { chamadas: CorpoNomeado[]; esperas: number[] } {
  const chamadas: CorpoNomeado[] = [];
  const esperas: number[] = [];
  let n = 0;
  return {
    chamadas,
    esperas,
    chamar: async (corpo) => {
      chamadas.push(corpo);
      return roteiro(corpo);
    },
    novoExecucaoId: () => `execucao-${++n}`,
    esperar: async (ms) => {
      esperas.push(ms);
    },
    log: () => {},
  };
}

const inicio = (c: CorpoNomeado) => String(c.params.dataInicio);

describe("importar/política de parada", () => {
  it("todas aprovadas: percorre o plano e sai com 0", async () => {
    const d = deps(() => final("aprovada"));
    const r = await executarPlano(plano(), d);
    expect(r.parou).toBeNull();
    expect(r.desfechos.map((x) => x.veredito.estado)).toEqual(["aprovada", "aprovada", "aprovada"]);
    expect(codigoDeSaida(r)).toBe(0);
    // Um execucao_id por janela.
    expect(new Set(d.chamadas.map((c) => c.execucao_id)).size).toBe(3);
  });

  it("reprovada para a fonte na hora", async () => {
    const d = deps((c) => final(inicio(c) === FEV.dataInicio ? "reprovada" : "aprovada"));
    const r = await executarPlano(plano(), d);
    expect(r.desfechos.map((x) => x.janela)).toEqual([MAR, FEV]);
    expect(r.parou).toMatch(/reprovada/);
    expect(codigoDeSaida(r)).toBe(1);
  });

  it("inconclusiva re-tenta uma vez após pausa, refazendo a janela", async () => {
    let tentativasFev = 0;
    const d = deps((c) => {
      if (inicio(c) !== FEV.dataInicio) return final("aprovada");
      return final(++tentativasFev === 1 ? "inconclusiva" : "aprovada");
    });
    const r = await executarPlano(plano(), d);
    expect(r.desfechos.map((x) => x.veredito.estado)).toEqual(["aprovada", "aprovada", "aprovada"]);
    expect(d.esperas).toEqual([60_000]);
    const fev = d.chamadas.filter((c) => inicio(c) === FEV.dataInicio);
    expect(fev.map((c) => c.reprocessar)).toEqual([false, true]);
    expect(fev[0].execucao_id).not.toBe(fev[1].execucao_id);
  });

  it("inconclusiva que persiste fica pendente e a fonte segue", async () => {
    const d = deps((c) => final(inicio(c) === FEV.dataInicio ? "inconclusiva" : "aprovada"));
    const r = await executarPlano(plano(), d);
    expect(r.parou).toBeNull();
    expect(r.desfechos.map((x) => x.veredito.estado)).toEqual([
      "aprovada",
      "inconclusiva",
      "aprovada",
    ]);
    expect(codigoDeSaida(r)).toBe(1);
  });

  it("3 inconclusivas seguidas param a fonte", async () => {
    const d = deps(() => final("inconclusiva"));
    const r = await executarPlano(plano([MAR, FEV, JAN, DEZ]), d);
    expect(r.desfechos).toHaveLength(3);
    expect(r.parou).toMatch(/3 janelas inconclusivas seguidas/);
  });

  it("aprovada no meio zera a sequência de inconclusivas", async () => {
    const d = deps((c) => final(inicio(c) === JAN.dataInicio ? "aprovada" : "inconclusiva"));
    const r = await executarPlano(plano([MAR, FEV, JAN, DEZ]), d);
    expect(r.parou).toBeNull();
    expect(r.desfechos).toHaveLength(4);
  });

  it("teto de rodadas estourado reprova e para a fonte", async () => {
    const d = deps(() => resposta({ haMais: true, parada: "tempo" }));
    const r = await executarPlano(plano([MAR, FEV], { tetoRodadas: 3 }), d);
    expect(r.desfechos).toMatchObject([
      { janela: MAR, veredito: { estado: "reprovada", motivo: expect.stringMatching(/laço/) } },
    ]);
    expect(d.chamadas).toHaveLength(3);
  });
});

describe("importar/desfecho de cada janela", () => {
  it("guarda a execução, as rodadas, os erros sem info: e os findings da última tentativa", async () => {
    const d = deps(() =>
      resposta({
        erros: ["HTTP 500 na votação 123"],
        avisos: ["info: votação sem votos"],
        conferencia: { ...conferencia("reprovada"), findingsNovos: 2 },
      }),
    );
    const r = await executarPlano(plano([MAR]), d);
    expect(r.desfechos).toEqual([
      {
        janela: MAR,
        veredito: { estado: "reprovada", motivo: "motivo reprovada" },
        execucaoId: "execucao-1",
        rodadas: 1,
        importados: { votacoes: 5, votos: 2000 },
        erros: ["HTTP 500 na votação 123"],
        findingsNovos: 2,
      },
    ]);
  });

  it("importados somam as rodadas das duas tentativas; o resto é da última", async () => {
    let n = 0;
    const d = deps(() =>
      ++n === 1
        ? resposta({ haMais: true, parada: "tempo" })
        : final(n === 2 ? "inconclusiva" : "aprovada"),
    );
    const r = await executarPlano(plano([MAR]), d);
    expect(r.desfechos[0]).toMatchObject({
      veredito: { estado: "aprovada" },
      execucaoId: "execucao-2",
      rodadas: 1,
      importados: { votacoes: 15, votos: 6000 },
      findingsNovos: null,
    });
  });
});

describe("importar/só pendentes", () => {
  const pendente = (j: typeof MAR): JanelaPendente => ({
    ano: Number(j.dataInicio.slice(0, 4)),
    mes: Number(j.dataInicio.slice(5, 7)),
    ...j,
    ultima: null,
  });

  const semReprocessar = (j: typeof MAR) => ({ ...j, reprocessar: false });

  it("restringe as pendentes ao intervalo, mantendo a ordem da rota", () => {
    expect(janelasDasPendentes([MAR, FEV, JAN, DEZ].map(pendente), "2024")).toEqual(
      [MAR, FEV, JAN].map(semReprocessar),
    );
    expect(janelasDasPendentes([MAR, DEZ].map(pendente), null)).toEqual(
      [MAR, DEZ].map(semReprocessar),
    );
  });

  it("só reimporta a pendente reprovada ou inconclusiva; a nunca conferida vai sem", () => {
    const comUltima = (j: typeof MAR, estado: EstadoConferencia): JanelaPendente => ({
      ...pendente(j),
      ultima: { estado, motivo: "x", execucao_id: "e", consultado_em: "2026-09-01T00:00:00Z" },
    });
    expect(
      janelasDasPendentes(
        [comUltima(MAR, "reprovada"), comUltima(FEV, "inconclusiva"), pendente(JAN)],
        null,
      ).map((j) => j.reprocessar),
    ).toEqual([true, true, false]);
  });

  it("o plano das pendentes não força reprocessar; --reprocessar força", async () => {
    const consultar = vi.fn(async (tarefa: string) => ({
      consulta: "pendentes" as const,
      tarefa,
      janelas: [pendente(FEV)],
    }));
    const p = await montarPlano(
      "camara_vot",
      interpretarArgs(["camara_vot", "--pendentes"]),
      consultar,
    );
    expect(consultar).toHaveBeenCalledWith("camara_vot");
    expect(p).toMatchObject({ janelas: [semReprocessar(FEV)], reprocessar: false });

    const d = deps(() => final("aprovada"));
    await executarPlano(p, d);
    expect(d.chamadas[0].reprocessar).toBe(false);

    const forcado = await montarPlano(
      "camara_vot",
      interpretarArgs(["camara_vot", "--pendentes", "--reprocessar"]),
      consultar,
    );
    const d2 = deps(() => final("aprovada"));
    await executarPlano(forcado, d2);
    expect(d2.chamadas[0].reprocessar).toBe(true);
  });

  it("janela com reprocessar próprio vai com reprocessar", async () => {
    const d = deps(() => final("aprovada"));
    await executarPlano(plano([{ ...MAR, reprocessar: true }, FEV]), d);
    expect(d.chamadas.map((c) => c.reprocessar)).toEqual([true, false]);
  });

  it("interrompida e rodada de novo, continua de onde parou", async () => {
    // O "servidor": guarda a conferência de cada janela e deriva dela as
    // pendentes — a ferramenta não guarda nada entre uma execução e outra.
    const aprovadas = new Set<string>();
    const consultar = async (tarefa: string) => ({
      consulta: "pendentes" as const,
      tarefa,
      janelas: [MAR, FEV, JAN].filter((j) => !aprovadas.has(j.dataInicio)).map(pendente),
    });
    let caiu = false;
    const servidor = (corpo: CorpoNomeado) => {
      if (inicio(corpo) === FEV.dataInicio && !caiu) {
        caiu = true;
        throw new Error("conexão caiu"); // a primeira execução para aqui
      }
      aprovadas.add(inicio(corpo));
      return final("aprovada");
    };
    const args = interpretarArgs(["camara_vot", "--pendentes"]);

    await executarPlano(await montarPlano("camara_vot", args, consultar), deps(servidor));
    expect(aprovadas).toEqual(new Set([MAR.dataInicio]));

    const segunda = deps(servidor);
    const r = await executarPlano(await montarPlano("camara_vot", args, consultar), segunda);
    expect(segunda.chamadas.map(inicio)).toEqual([FEV.dataInicio, JAN.dataInicio]);
    expect(codigoDeSaida(r)).toBe(0);
    expect(aprovadas.size).toBe(3);
  });
});

describe("importar/pendentes de outras granularidades", () => {
  it("SICONFI: o período da pendente vira o período da janela, e o ente vai junto", async () => {
    const consultar = vi.fn(async (tarefa: string) => ({
      consulta: "pendentes" as const,
      tarefa,
      janelas: [
        { ano: 2023, mes: 3, dataInicio: "2023-09-01", dataFim: "2023-12-31", ultima: null },
        { ano: 2022, mes: 3, dataInicio: "2022-09-01", dataFim: "2022-12-31", ultima: null },
      ],
    }));
    const args = interpretarArgs([
      "siconfi_relatorio",
      "--pendentes",
      "2023",
      "--param",
      "codIbge=35",
      "--param",
      "tipoRelatorio=RGF",
    ]);
    const p = await montarPlano("siconfi_relatorio", args, consultar);
    expect(consultar).toHaveBeenCalledWith("siconfi_relatorio", {
      codIbge: "35",
      tipoRelatorio: "RGF",
    });
    expect(p.janelas).toEqual([
      { dataInicio: "2023-09-01", dataFim: "2023-12-31", periodo: 3, reprocessar: false },
    ]);

    const d = deps(() => final("aprovada"));
    await executarPlano(p, d);
    expect(d.chamadas[0].params).toEqual({
      codIbge: "35",
      tipoRelatorio: "RGF",
      exercicio: 2023,
      periodo: 3,
    });
  });

  it("cadastro: a única pendente vira a única janela", async () => {
    const consultar = async (tarefa: string) => ({
      consulta: "pendentes" as const,
      tarefa,
      janelas: [{ ano: 0, mes: 0, dataInicio: "", dataFim: "", ultima: null }],
    });
    const p = await montarPlano("ibge", interpretarArgs(["ibge", "--pendentes"]), consultar);
    expect(p.janelas).toEqual([{ dataInicio: "", dataFim: "", reprocessar: false }]);
  });
});

describe("importar/várias fontes", () => {
  const pendentesDe = (janelas: Janela[]) => async (tarefa: string) => ({
    consulta: "pendentes" as const,
    tarefa,
    janelas: janelas.map((j) => ({
      ano: Number(j.dataInicio.slice(0, 4)),
      mes: Number(j.dataInicio.slice(5, 7)),
      dataInicio: j.dataInicio,
      dataFim: j.dataFim,
      ultima: null,
    })),
  });

  function fontes(
    temAdaptador: string[],
    roteiro: (corpo: CorpoNomeado) => RespostaRodada,
    consultarPendentes = pendentesDe([MAR]),
  ) {
    const linhas: string[] = [];
    const d = deps(roteiro);
    return {
      ...d,
      linhas,
      log: (l: string) => linhas.push(l),
      consultarPendentes,
      temAdaptador: (t: string) => temAdaptador.includes(t),
    };
  }

  it("roda na ordem da tabela e pula, com aviso, a tarefa sem adaptador", async () => {
    const d = fontes(["camara_vot", "senado_vot"], () => final("aprovada"));
    const r = await executarFontes(
      interpretarArgs(["senado_vot", "pncp", "camara_vot", "--pendentes"]),
      d,
    );
    expect(r.map((x) => [x.tarefa, x.situacao])).toEqual([
      ["camara_vot", "rodou"],
      ["senado_vot", "rodou"],
      ["pncp", "sem_adaptador"],
    ]);
    expect(d.chamadas.map((c) => c.tarefa)).toEqual(["camara_vot", "senado_vot"]);
    expect(d.linhas.join("\n")).toMatch(/pncp.*sem adaptador/);
    expect(codigoDeSaidaDasFontes(r)).toBe(0);
  });

  it("fonte reprovada para; a seguinte, que não depende dela, roda", async () => {
    const d = fontes(["camara_vot", "senado_vot"], (c) =>
      final(c.tarefa === "camara_vot" ? "reprovada" : "aprovada"),
    );
    const r = await executarFontes(interpretarArgs(["camara_vot", "senado_vot", "--pendentes"]), d);
    expect(r[0]).toMatchObject({ situacao: "rodou", resultado: { parou: expect.any(String) } });
    expect(r[1]).toMatchObject({ situacao: "rodou", resultado: { parou: null } });
    expect(codigoDeSaidaDasFontes(r)).toBe(1);
  });

  it("fonte que não conseguiu montar o plano bloqueia só quem depende dela", async () => {
    const d = fontes(
      ["camara_cadastro", "camara_ceap", "senado_vot"],
      () => final("aprovada"),
      async (tarefa) => {
        if (tarefa === "camara_cadastro") throw new Error("HTTP 500: fora do ar");
        return pendentesDe([MAR])(tarefa);
      },
    );
    const r = await executarFontes(
      interpretarArgs(["camara_ceap", "camara_cadastro", "senado_vot", "--pendentes"]),
      d,
    );
    expect(r.map((x) => [x.tarefa, x.situacao])).toEqual([
      ["camara_cadastro", "rodou"],
      ["senado_vot", "rodou"],
      ["camara_ceap", "bloqueada"],
    ]);
    expect(r[0]).toMatchObject({ resultado: { parou: expect.stringMatching(/HTTP 500/) } });
    expect(r[2]).toMatchObject({ por: "camara_cadastro" });
    expect(d.chamadas.map((c) => c.tarefa)).toEqual(["senado_vot"]);
    expect(codigoDeSaidaDasFontes(r)).toBe(1);
  });

  it("com --todas, a tarefa sem o --param obrigatório é pulada e não pesa", async () => {
    const d = fontes(["senado_vot", "siconfi_relatorio"], () => final("aprovada"));
    const r = await executarFontes(interpretarArgs(["--todas", "--pendentes"]), d);
    expect(r.find((x) => x.tarefa === "siconfi_relatorio")).toEqual({
      tarefa: "siconfi_relatorio",
      situacao: "pulada",
      motivo: "exige --param codIbge, tipoRelatorio (não informado)",
    });
    expect(d.chamadas.every((c) => c.tarefa === "senado_vot")).toBe(true);
    expect(codigoDeSaidaDasFontes(r)).toBe(0);
    expect(resumoDasFontes(r)).toMatch(
      /siconfi_relatorio: pulada — exige --param codIbge, tipoRelatorio/,
    );
  });

  it("nada rodou (nenhuma tarefa com adaptador): sai com 1", async () => {
    const d = fontes([], () => final("aprovada"));
    const r = await executarFontes(interpretarArgs(["pncp", "--pendentes"]), d);
    expect(r).toEqual([{ tarefa: "pncp", situacao: "sem_adaptador" }]);
    expect(codigoDeSaidaDasFontes(r)).toBe(1);
  });
});

describe("importar/resumo final", () => {
  it("por fonte: janelas por estado, importados, findings e o detalhe das não aprovadas", () => {
    const desfecho = (
      janela: Janela,
      estado: EstadoConferencia,
      execucaoId: string,
      extra: Partial<{ erros: string[]; findingsNovos: number | null }> = {},
    ) => ({
      janela,
      veredito: { estado, motivo: `motivo ${estado}` },
      execucaoId,
      rodadas: 2,
      importados: { votacoes: 5, votos: 2000 },
      erros: [],
      findingsNovos: null,
      ...extra,
    });
    expect(
      resumoDasFontes([
        {
          tarefa: "camara_vot",
          situacao: "rodou",
          resultado: {
            desfechos: [
              desfecho(MAR, "aprovada", "e-1", { findingsNovos: 1 }),
              desfecho(FEV, "inconclusiva", "e-2"),
              desfecho(JAN, "reprovada", "e-3", { erros: ["HTTP 500 na votação 9"] }),
            ],
            parou: "Janela reprovada: a fonte camara_vot para aqui.",
          },
        },
        { tarefa: "pncp", situacao: "sem_adaptador" },
        { tarefa: "camara_ceap", situacao: "bloqueada", por: "camara_cadastro" },
      ]),
    ).toBe(
      [
        "camara_vot: 1 aprovada, 1 inconclusiva, 1 reprovada · importados: 15 votacoes, 6000 votos · findings novos: 1",
        "  inconclusiva 2024-02-01..2024-02-29 · execução e-2 · 2 rodada(s) · motivo inconclusiva",
        "  reprovada 2024-01-01..2024-01-31 · execução e-3 · 2 rodada(s) · motivo reprovada",
        "    erro: HTTP 500 na votação 9",
        "  parou: Janela reprovada: a fonte camara_vot para aqui.",
        "pncp: pulada — ainda sem adaptador no modo nomeado",
        "camara_ceap: pulada — depende de camara_cadastro, que parou",
      ].join("\n"),
    );
  });

  it("fonte sem janelas e sem regras de qualidade", () => {
    expect(
      resumoDasFontes([
        { tarefa: "senado_vot", situacao: "rodou", resultado: { desfechos: [], parou: null } },
      ]),
    ).toBe("senado_vot: nenhuma janela · importados: nada · findings novos: não se aplica");
  });
});

describe("importar/matérias e proposições por sigla", () => {
  it("sem --param, o intervalo vira uma janela por ano e sigla do painel", async () => {
    const p = await montarPlano("camara_props", interpretarArgs(["camara_props", "2024"]), vi.fn());
    expect(p.janelas.map((j) => j.escopo)).toEqual(["PL", "PEC", "PLP", "MPV", "PDL", "PRC"]);
    const d = deps(() => final("aprovada"));
    await executarPlano(p, d);
    expect(d.chamadas.map((c) => c.params)).toEqual(
      ["PL", "PEC", "PLP", "MPV", "PDL", "PRC"].map((siglaTipo) => ({ ano: 2024, siglaTipo })),
    );
  });

  it("com --param, só a sigla pedida", async () => {
    const args = interpretarArgs(["senado_mat", "2023..2024", "--param", "sigla=PEC"]);
    const p = await montarPlano("senado_mat", args, vi.fn());
    expect(p.janelas.map((j) => `${j.dataInicio.slice(0, 4)} ${j.escopo}`)).toEqual([
      "2024 PEC",
      "2023 PEC",
    ]);
  });

  it("meta: a sigla de cada pendente vai na janela; --param restringe a consulta", async () => {
    const consultar = vi.fn(async (tarefa: string) => ({
      consulta: "pendentes" as const,
      tarefa,
      janelas: ["PL", "PEC"].map((escopo) => ({
        ano: 2024,
        mes: 1,
        dataInicio: "2024-01-01",
        dataFim: "2024-12-31",
        escopo,
        ultima: null,
      })),
    }));
    const p = await montarPlano(
      "senado_mat",
      interpretarArgs(["senado_mat", "--pendentes"]),
      consultar,
    );
    expect(consultar).toHaveBeenCalledWith("senado_mat");
    const d = deps(() => final("aprovada"));
    await executarPlano(p, d);
    expect(d.chamadas.map((c) => c.params)).toEqual([
      { ano: 2024, sigla: "PL" },
      { ano: 2024, sigla: "PEC" },
    ]);

    await montarPlano(
      "senado_mat",
      interpretarArgs(["senado_mat", "--pendentes", "--param", "sigla=PEC"]),
      consultar,
    );
    expect(consultar).toHaveBeenLastCalledWith("senado_mat", { sigla: "PEC" });
  });
});
