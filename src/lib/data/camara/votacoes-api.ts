/**
 * Contrato com a API de votações da Câmara (dadosabertos.camara.leg.br/api/v2),
 * isolado do servidor para ser testável.
 *
 * Dois comportamentos da API, observados em 2026-09-25, moldam este módulo:
 *
 * - `/votacoes/{id}/votos` NÃO pagina: responde 400 a `itens`/`pagina` e,
 *   sem eles, devolve todos os votos de uma vez (centenas numa resposta).
 * - A listagem `/votacoes` ordenada por `dataHoraRegistro` não é estável entre
 *   páginas: em março de 2003 vieram 440 linhas com 22 repetidas e 22
 *   faltando. Ordenada por `id` ASC vieram as 440 (o CSV em lote também tem
 *   440). Por isso a ordenação é sempre por id.
 */

export type VotacaoItem = {
  id: string;
  data?: string;
  dataHoraRegistro?: string;
  siglaOrgao?: string;
  descricao?: string;
  aprovacao?: number;
  proposicaoObjeto?: string;
};

export type VotoItem = {
  tipoVoto?: string;
  deputado_?: {
    id?: number;
    nome?: string;
    siglaPartido?: string;
    siglaUf?: string;
  };
};

export type BuscarCamara = <T>(path: string, params?: Record<string, string>) => Promise<T>;

export const ITENS_POR_PAGINA_VOTACOES = 100;

/** Parâmetros de uma página da listagem — ordenação estável por id. */
export function parametrosListaVotacoes(
  dataInicio: string,
  dataFim: string,
  pagina: number,
): Record<string, string> {
  return {
    dataInicio,
    dataFim,
    itens: String(ITENS_POR_PAGINA_VOTACOES),
    pagina: String(pagina),
    ordem: "ASC",
    ordenarPor: "id",
  };
}

/**
 * Lista as votações da janela, página a página, até uma página incompleta.
 * Devolve também quantas páginas custou (subrequisições). Ids repetidos são
 * descartados e a lista sai ordenada por id: a retomada da rodada usa a
 * posição na lista como cursor, e um item repetido deslocaria todos os
 * seguintes.
 */
export async function listarVotacoesDaJanela(
  buscar: BuscarCamara,
  janela: { dataInicio: string; dataFim: string; maxPaginas: number },
): Promise<{ lista: VotacaoItem[]; paginas: number }> {
  const porId = new Map<string, VotacaoItem>();
  let paginas = 0;
  for (let pagina = 1; pagina <= janela.maxPaginas; pagina++) {
    const json = await buscar<{ dados?: VotacaoItem[] }>(
      "/votacoes",
      parametrosListaVotacoes(janela.dataInicio, janela.dataFim, pagina),
    );
    paginas++;
    const arr = json.dados ?? [];
    for (const v of arr) if (!porId.has(v.id)) porId.set(v.id, v);
    if (arr.length < ITENS_POR_PAGINA_VOTACOES) break;
  }
  const lista = [...porId.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return { lista, paginas };
}

/** Todos os votos de uma votação numa única chamada, sem `itens`/`pagina`. */
export async function buscarVotosDaVotacao(buscar: BuscarCamara, id: string): Promise<VotoItem[]> {
  const json = await buscar<{ dados?: VotoItem[] }>(`/votacoes/${id}/votos`);
  return json.dados ?? [];
}

/** Placar sim / não / outros a partir do `tipoVoto` de cada voto. */
export function contarVotos(votos: readonly VotoItem[]): {
  sim: number;
  nao: number;
  outros: number;
} {
  const tally = { sim: 0, nao: 0, outros: 0 };
  for (const x of votos) {
    const t = (x.tipoVoto ?? "").toLowerCase();
    if (t.startsWith("sim")) tally.sim++;
    else if (t.startsWith("não") || t.startsWith("nao")) tally.nao++;
    else tally.outros++;
  }
  return tally;
}
