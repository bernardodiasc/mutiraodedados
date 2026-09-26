/**
 * Chave de varredura para fontes que importam por **janela de datas** — PNCP e
 * Transferegov hoje.
 *
 * A chave precisa distinguir tudo que muda o conjunto de resultados: a fonte, a
 * janela e os filtros. Duas importações da mesma janela com filtros diferentes
 * são varreduras diferentes; se compartilhassem chave, a segunda retomaria do
 * cursor da primeira e pularia páginas que nunca leu.
 */

/** Orçamento de tempo de uma rodada, com folga sob o limite do Worker. */
export const JANELA_ORCAMENTO_MS = 150_000;

/**
 * Teto de subrequisições por rodada. Conta a busca da página (ou do item) e
 * os lotes gravados.
 *
 * O Worker roda no plano pago: 10.000 subrequisições por invocação. O teto
 * antigo, de 45, era a conta do plano Free (50) e fazia a rodada parar muito
 * antes do orçamento de tempo — um mês de votações da Câmara (mais de 420, a
 * ~4 subrequisições cada) precisava de mais de 30 rodadas. Com 1.000, quem
 * limita a rodada passa a ser o relógio, e a folga até 10.000 cobre o que o
 * custo não conta: o checkpoint de cada passo, as consultas de QA, a linha do
 * Histórico e as gravações por consulta do SICONFI.
 */
export const JANELA_TETO_SUBREQUISICOES = 1_000;

/**
 * Teto das rodadas com passos em paralelo (`paralelismo` do runner): votações
 * da Câmara.
 *
 * Com N passos ao mesmo tempo, a rodada de 150 s faz N vezes mais trabalho, e
 * o teto de 1.000 passaria a parar a rodada antes do relógio — o ganho do
 * paralelismo sumiria. A conta: uma votação custa 3 a 4 subrequisições
 * contadas; com 5 em paralelo, cabem ~1.350 votações em 150 s, ~5.000
 * subrequisições. O limite do Worker é 10.000; a folga de 4.000 cobre o que o
 * custo não conta — uma gravação de checkpoint por grupo de passos
 * confirmados (no máximo uma por item), o QA e a linha do Histórico.
 */
export const JANELA_TETO_SUBREQUISICOES_PARALELO = 6_000;

/**
 * Teto das fontes cuja origem limita requisições por minuto: o PNCP (30 por
 * minuto) e a chave do Portal da Transparência (Transferegov). Nelas a rodada
 * curta e a pausa entre rodadas servem de ritmo; subir o teto faria uma rodada
 * de 150 s disparar centenas de GETs seguidos e esbarrar na cota.
 */
export const JANELA_TETO_SUBREQUISICOES_COM_COTA = 45;

export function chaveVarreduraJanela(
  fonte: string,
  dataInicial: string,
  dataFinal: string,
  filtros: Record<string, string | undefined | null> = {},
): string {
  // Ordenado por nome do filtro: a mesma combinação precisa gerar a mesma
  // chave, independente da ordem em que quem chama montou o objeto.
  const parte = Object.keys(filtros)
    .sort()
    .filter((k) => filtros[k] != null && filtros[k] !== "")
    .map((k) => `${k}=${filtros[k]}`);
  return [`${fonte}#${dataInicial}#${dataFinal}`, ...parte].join("#");
}
