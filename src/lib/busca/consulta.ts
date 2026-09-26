/**
 * Lógica pura da consulta ao índice de busca: monta os filtros que as funções
 * SQL (`busca_resumo`, `busca_lista`, `busca_opcoes_faceta`) recebem e define
 * o formato das respostas. Sem I/O, para ser testada isoladamente.
 */
import { CATEGORIAS_BUSCA, categoriaBusca, type CategoriaBuscaId } from "./categorias";

/** Valor de faceta que seleciona registros sem aquela informação. */
export const VALOR_VAZIO = "__vazio__";

export const ITENS_BUSCA = [20, 50, 100] as const;
export const ITENS_BUSCA_PADRAO = 20;
/** Página numerada só até este resultado; além disso, refinar ou exportar. */
export const LIMITE_RESULTADOS_PAGINADOS = 10_000;

export const ORDENS_BUSCA = ["relevancia", "data-desc", "data-asc"] as const;
export type OrdemBusca = (typeof ORDENS_BUSCA)[number];

/** Facetas que valem para todas as categorias (colunas próprias no índice). */
export const FACETAS_UNIVERSAIS = ["fonte", "uf", "ano"] as const;
export type FacetaUniversal = (typeof FACETAS_UNIVERSAIS)[number];

export type FiltrosBusca = {
  fonte?: string[];
  uf?: string[];
  ano?: string[];
  /** Facetas próprias de tipo, pela chave do registro de categorias. */
  especificas?: Record<string, string[]>;
};

/** Formato de `p_filtros` nas funções SQL. */
export type FiltrosSql = Partial<Record<FacetaUniversal, string[]>> & {
  por_categoria?: Partial<Record<CategoriaBuscaId, Record<string, string[]>>>;
};

export class FiltroIncompativelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FiltroIncompativelError";
  }
}

function naoVazios(valores: string[] | undefined): string[] | undefined {
  const limpos = (valores ?? []).map((v) => v.trim()).filter(Boolean);
  return limpos.length ? [...new Set(limpos)] : undefined;
}

/**
 * Filtros para o SQL. Na visão geral (`categoria` nula), uma faceta própria
 * de tipo restringe só as categorias ativas que a têm; as demais passam. Numa
 * categoria, faceta que ela não tem é recusada com o motivo, nunca ignorada.
 */
export function montarFiltrosSql(
  filtros: FiltrosBusca,
  categoria: CategoriaBuscaId | null,
): FiltrosSql {
  const sql: FiltrosSql = {};
  for (const f of FACETAS_UNIVERSAIS) {
    const v = naoVazios(filtros[f]);
    if (v) sql[f] = v;
  }

  const especificas = Object.entries(filtros.especificas ?? {})
    .map(([chave, valores]) => [chave, naoVazios(valores)] as const)
    .filter((par): par is readonly [string, string[]] => par[1] !== undefined);
  if (!especificas.length) return sql;

  const porCategoria: NonNullable<FiltrosSql["por_categoria"]> = {};
  const alvo = categoria ? [categoriaBusca(categoria)!] : CATEGORIAS_BUSCA.filter((c) => c.ativa);
  for (const [chave, valores] of especificas) {
    const comChave = alvo.filter((c) => c.facetas.some((f) => f.chave === chave));
    if (!comChave.length) {
      throw new FiltroIncompativelError(
        categoria
          ? `O filtro "${chave}" não se aplica a ${categoriaBusca(categoria)!.rotulo}.`
          : `O filtro "${chave}" não existe em nenhuma categoria da busca.`,
      );
    }
    for (const c of comChave) porCategoria[c.id] = { ...porCategoria[c.id], [chave]: valores };
  }
  sql.por_categoria = porCategoria;
  return sql;
}

/** Chaves das facetas próprias de uma categoria, na ordem do registro. */
export function facetasDaCategoria(categoria: CategoriaBuscaId): string[] {
  return categoriaBusca(categoria)!.facetas.map((f) => f.chave);
}

/** Página dentro do limite de resultados paginados? */
export function paginaPermitida(pagina: number, itens: number): boolean {
  return pagina >= 1 && pagina * itens <= LIMITE_RESULTADOS_PAGINADOS;
}

// ---------------------------------------------------------------------------
// Respostas

export type MotivoCorrespondencia = "identificador" | "titulo" | "nomes" | "texto";

export type ItemBusca = {
  colecao: string;
  id: string;
  categoria: CategoriaBuscaId;
  subtipo: string | null;
  fonte: string;
  titulo: string;
  identificador: string | null;
  resumo: string | null;
  data: { valor: string; natureza: string; precisao: "dia" | "mes" | "ano" } | null;
  valor: { n: number; natureza: string; unidade: string } | null;
  uf: string | null;
  href: string;
  urlOficial: string | null;
  pai: { categoria: string; id: string; titulo: string } | null;
  exato: boolean;
  motivo: MotivoCorrespondencia;
  /** Trecho com os termos entre [[ e ]]; ver `segmentosDoTrecho`. */
  trecho: string | null;
};

export type OpcaoFaceta = { valor: string; n: number };
export type Facetas = Record<string, { opcoes: OpcaoFaceta[]; mais: boolean }>;

export type ResumoBusca = {
  corte: string;
  /** false quando a contagem estourou o orçamento: totais nulos e sem facetas. */
  contado: boolean;
  categorias: Array<{ categoria: CategoriaBuscaId; total: number | null; previas: ItemBusca[] }>;
  exato: ItemBusca | null;
  facetas?: Facetas;
  /** Resultados que entraram no índice depois do corte (só com corte). */
  novos?: number;
};

export type ListaBusca = {
  corte: string;
  categoria: CategoriaBuscaId;
  pagina: number;
  itens: number;
  total: number | null;
  temMais: boolean;
  resultados: ItemBusca[];
  facetas?: Facetas;
  novos?: number;
};

/**
 * Trecho em partes para renderização segura: o texto nunca é interpretado
 * como HTML; as partes com `destaque` foram marcadas pelo banco.
 */
export function segmentosDoTrecho(trecho: string): Array<{ texto: string; destaque: boolean }> {
  return trecho
    .split(/\[\[(.*?)\]\]/g)
    .map((texto, i) => ({ texto, destaque: i % 2 === 1 }))
    .filter((s) => s.texto !== "");
}
