import { describe, it, expect, vi } from "vitest";
import {
  ITENS_POR_PAGINA_VOTACOES,
  buscarVotosDaVotacao,
  contarVotos,
  listarVotacoesDaJanela,
  parametrosListaVotacoes,
  type BuscarCamara,
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
    return { dados: todas.slice((pagina - 1) * itens, pagina * itens) };
  }) as unknown as BuscarCamara;
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
    const { lista, paginas } = await listarVotacoesDaJanela(buscar, janela);
    expect(lista).toHaveLength(440);
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
    expect(await listarVotacoesDaJanela(buscar, janela)).toEqual({ lista: [], paginas: 1 });
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
