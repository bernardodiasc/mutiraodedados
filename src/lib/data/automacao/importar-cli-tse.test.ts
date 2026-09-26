import { describe, expect, it, vi } from "vitest";
import type { Conferencia, JanelaPendente } from "./conferencia";
import {
  executarPlano,
  interpretarArgs,
  montarPlano,
  paramsDaJanela,
  rotuloDaJanela,
  type CorpoNomeado,
  type Dependencias,
  type RespostaRodada,
} from "./importar-cli";

// ---------------------------------------------------------------------------
// A ferramenta com o TSE (arquivo tipo × ano × UF), o vínculo
// parlamentar↔candidato (offset devolvido rodada a rodada), os cruzamentos
// por eleição e o CSV da origem: janelas, parâmetros e pendentes.
// ---------------------------------------------------------------------------

function resposta(parcial: Partial<RespostaRodada> = {}): RespostaRodada {
  return {
    importados: { registros: 10 },
    erros: [],
    avisos: [],
    haMais: false,
    cursor: null,
    totalAcumulado: 10,
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
      chamadas.push(structuredClone(corpo));
      return roteiro(corpo, chamadas.length);
    },
    novoExecucaoId: () => "execucao-1",
    esperar: async () => {},
    log: () => {},
  };
}

const semPendentes = vi.fn();

describe("importar/TSE — arquivos", () => {
  it("o intervalo é por eleição e vira um arquivo por janela, candidatos primeiro", async () => {
    const p = await montarPlano(
      "tse_arquivo",
      interpretarArgs(["tse_arquivo", "2022", "--param", "uf=AC"]),
      semPendentes,
    );
    expect(p.janelas.map(rotuloDaJanela)).toEqual([
      "2022-01-01..2022-12-31 candidatos/AC",
      "2022-01-01..2022-12-31 bens/AC",
      "2022-01-01..2022-12-31 receitas/AC",
      "2022-01-01..2022-12-31 despesas/AC",
      "2022-01-01..2022-12-31 resultados/AC",
    ]);
    expect(paramsDaJanela("tse_arquivo", p.janelas[1])).toEqual({
      tipo: "bens",
      ano: 2022,
      uf: "AC",
    });
  });

  it("ano sem eleição fica de fora; da eleição mais recente para a mais antiga", async () => {
    const p = await montarPlano(
      "tse_arquivo",
      interpretarArgs(["tse_arquivo", "2021..2024", "--param", "tipo=candidatos"]),
      semPendentes,
    );
    const anos = [...new Set(p.janelas.map((j) => j.dataInicio.slice(0, 4)))];
    expect(anos).toEqual(["2024", "2022"]);
    // 2024 é municipal: sem "BR".
    expect(p.janelas.filter((j) => j.dataInicio.startsWith("2024"))).toHaveLength(27);
  });

  it("recusa intervalo mensal", () => {
    expect(() => interpretarArgs(["tse_arquivo", "2022-03"])).toThrow(/AAAA/);
  });

  it("as pendentes vêm da rota, com o tipo e a UF pedidos na consulta", async () => {
    const pendente: JanelaPendente = {
      ano: 2022,
      mes: 1,
      dataInicio: "2022-01-01",
      dataFim: "2022-12-31",
      escopo: "bens/SP",
      ultima: null,
    };
    const consultar = vi.fn().mockResolvedValue({
      consulta: "pendentes",
      tarefa: "tse_arquivo",
      janelas: [pendente],
    });
    const p = await montarPlano(
      "tse_arquivo",
      interpretarArgs(["tse_arquivo", "--pendentes", "--param", "tipo=bens", "--param", "uf=SP"]),
      consultar,
    );
    expect(consultar).toHaveBeenCalledWith("tse_arquivo", { tipo: "bens", uf: "SP" });
    expect(paramsDaJanela("tse_arquivo", p.janelas[0])).toEqual({
      tipo: "bens",
      ano: 2022,
      uf: "SP",
    });
  });
});

describe("importar/TSE — vínculo parlamentar↔candidato", () => {
  it("sem intervalo: uma janela por casa", async () => {
    const p = await montarPlano("tse_ponte", interpretarArgs(["tse_ponte"]), semPendentes);
    expect(p.janelas.map((j) => j.escopo)).toEqual(["camara", "senado"]);
    expect(paramsDaJanela("tse_ponte", p.janelas[1])).toEqual({ casa: "senado" });
  });

  it("manda o cursor da rodada anterior em params.offset, até o fim", async () => {
    const p = await montarPlano(
      "tse_ponte",
      interpretarArgs(["tse_ponte", "--param", "casa=camara"]),
      semPendentes,
    );
    const d = deps((_corpo, n) =>
      n < 3
        ? resposta({ haMais: true, cursor: n * 40, parada: "subrequisicoes" })
        : resposta({ cursor: 100, totalAcumulado: 100, conferencia: APROVADA }),
    );
    const r = await executarPlano(p, d);
    expect(d.chamadas.map((c) => c.params)).toEqual([
      { casa: "camara" },
      { casa: "camara", offset: 40 },
      { casa: "camara", offset: 80 },
    ]);
    expect(r.desfechos[0].veredito.estado).toBe("aprovada");
  });
});

describe("importar/cruzamentos e CSV da origem", () => {
  it("os cruzamentos são por eleição; anos sem eleição ficam de fora", async () => {
    for (const tarefa of ["tse_lacunas", "tse_sinais", "cruzamento_doador_fornecedor"]) {
      const p = await montarPlano(tarefa, interpretarArgs([tarefa, "2021..2022"]), semPendentes);
      expect(p.janelas.map((j) => paramsDaJanela(tarefa, j))).toEqual([{ ano: 2022 }]);
    }
  });

  it("o CSV da origem é uma janela só, sem intervalo", async () => {
    const p = await montarPlano(
      "convenios_origem",
      interpretarArgs(["convenios_origem"]),
      semPendentes,
    );
    expect(p.janelas).toEqual([{ dataInicio: "", dataFim: "" }]);
    expect(paramsDaJanela("convenios_origem", p.janelas[0])).toEqual({});
  });
});
