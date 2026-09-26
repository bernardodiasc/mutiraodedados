import { describe, expect, it, vi } from "vitest";
import type { Conferencia, EstadoConferencia } from "./conferencia";
import {
  codigoDeSaida,
  codigoDeSaidaDasFontes,
  corpoDasPendentes,
  executarFontes,
  executarPlano,
  interpretarArgs,
  janelasDasPendentes,
  janelasDoIntervalo,
  montarPlano,
  paramsDaJanela,
  resumoDasFontes,
  type CorpoNomeado,
  type Dependencias,
  type Plano,
  type RespostaRodada,
} from "./importar-cli";
import { SAIDA_COTA_DO_PORTAL, esbarrouNaCota } from "./cota-do-portal";

// ---------------------------------------------------------------------------
// A ferramenta com as fontes da API do Portal da Transparência: recorte
// (órgão, ente), janela anual das emendas e a pausa pela cota da chave.
// ---------------------------------------------------------------------------

const MAR = { dataInicio: "2024-03-01", dataFim: "2024-03-31" };
const FEV = { dataInicio: "2024-02-01", dataFim: "2024-02-29" };

function resposta(parcial: Partial<RespostaRodada> = {}): RespostaRodada {
  return {
    importados: { licitacoes: 15 },
    erros: [],
    avisos: [],
    haMais: false,
    cursor: 1,
    totalAcumulado: 15,
    parada: "fim",
    conferencia: null,
    ...parcial,
  };
}

const final = (estado: EstadoConferencia) =>
  resposta({ conferencia: { estado, motivo: estado } as Conferencia });

const COTA = resposta({
  haMais: true,
  parada: "erro",
  erros: ["p3: TRANSIENT: Portal 429 (serviço indisponível)"],
});

function deps(roteiro: (c: CorpoNomeado) => RespostaRodada) {
  const chamadas: CorpoNomeado[] = [];
  const esperas: number[] = [];
  let n = 0;
  const d: Dependencias = {
    chamar: async (c) => {
      chamadas.push(c);
      return roteiro(c);
    },
    novoExecucaoId: () => `execucao-${++n}`,
    esperar: async (ms) => {
      esperas.push(ms);
    },
    log: () => {},
  };
  return { ...d, chamadas, esperas };
}

/** Dependências de `executarFontes`: todas as tarefas com adaptador, pendentes vazias. */
function depsDasFontes(roteiro: (c: CorpoNomeado) => RespostaRodada) {
  const d = deps(roteiro);
  const consultas: [string, Record<string, unknown> | undefined][] = [];
  const logs: string[] = [];
  return {
    ...d,
    consultas,
    logs,
    log: (l: string) => logs.push(l),
    temAdaptador: (t: string) =>
      [
        "camara_vot",
        "senado_vot",
        "cgu_siafi",
        "cgu_atividade",
        "cgu_contratos",
        "cgu_licitacoes",
        "cgu_emendas",
        "transferegov",
      ].includes(t),
    consultarPendentes: async (tarefa: string, params?: Record<string, unknown>) => {
      consultas.push([tarefa, params]);
      return { consulta: "pendentes" as const, tarefa, janelas: [] };
    },
  };
}

describe("importar/recorte", () => {
  it("--orgao vira codigoOrgao nas licitações, junto das datas do Portal", () => {
    const args = interpretarArgs(["cgu_licitacoes", "2024-03", "--orgao", "26000"]);
    expect(args.recorte).toEqual({ orgao: "26000" });
    expect(paramsDaJanela("cgu_licitacoes", MAR, args.recorte)).toEqual({
      codigoOrgao: "26000",
      dataInicial: "2024-03-01",
      dataFinal: "2024-03-31",
    });
  });

  it("--uf e --municipio viram o ente dos convênios; sem ente, o mês do país", () => {
    expect(paramsDaJanela("transferegov", MAR, { uf: "35" })).toEqual({
      dataInicial: "2024-03-01",
      dataFinal: "2024-03-31",
      codigoUF: "35",
    });
    expect(paramsDaJanela("transferegov", MAR, { municipio: "3550308" })).toMatchObject({
      codigoIbgeMunicipio: "3550308",
    });
    expect(paramsDaJanela("transferegov", MAR)).toEqual({
      dataInicial: "2024-03-01",
      dataFinal: "2024-03-31",
    });
  });

  it("sem recorte, os argumentos não ganham o campo", () => {
    expect(interpretarArgs(["camara_vot", "2024-03"])).not.toHaveProperty("recorte");
  });

  it("recusa: opção sem valor, opção que nenhuma tarefa pedida aceita, UF e município juntos", () => {
    expect(() => interpretarArgs(["cgu_licitacoes", "2024-03", "--orgao"])).toThrow(/código/);
    expect(() => interpretarArgs(["camara_vot", "2024-03", "--orgao", "26000"])).toThrow(
      /--orgao só vale para cgu_contratos, cgu_licitacoes/,
    );
    expect(() =>
      interpretarArgs(["transferegov", "2024-03", "--uf", "35", "--municipio", "3550308"]),
    ).toThrow(/não os dois/);
  });

  it("licitações pedidas pelo nome sem --orgao é erro de uso", () => {
    expect(() => interpretarArgs(["cgu_licitacoes", "2024-03"])).toThrow(
      /cgu_licitacoes exige --orgao/,
    );
  });

  it("com várias fontes, cada opção vale para a tarefa que a aceita e as outras a ignoram", () => {
    const args = interpretarArgs(["camara_vot", "cgu_licitacoes", "2024-03", "--orgao", "26000"]);
    expect(args.tarefas).toEqual(["camara_vot", "cgu_licitacoes"]);
    expect(args.recorte).toEqual({ orgao: "26000" });
  });

  it("o plano leva o recorte a cada janela; a tarefa sem recorte não o recebe", async () => {
    const args = interpretarArgs([
      "camara_vot",
      "cgu_licitacoes",
      "2024-02..2024-03",
      "--orgao",
      "26000",
    ]);
    const plano = await montarPlano("cgu_licitacoes", args, vi.fn());
    const d = deps(() => final("aprovada"));
    await executarPlano(plano, d);
    expect(d.chamadas.map((c) => c.params)).toEqual([
      { codigoOrgao: "26000", dataInicial: "2024-03-01", dataFinal: "2024-03-31" },
      { codigoOrgao: "26000", dataInicial: "2024-02-01", dataFinal: "2024-02-29" },
    ]);
    expect(await montarPlano("camara_vot", args, vi.fn())).not.toHaveProperty("recorte");
  });

  it("pendentes da tarefa com recorte levam os parâmetros dele na consulta", async () => {
    const consultar = vi.fn(async (tarefa: string) => ({
      consulta: "pendentes" as const,
      tarefa,
      janelas: [{ ano: 2024, mes: 3, ...MAR, ultima: null }],
    }));
    const args = interpretarArgs(["cgu_licitacoes", "--pendentes", "--orgao", "26000"]);
    const plano = await montarPlano("cgu_licitacoes", args, consultar);
    expect(consultar).toHaveBeenCalledWith("cgu_licitacoes", { codigoOrgao: "26000" });
    expect(plano.recorte).toEqual({ orgao: "26000" });
    expect(corpoDasPendentes("cgu_licitacoes", { codigoOrgao: "26000" })).toEqual({
      consulta: "pendentes",
      tarefa: "cgu_licitacoes",
      params: { codigoOrgao: "26000" },
    });
    expect(corpoDasPendentes("camara_vot")).toEqual({
      consulta: "pendentes",
      tarefa: "camara_vot",
    });
  });

  it("--todas --pendentes sem --orgao: as tarefas por órgão pedem as pendentes dos órgãos ativos", async () => {
    const d = depsDasFontes(() => final("aprovada"));
    const desfechos = await executarFontes(interpretarArgs(["--todas", "--pendentes"]), d);
    expect(d.consultas).toContainEqual(["cgu_licitacoes", undefined]);
    expect(d.consultas).toContainEqual(["cgu_contratos", undefined]);
    expect(desfechos).toContainEqual(
      expect.objectContaining({ tarefa: "cgu_contratos", situacao: "rodou" }),
    );
    expect(codigoDeSaidaDasFontes(desfechos)).toBe(0);
  });

  it("--todas com intervalo e sem --orgao: as tarefas por órgão são puladas com o motivo", async () => {
    const d = depsDasFontes(() => final("aprovada"));
    const desfechos = await executarFontes(interpretarArgs(["--todas", "2024"]), d);
    expect(desfechos).toContainEqual({
      tarefa: "cgu_licitacoes",
      situacao: "pulada",
      motivo:
        "exige --orgao (ou --pendentes, que percorre os órgãos ativos do catálogo) (não informado)",
    });
    expect(d.chamadas.filter((c) => c.tarefa === "cgu_contratos")).toHaveLength(0);
    expect(resumoDasFontes(desfechos)).toMatch(/cgu_contratos: pulada — exige --orgao/);
  });

  it("--todas com --uf: só os convênios por ente consultam as pendentes com o ente", async () => {
    const d = depsDasFontes(() => final("aprovada"));
    await executarFontes(interpretarArgs(["--todas", "--pendentes", "--uf", "35"]), d);
    expect(d.consultas).toContainEqual(["transferegov", { codigoUF: "35" }]);
    expect(d.consultas).toContainEqual(["camara_vot", undefined]);
  });
});

describe("importar/CGU por órgão: contratos, catálogo e atividade", () => {
  it("--orgao com lista: uma janela por mês e órgão, do mês mais recente, órgão no escopo", async () => {
    const args = interpretarArgs(["cgu_contratos", "2024-02..2024-03", "--orgao", "26000,36000"]);
    const plano = await montarPlano("cgu_contratos", args, vi.fn());
    expect(plano.janelas).toEqual([
      { ...MAR, escopo: "26000" },
      { ...MAR, escopo: "36000" },
      { ...FEV, escopo: "26000" },
      { ...FEV, escopo: "36000" },
    ]);
    const d = deps(() => final("aprovada"));
    await executarPlano(plano, d);
    expect(d.chamadas.map((c) => [c.tarefa, c.params])).toEqual([
      [
        "cgu_contratos",
        { codigoOrgao: "26000", dataInicial: "2024-03-01", dataFinal: "2024-03-31" },
      ],
      [
        "cgu_contratos",
        { codigoOrgao: "36000", dataInicial: "2024-03-01", dataFinal: "2024-03-31" },
      ],
      [
        "cgu_contratos",
        { codigoOrgao: "26000", dataInicial: "2024-02-01", dataFinal: "2024-02-29" },
      ],
      [
        "cgu_contratos",
        { codigoOrgao: "36000", dataInicial: "2024-02-01", dataFinal: "2024-02-29" },
      ],
    ]);
  });

  it("pendentes com lista de órgãos mandam a lista; com um só, o código", async () => {
    const consultar = vi.fn(async (tarefa: string) => ({
      consulta: "pendentes" as const,
      tarefa,
      janelas: [],
    }));
    await montarPlano(
      "cgu_contratos",
      interpretarArgs(["cgu_contratos", "--pendentes", "--orgao", "26000,36000"]),
      consultar,
    );
    expect(consultar).toHaveBeenLastCalledWith("cgu_contratos", {
      codigosOrgao: ["26000", "36000"],
    });
    await montarPlano(
      "cgu_contratos",
      interpretarArgs(["cgu_contratos", "--pendentes", "--orgao", "26000"]),
      consultar,
    );
    expect(consultar).toHaveBeenLastCalledWith("cgu_contratos", { codigoOrgao: "26000" });
  });

  it("pendentes sem --orgao: o órgão de cada janela vem da rota (órgãos ativos do catálogo)", async () => {
    const consultar = vi.fn(async (tarefa: string) => ({
      consulta: "pendentes" as const,
      tarefa,
      janelas: [
        { ano: 2024, mes: 3, ...MAR, escopo: "36000", ultima: null },
        {
          ano: 2024,
          mes: 3,
          ...MAR,
          escopo: "26000",
          ultima: {
            estado: "reprovada" as const,
            motivo: "x",
            execucao_id: null,
            consultado_em: "2024-04-01",
          },
        },
      ],
    }));
    const plano = await montarPlano(
      "cgu_contratos",
      interpretarArgs(["cgu_contratos", "--pendentes"]),
      consultar,
    );
    expect(consultar).toHaveBeenCalledWith("cgu_contratos");
    const d = deps(() => final("aprovada"));
    await executarPlano(plano, d);
    expect(d.chamadas.map((c) => [c.params.codigoOrgao, c.reprocessar])).toEqual([
      ["36000", false],
      ["26000", true],
    ]);
  });

  it("contratos pedidos pelo nome com intervalo exigem --orgao; com --pendentes, não", () => {
    expect(() => interpretarArgs(["cgu_contratos", "2024-03"])).toThrow(
      /cgu_contratos exige --orgao/,
    );
    expect(interpretarArgs(["cgu_contratos", "--pendentes"]).tarefas).toEqual(["cgu_contratos"]);
    expect(() => interpretarArgs(["cgu_contratos", "2024-03", "--orgao", "26000,MEC"])).toThrow(
      /código de órgão inválido: "MEC"/,
    );
  });

  it("catálogo e atividade são cadastros: sem intervalo, corpo vazio, na ordem da tabela", async () => {
    const args = interpretarArgs(["cgu_atividade", "cgu_siafi"]);
    expect(args.tarefas).toEqual(["cgu_siafi", "cgu_atividade"]);
    const plano = await montarPlano("cgu_siafi", args, vi.fn());
    expect(plano.janelas).toEqual([{ dataInicio: "", dataFim: "" }]);
    expect(paramsDaJanela("cgu_siafi", plano.janelas[0])).toEqual({});
    expect(paramsDaJanela("cgu_atividade", plano.janelas[0])).toEqual({});
  });

  it("a cota do Portal também pausa contratos, catálogo e atividade", () => {
    for (const t of ["cgu_contratos", "cgu_siafi", "cgu_atividade"]) {
      expect(esbarrouNaCota(t, [COTA])).toBe(true);
    }
  });

  it("catálogo reprovado bloqueia a atividade e as tarefas por órgão; as demais seguem", async () => {
    const d = depsDasFontes((c) =>
      c.tarefa === "cgu_siafi" ? final("reprovada") : final("aprovada"),
    );
    const desfechos = await executarFontes(
      interpretarArgs([
        "cgu_siafi",
        "cgu_atividade",
        "cgu_contratos",
        "cgu_emendas",
        "--pendentes",
      ]),
      {
        ...d,
        consultarPendentes: async (tarefa: string) => ({
          consulta: "pendentes" as const,
          tarefa,
          janelas: [
            tarefa === "cgu_emendas"
              ? { ano: 2023, mes: 1, dataInicio: "2023-01-01", dataFim: "2023-12-31", ultima: null }
              : { ano: 0, mes: 0, dataInicio: "", dataFim: "", ultima: null },
          ],
        }),
      },
    );
    expect(desfechos.map((x) => [x.tarefa, x.situacao])).toEqual([
      ["cgu_siafi", "rodou"],
      ["cgu_atividade", "bloqueada"],
      ["cgu_contratos", "bloqueada"],
      ["cgu_emendas", "rodou"],
    ]);
  });
});

describe("importar/emendas por ano", () => {
  it("o intervalo vira uma janela por ano, da mais recente para a mais antiga", () => {
    expect(janelasDoIntervalo("2022..2023", "ano")).toEqual([
      { dataInicio: "2023-01-01", dataFim: "2023-12-31" },
      { dataInicio: "2022-01-01", dataFim: "2022-12-31" },
    ]);
    expect(() => janelasDoIntervalo("2023-03", "ano")).toThrow(/AAAA ou AAAA\.\.AAAA/);
    expect(() => janelasDoIntervalo("2024..2023", "ano")).toThrow(/invertido/);
  });

  it("cada janela manda só o ano", async () => {
    const plano = await montarPlano(
      "cgu_emendas",
      interpretarArgs(["cgu_emendas", "2023"]),
      vi.fn(),
    );
    const d = deps(() => final("aprovada"));
    await executarPlano(plano, d);
    expect(d.chamadas.map((c) => c.params)).toEqual([{ ano: 2023 }]);
  });

  it("pendentes anuais restritas a um intervalo de anos", () => {
    const pendente = (ano: number) => ({
      ano,
      mes: 1,
      dataInicio: `${ano}-01-01`,
      dataFim: `${ano}-12-31`,
      ultima: null,
    });
    expect(
      janelasDasPendentes([2024, 2023, 2022].map(pendente), "2023", "ano").map((j) => j.dataInicio),
    ).toEqual(["2023-01-01"]);
  });
});

describe("importar/cota da chave do Portal", () => {
  const plano = (parcial: Partial<Plano> = {}): Plano => ({
    tarefa: "cgu_licitacoes",
    janelas: [MAR, FEV],
    reprocessar: false,
    tetoRodadas: 5,
    recorte: { orgao: "26000" },
    ...parcial,
  });

  it("429 persistente: para a fonte sem re-tentar nem seguir, e sai com o código da pausa", async () => {
    const d = deps(() => COTA);
    const r = await executarPlano(plano(), d);
    expect(d.chamadas).toHaveLength(1);
    expect(d.esperas).toEqual([]);
    expect(r.desfechos).toHaveLength(1);
    expect(r.desfechos[0]).toMatchObject({
      janela: MAR,
      veredito: {
        estado: "inconclusiva",
        motivo: expect.stringMatching(/cota/),
        cotaDoPortal: true,
      },
    });
    expect(r.cotaDoPortal).toBe(true);
    expect(r.parou).toMatch(/cgu_licitacoes, cgu_emendas, convenios, transferegov/);
    expect(codigoDeSaida(r)).toBe(SAIDA_COTA_DO_PORTAL);
  });

  it("outra falha passageira segue a política das inconclusivas", async () => {
    const d = deps(() =>
      resposta({ haMais: true, parada: "erro", erros: ["p1: TRANSIENT: Portal 503"] }),
    );
    const r = await executarPlano(plano(), d);
    expect(d.esperas.length).toBeGreaterThan(0);
    expect(r.cotaDoPortal).toBeUndefined();
  });

  it("só vale para as fontes da chave, e só em rodada interrompida", () => {
    expect(esbarrouNaCota("cgu_emendas", [COTA])).toBe(true);
    expect(esbarrouNaCota("camara_vot", [COTA])).toBe(false);
    expect(esbarrouNaCota("transferegov", [{ ...COTA, parada: "fim" }])).toBe(false);
  });

  it("com várias fontes, pula as seguintes da chave, segue as outras e sai com 3", async () => {
    // Na ordem da tabela: votações (fora da chave) rodam; transferegov
    // esbarra na cota; as emendas, da mesma chave, são puladas.
    const d = depsDasFontes((c) => (c.tarefa === "transferegov" ? COTA : final("aprovada")));
    const desfechos = await executarFontes(
      interpretarArgs(["camara_vot", "transferegov", "cgu_emendas", "2023"]),
      d,
    );
    expect(desfechos.map((x) => [x.tarefa, x.situacao])).toEqual([
      ["camara_vot", "rodou"],
      ["transferegov", "rodou"],
      ["cgu_emendas", "pulada"],
    ]);
    expect(desfechos[2]).toMatchObject({
      motivo: "cota da chave do Portal esgotada em transferegov",
    });
    expect(d.chamadas.filter((c) => c.tarefa === "cgu_emendas")).toHaveLength(0);
    expect(resumoDasFontes(desfechos)).toMatch(
      /cgu_emendas: pulada — cota da chave do Portal esgotada em transferegov/,
    );
    expect(codigoDeSaidaDasFontes(desfechos)).toBe(SAIDA_COTA_DO_PORTAL);
  });
});
