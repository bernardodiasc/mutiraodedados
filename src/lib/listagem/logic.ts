/**
 * Kit padrão de listagem pública: paginação numérica compartilhável, ordenação
 * e corte de estabilidade.
 *
 * Contrato de URL de toda listagem: `pagina` (1-based), `itens` (por página),
 * `ordem` ("campo-direcao"), `ate` (corte de estabilidade) + filtros nomeados.
 * Contrato de resposta do servidor: `{ linhas, total, corteSugerido }`, com
 * `total` real (count) respeitando filtros + corte.
 *
 * Estabilidade: o primeiro carregamento (sem `ate`) é a visão viva; o servidor
 * devolve `corteSugerido` e TODOS os links de página incluem `?ate=`. Com o
 * corte fixado, a mesma URL mostra os mesmos registros para sempre, mesmo com
 * importações novas — em qualquer ordenação. Correções/limpezas de registros
 * antigos ainda podem mudar uma página compartilhada (comportamento desejado:
 * dado corrigido aparece corrigido).
 */

export const ITENS_PADRAO = 100;
export const ITENS_OPCOES = [25, 50, 100] as const;
export const ITENS_OPCOES_AMPLIADAS = [250, 500] as const;
export const ITENS_MAX = 500;

export type OpcaoOrdem = { valor: string; label: string };

export type SearchListagem = {
  pagina?: number;
  itens?: number;
  ordem?: string;
  ate?: string;
};

export type RespostaListagem<T> = {
  linhas: T[];
  /** Total real (count) com os mesmos filtros + corte — nunca o tamanho da amostra. */
  total: number;
  /** Corte de estabilidade a fixar nos links de paginação. */
  corteSugerido: string;
};

const TODAS_OPCOES_ITENS: number[] = [...ITENS_OPCOES, ...ITENS_OPCOES_AMPLIADAS];

export function normalizarPagina(v: unknown): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export function normalizarItens(v: unknown): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return ITENS_PADRAO;
  return TODAS_OPCOES_ITENS.includes(n) ? n : ITENS_PADRAO;
}

// Aceita ISO completo ("2026-08-24T12:00:00.000Z") ou só a data.
const ATE_RE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/;

export function normalizarAte(v: unknown): string | undefined {
  return typeof v === "string" && ATE_RE.test(v) ? v : undefined;
}

export function normalizarOrdem(
  v: unknown,
  opcoes: ReadonlyArray<OpcaoOrdem>,
  padrao: string,
): string {
  return typeof v === "string" && opcoes.some((o) => o.valor === v) ? v : padrao;
}

/**
 * Parse dos params base de listagem para `validateSearch`. Valores padrão
 * viram `undefined` para manter a URL limpa.
 */
export function parseSearchListagem(
  s: Record<string, unknown>,
  cfg: { ordens: ReadonlyArray<OpcaoOrdem>; ordemPadrao: string },
): SearchListagem {
  const pagina = normalizarPagina(s.pagina);
  const itens = normalizarItens(s.itens);
  const ordem = normalizarOrdem(s.ordem, cfg.ordens, cfg.ordemPadrao);
  return {
    pagina: pagina > 1 ? pagina : undefined,
    itens: itens !== ITENS_PADRAO ? itens : undefined,
    ordem: ordem !== cfg.ordemPadrao ? ordem : undefined,
    ate: normalizarAte(s.ate),
  };
}

export function decomporOrdem(ordem: string): { campo: string; direcao: "asc" | "desc" } {
  const i = ordem.lastIndexOf("-");
  const campo = i > 0 ? ordem.slice(0, i) : ordem;
  const dir = i > 0 ? ordem.slice(i + 1) : "desc";
  return { campo, direcao: dir === "asc" ? "asc" : "desc" };
}

export function calcularTotalPaginas(total: number, itens: number): number {
  if (total <= 0 || itens <= 0) return 1;
  return Math.ceil(total / itens);
}

export function offsetDaPagina(pagina: number, itens: number): number {
  return (Math.max(1, pagina) - 1) * itens;
}

/** Faixa "X–Y de N" exibida junto da navegação. */
export function intervaloExibido(
  pagina: number,
  itens: number,
  total: number,
): { de: number; ate: number } {
  if (total <= 0) return { de: 0, ate: 0 };
  const de = offsetDaPagina(pagina, itens) + 1;
  return { de: Math.min(de, total), ate: Math.min(de + itens - 1, total) };
}

/**
 * Números da navegação com elipses: primeira e última sempre visíveis,
 * vizinhas da atual no meio. Ex.: [1, "…", 4, 5, 6, "…", 12].
 */
export function montarIntervaloPaginas(atual: number, totalPaginas: number): Array<number | "…"> {
  if (totalPaginas <= 7) {
    return Array.from({ length: totalPaginas }, (_, i) => i + 1);
  }
  const nucleo = new Set<number>([1, totalPaginas, atual - 1, atual, atual + 1]);
  const ordenado = [...nucleo].filter((n) => n >= 1 && n <= totalPaginas).sort((a, b) => a - b);
  const saida: Array<number | "…"> = [];
  let anterior = 0;
  for (const n of ordenado) {
    if (anterior && n - anterior === 2) saida.push(anterior + 1);
    else if (anterior && n - anterior > 2) saida.push("…");
    saida.push(n);
    anterior = n;
  }
  return saida;
}
