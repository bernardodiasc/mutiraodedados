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

/**
 * GET que devolve também o total da consulta, informado pela Câmara no header
 * `X-Total-Count` (`null` quando o header não vem).
 */
export type BuscarCamaraComTotal = <T>(
  path: string,
  params?: Record<string, string>,
) => Promise<{ corpo: T; totalOrigem: number | null }>;

/** Lê o header `X-Total-Count`; `null` se ausente ou não numérico. */
export function totalDoHeader(valor: string | null): number | null {
  if (valor == null || !/^\d+$/.test(valor.trim())) return null;
  return Number(valor);
}

export const ITENS_POR_PAGINA_VOTACOES = 100;

/**
 * Votações processadas ao mesmo tempo numa rodada. O tempo de uma votação é
 * quase todo espera pela API (~0,55 s por votação em sequência), então rodar
 * várias juntas multiplica o que cabe nos 150 s. A API da Câmara não publica
 * cota, e 429/5xx já passam pela política de retry. O Worker abre até 6
 * conexões simultâneas: 5 votações (cada uma faz uma chamada por vez) deixam
 * uma conexão para o checkpoint e as gravações que não esperam na fila.
 */
export const PARALELISMO_VOTACOES_CAMARA = 5;

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
 * Devolve também quantas páginas custou (subrequisições) e o total que a
 * Câmara informa para a consulta (da primeira página), que a conferência da
 * janela compara com o importado. Ids repetidos são
 * descartados e a lista sai ordenada por id: a retomada da rodada usa a
 * posição na lista como cursor, e um item repetido deslocaria todos os
 * seguintes.
 */
export async function listarVotacoesDaJanela(
  buscar: BuscarCamaraComTotal,
  janela: { dataInicio: string; dataFim: string; maxPaginas: number },
): Promise<{ lista: VotacaoItem[]; paginas: number; totalOrigem: number | null }> {
  const porId = new Map<string, VotacaoItem>();
  let paginas = 0;
  let totalOrigem: number | null = null;
  for (let pagina = 1; pagina <= janela.maxPaginas; pagina++) {
    const { corpo, totalOrigem: total } = await buscar<{ dados?: VotacaoItem[] }>(
      "/votacoes",
      parametrosListaVotacoes(janela.dataInicio, janela.dataFim, pagina),
    );
    if (pagina === 1) totalOrigem = total;
    paginas++;
    const arr = corpo.dados ?? [];
    for (const v of arr) if (!porId.has(v.id)) porId.set(v.id, v);
    if (arr.length < ITENS_POR_PAGINA_VOTACOES) break;
  }
  const lista = [...porId.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return { lista, paginas, totalOrigem };
}

/**
 * Só o total de votações da janela, sem baixar a lista: uma página de um
 * item, lendo o `X-Total-Count`. É o que a conferência de uma janela já
 * completa usa para comparar sem reimportar.
 */
export async function totalDasVotacoesDaJanela(
  buscar: BuscarCamaraComTotal,
  janela: { dataInicio: string; dataFim: string },
): Promise<number | null> {
  const { totalOrigem } = await buscar("/votacoes", {
    ...parametrosListaVotacoes(janela.dataInicio, janela.dataFim, 1),
    itens: "1",
  });
  return totalOrigem;
}

/** Todos os votos de uma votação numa única chamada, sem `itens`/`pagina`. */
export async function buscarVotosDaVotacao(buscar: BuscarCamara, id: string): Promise<VotoItem[]> {
  const json = await buscar<{ dados?: VotoItem[] }>(`/votacoes/${id}/votos`);
  return json.dados ?? [];
}

/** Resposta de erro da API da Câmara, com o status HTTP. */
export class ErroApiCamara extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ErroApiCamara";
  }
}

/**
 * O detalhe de uma votação que a própria listagem trouxe responde 404: a
 * origem lista um registro que não tem. Observado em julho de 2026: quatro
 * votações listadas com a URI do próprio detalhe, e o detalhe e os votos em
 * 404 — o id que chamamos é o da listagem. Inconsistência da origem, não erro
 * nosso.
 */
export function detalheInexistenteNaOrigem(erro: unknown): boolean {
  return erro instanceof ErroApiCamara && erro.status === 404;
}

/** Aviso da votação descartada, para o log da rodada. */
export function avisoDeVotacaoDescartada(id: string): string {
  return `info: vot ${id} descartada: a Câmara lista a votação, mas o detalhe responde 404 (inconsistência da origem, registrada como alerta de qualidade).`;
}

/**
 * Descartes da janela: as votações sinalizadas como listadas sem detalhe que
 * não estão no cache. A que voltou a ter detalhe e foi importada deixa de
 * contar — senão entraria duas vezes na conta contra o total da origem.
 */
export function contarDescartes(
  sinalizadas: readonly string[],
  importadas: readonly string[],
): number {
  const noCache = new Set(importadas);
  return new Set(sinalizadas.filter((id) => !noCache.has(id))).size;
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
