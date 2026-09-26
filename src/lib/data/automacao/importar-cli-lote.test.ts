import { describe, expect, it, vi } from "vitest";
import type { Conferencia } from "./conferencia";
import {
  executarPlano,
  interpretarArgs,
  montarPlano,
  paramsDaJanela,
  type CorpoNomeado,
  type Dependencias,
  type RespostaRodada,
} from "./importar-cli";

// ---------------------------------------------------------------------------
// A ferramenta com os cadastros (senadores, trajetória dos deputados) e o
// SICONFI em lote (ano todo de um ente, varredura de um conjunto): parâmetros,
// janelas, o offset da trajetória devolvido rodada a rodada e as pendentes.
// ---------------------------------------------------------------------------

function resposta(parcial: Partial<RespostaRodada> = {}): RespostaRodada {
  return {
    importados: { deputados: 60 },
    erros: [],
    avisos: [],
    haMais: false,
    cursor: null,
    totalAcumulado: 60,
    parada: "fim",
    conferencia: null,
    ...parcial,
  };
}

const APROVADA = { estado: "aprovada", motivo: "ok" } as Conferencia;

function deps(
  roteiro: (corpo: CorpoNomeado, n: number) => RespostaRodada,
): Dependencias & { chamadas: CorpoNomeado[] } {
  const chamadas: CorpoNomeado[] = [];
  return {
    chamadas,
    chamar: async (corpo) => {
      // Guarda uma cópia: o corpo de cada rodada é o que foi mandado nela.
      chamadas.push(structuredClone(corpo));
      return roteiro(corpo, chamadas.length);
    },
    novoExecucaoId: () => "execucao-1",
    esperar: async () => {},
    log: () => {},
  };
}

const semPendentes = vi.fn();

describe("importar/cadastros e SICONFI em lote — argumentos", () => {
  it("os cadastros não têm intervalo", () => {
    expect(interpretarArgs(["senado_cadastro"]).tarefas).toEqual(["senado_cadastro"]);
    expect(interpretarArgs(["camara_trajetoria", "--param", "idLegislatura=56"])).toMatchObject({
      tarefas: ["camara_trajetoria"],
      params: { idLegislatura: "56" },
    });
  });

  it("o ano todo exige o ente; a varredura, o conjunto", () => {
    expect(() => interpretarArgs(["siconfi_ano", "2023"])).toThrow(/--param codIbge/);
    expect(() => interpretarArgs(["siconfi_varredura", "2023"])).toThrow(/--param conjunto/);
    expect(() => interpretarArgs(["siconfi_ano", "2023-03", "--param", "codIbge=35"])).toThrow(
      /AAAA/,
    );
  });

  it("cada tarefa recebe a janela no formato do seu schema", () => {
    const ano2023 = { dataInicio: "2023-01-01", dataFim: "2023-12-31" };
    const cadastro = { dataInicio: "", dataFim: "" };
    expect(paramsDaJanela("senado_cadastro", cadastro)).toEqual({});
    expect(paramsDaJanela("camara_trajetoria", cadastro)).toEqual({});
    expect(paramsDaJanela("camara_trajetoria", cadastro, {}, { idLegislatura: "56" })).toEqual({
      idLegislatura: 56,
    });
    expect(paramsDaJanela("siconfi_ano", ano2023, {}, { codIbge: "35" })).toEqual({
      codIbge: "35",
      exercicio: 2023,
    });
    expect(
      paramsDaJanela("siconfi_varredura", ano2023, {}, { conjunto: "municipios", uf: "AC" }),
    ).toEqual({ conjunto: "municipios", uf: "AC", exercicioInicial: 2023, exercicioFinal: 2023 });
  });
});

describe("importar/trajetória: o offset volta a cada rodada", () => {
  it("manda o cursor da rodada anterior em params.offset, até o fim", async () => {
    const p = await montarPlano(
      "camara_trajetoria",
      interpretarArgs(["camara_trajetoria", "--param", "idLegislatura=57"]),
      semPendentes,
    );
    const d = deps((_corpo, n) =>
      n < 3
        ? resposta({ haMais: true, cursor: n * 60, parada: "subrequisicoes" })
        : resposta({ cursor: 150, totalAcumulado: 150, conferencia: APROVADA }),
    );
    const r = await executarPlano(p, d);
    expect(d.chamadas.map((c) => c.params)).toEqual([
      { idLegislatura: 57 },
      { idLegislatura: 57, offset: 60 },
      { idLegislatura: 57, offset: 120 },
    ]);
    expect(r.desfechos[0].veredito.estado).toBe("aprovada");
  });

  it("a re-tentativa é uma execução nova, desde o começo", async () => {
    const p = await montarPlano(
      "camara_trajetoria",
      interpretarArgs(["camara_trajetoria"]),
      semPendentes,
    );
    const d = deps((_corpo, n) =>
      n === 1
        ? resposta({ haMais: true, cursor: 60, parada: "erro" })
        : resposta({ conferencia: APROVADA }),
    );
    await executarPlano(p, d);
    expect(d.chamadas.map((c) => c.params)).toEqual([{}, {}]);
  });

  it("as outras tarefas não recebem offset", async () => {
    const p = await montarPlano(
      "siconfi_ano",
      interpretarArgs(["siconfi_ano", "2023", "--param", "codIbge=35"]),
      semPendentes,
    );
    const d = deps((_corpo, n) =>
      n === 1
        ? resposta({ haMais: true, cursor: 7, parada: "tempo" })
        : resposta({ conferencia: APROVADA }),
    );
    await executarPlano(p, d);
    expect(d.chamadas.map((c) => c.params)).toEqual([
      { codIbge: "35", exercicio: 2023 },
      { codIbge: "35", exercicio: 2023 },
    ]);
  });
});

describe("importar/SICONFI em lote — pendentes", () => {
  const consultar = vi.fn(async (tarefa: string) => ({
    consulta: "pendentes" as const,
    tarefa,
    janelas: [
      { ano: 2023, mes: 0, dataInicio: "2023-01-01", dataFim: "2023-12-31", ultima: null },
      { ano: 2022, mes: 0, dataInicio: "2022-01-01", dataFim: "2022-12-31", ultima: null },
    ],
  }));

  it("a varredura consulta as pendentes do conjunto, e cada exercício vira uma janela", async () => {
    const args = interpretarArgs([
      "siconfi_varredura",
      "--pendentes",
      "2022",
      "--param",
      "conjunto=municipios",
      "--param",
      "uf=AC",
    ]);
    const p = await montarPlano("siconfi_varredura", args, consultar);
    expect(consultar).toHaveBeenCalledWith("siconfi_varredura", {
      conjunto: "municipios",
      uf: "AC",
    });
    expect(p.janelas).toEqual([
      { dataInicio: "2022-01-01", dataFim: "2022-12-31", reprocessar: false },
    ]);
  });

  it("o ano todo consulta as pendentes do ente", async () => {
    const args = interpretarArgs(["siconfi_ano", "--pendentes", "--param", "codIbge=35"]);
    const p = await montarPlano("siconfi_ano", args, consultar);
    expect(consultar).toHaveBeenCalledWith("siconfi_ano", { codIbge: "35" });
    expect(p.janelas).toHaveLength(2);
  });
});
