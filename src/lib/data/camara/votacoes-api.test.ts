import { describe, it, expect, vi } from "vitest";
import {
  ErroApiCamara,
  ITENS_POR_PAGINA_VOTACOES,
  avisoDeVotacaoDescartada,
  contarDescartes,
  detalheInexistenteNaOrigem,
  buscarVotosDaVotacao,
  contarVotos,
  listarVotacoesDaJanela,
  parametrosListaVotacoes,
  totalDasVotacoesDaJanela,
  totalDoHeader,
  type BuscarCamara,
  type BuscarCamaraComTotal,
  type VotacaoItem,
} from "./votacoes-api";

const janela = { dataInicio: "2003-03-01", dataFim: "2003-03-31", maxPaginas: 50 };

/** Simula a listagem paginada da Câmara sobre uma lista fixa. */
function apiComLista(todas: VotacaoItem[]) {
  const chamadas: Array<Record<string, string> | undefined> = [];
  const buscar = vi.fn(async (_path: string, params?: Record<string, string>) => {
    chamadas.push(params);
    const pagina = Number(params?.pagina ?? 1);
    const itens = Number(params?.itens ?? ITENS_POR_PAGINA_VOTACOES);
    return {
      corpo: { dados: todas.slice((pagina - 1) * itens, pagina * itens) },
      totalOrigem: todas.length,
    };
  }) as unknown as BuscarCamaraComTotal;
  return { buscar, chamadas };
}

const votacoes = (n: number): VotacaoItem[] =>
  Array.from({ length: n }, (_, i) => ({ id: `102569-${String(i + 1).padStart(4, "0")}` }));

describe("camara/votacoes-api/parametros da lista", () => {
  it("ordena por id ASC — a ordem por data/hora perdia e repetia itens", () => {
    const p = parametrosListaVotacoes("2003-03-01", "2003-03-31", 3);
    expect(p.ordenarPor).toBe("id");
    expect(p.ordem).toBe("ASC");
    expect(p.pagina).toBe("3");
    expect(p.itens).toBe(String(ITENS_POR_PAGINA_VOTACOES));
    expect(p).toMatchObject({ dataInicio: "2003-03-01", dataFim: "2003-03-31" });
  });
});

describe("camara/votacoes-api/paginação da lista", () => {
  it("traz as 440 votações de março de 2003 em 5 páginas", async () => {
    const { buscar, chamadas } = apiComLista(votacoes(440));
    const { lista, paginas, totalOrigem } = await listarVotacoesDaJanela(buscar, janela);
    expect(lista).toHaveLength(440);
    expect(totalOrigem).toBe(440);
    expect(new Set(lista.map((v) => v.id)).size).toBe(440);
    expect(paginas).toBe(5);
    expect(chamadas.map((c) => c?.pagina)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("página cheia seguida de vazia: busca a vazia e para", async () => {
    const { buscar } = apiComLista(votacoes(200));
    const { lista, paginas } = await listarVotacoesDaJanela(buscar, janela);
    expect(lista).toHaveLength(200);
    expect(paginas).toBe(3);
  });

  it("janela sem votações devolve lista vazia com o custo de 1 página", async () => {
    const { buscar } = apiComLista([]);
    expect(await listarVotacoesDaJanela(buscar, janela)).toEqual({
      lista: [],
      paginas: 1,
      totalOrigem: 0,
    });
  });

  it("respeita maxPaginas", async () => {
    const { buscar } = apiComLista(votacoes(440));
    const { lista, paginas } = await listarVotacoesDaJanela(buscar, { ...janela, maxPaginas: 2 });
    expect(paginas).toBe(2);
    expect(lista).toHaveLength(200);
  });

  it("descarta id repetido entre páginas, para o cursor não deslocar", async () => {
    const base = votacoes(150);
    // Página 2 repete o último item da página 1 (o sintoma da ordem instável).
    const comRepetido = [...base.slice(0, 100), base[99], ...base.slice(100)];
    const { buscar } = apiComLista(comRepetido);
    const { lista } = await listarVotacoesDaJanela(buscar, janela);
    expect(lista.map((v) => v.id)).toEqual(base.map((v) => v.id));
  });

  it("sai ordenada por id mesmo se a API devolver fora de ordem", async () => {
    const { buscar } = apiComLista([{ id: "300-2" }, { id: "100-1" }, { id: "200-9" }]);
    const { lista } = await listarVotacoesDaJanela(buscar, janela);
    expect(lista.map((v) => v.id)).toEqual(["100-1", "200-9", "300-2"]);
  });
});

describe("camara/votacoes-api/total da origem", () => {
  it("uma chamada só, com um item, basta para ler o total", async () => {
    const { buscar, chamadas } = apiComLista(votacoes(819));
    expect(await totalDasVotacoesDaJanela(buscar, janela)).toBe(819);
    expect(chamadas).toEqual([
      { ...parametrosListaVotacoes("2003-03-01", "2003-03-31", 1), itens: "1" },
    ]);
  });

  it("lê o X-Total-Count", () => {
    expect(totalDoHeader("819")).toBe(819);
    expect(totalDoHeader(" 0 ")).toBe(0);
  });

  it("header ausente ou estranho vira null", () => {
    expect(totalDoHeader(null)).toBeNull();
    expect(totalDoHeader("")).toBeNull();
    expect(totalDoHeader("abc")).toBeNull();
  });
});

describe("camara/votacoes-api/votos", () => {
  it("busca todos os votos numa chamada só, sem itens/pagina (a API responde 400)", async () => {
    const dados = Array.from({ length: 503 }, (_, i) => ({
      tipoVoto: "Sim",
      deputado_: { id: i + 1 },
    }));
    const buscar = vi.fn(async () => ({ dados })) as unknown as BuscarCamara;
    const votos = await buscarVotosDaVotacao(buscar, "2301683-33");
    expect(votos).toHaveLength(503);
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(buscar).toHaveBeenCalledWith("/votacoes/2301683-33/votos");
  });

  it("votação simbólica (sem votos nominais) devolve lista vazia", async () => {
    const buscar = vi.fn(async () => ({ dados: [] })) as unknown as BuscarCamara;
    expect(await buscarVotosDaVotacao(buscar, "2077748-103")).toEqual([]);
  });
});

describe("camara/votacoes-api/placar", () => {
  it("conta sim, não (com e sem acento) e outros", () => {
    expect(
      contarVotos([
        { tipoVoto: "Sim" },
        { tipoVoto: "Não" },
        { tipoVoto: "Nao" },
        { tipoVoto: "Abstenção" },
        { tipoVoto: "Obstrução" },
        {},
      ]),
    ).toEqual({ sim: 1, nao: 2, outros: 3 });
  });
});

describe("camara/votacoes-api/detalhe que a origem lista mas não tem", () => {
  it("404 da API é recurso inexistente na origem", () => {
    expect(detalheInexistenteNaOrigem(new ErroApiCamara(404, "Câmara API 404: x"))).toBe(true);
  });

  it("outros status e erros sem status não são", () => {
    expect(detalheInexistenteNaOrigem(new ErroApiCamara(400, "Câmara API 400: x"))).toBe(false);
    expect(detalheInexistenteNaOrigem(new ErroApiCamara(503, "TRANSIENT: Câmara API 503"))).toBe(
      false,
    );
    expect(detalheInexistenteNaOrigem(new Error("Câmara API 404: x"))).toBe(false);
  });

  it("o erro guarda a mensagem, que vai para o log como antes", () => {
    expect(new ErroApiCamara(404, "Câmara API 404: Recurso").message).toBe(
      "Câmara API 404: Recurso",
    );
  });

  it("o descarte vira aviso `info:`, com o id da votação", () => {
    const aviso = avisoDeVotacaoDescartada("2024320-94");
    expect(aviso.startsWith("info:")).toBe(true);
    expect(aviso).toContain("2024320-94");
  });

  it("descarte é votação sinalizada que não está no cache", () => {
    expect(contarDescartes(["a", "b", "c"], [])).toBe(3);
    // A origem voltou a ter o detalhe e a votação foi importada: não é mais descarte.
    expect(contarDescartes(["a", "b", "c"], ["b"])).toBe(2);
    expect(contarDescartes(["a", "a"], [])).toBe(1);
    expect(contarDescartes([], ["x"])).toBe(0);
  });
});
