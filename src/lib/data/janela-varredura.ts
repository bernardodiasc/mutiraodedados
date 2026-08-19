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
 * Teto de subrequisições por rodada. Conta a busca da página e os lotes
 * gravados; a margem até o teto real do Worker absorve as consultas de QA.
 */
export const JANELA_TETO_SUBREQUISICOES = 45;

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
