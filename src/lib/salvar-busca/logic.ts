/**
 * "Salvar esta busca": a lista filtrada vira um item do caderno do tipo
 * "busca" — um link dinâmico (path + query canônica), sem cópia dos dados.
 * Pré-requisito: os filtros da página moram na URL (search params).
 */

function valorAtivo(v: unknown): boolean {
  return v !== undefined && v !== null && v !== "" && v !== 0 && v !== false;
}

/** Chave canônica da busca: path + query com chaves ordenadas e vazios fora. */
export function chaveDaBusca(path: string, search: Record<string, unknown>): string {
  const pares = Object.entries(search)
    .filter(([, v]) => valorAtivo(v))
    .map(([k, v]) => [k, String(v)] as [string, string])
    .sort(([a], [b]) => a.localeCompare(b));
  if (pares.length === 0) return path;
  return `${path}?${new URLSearchParams(pares).toString()}`;
}

/** Resumo humano dos filtros ativos: "UF SP · ano 2024 · busca merenda". */
export function resumoDaBusca(filtros: Array<[rotulo: string, valor: unknown]>): string {
  return filtros
    .filter(([, v]) => valorAtivo(v))
    .map(([rotulo, v]) => `${rotulo} ${v}`)
    .join(" · ");
}
