/**
 * "Coleção desatualizada" na /buscar (modelo de cobertura estruturada da
 * v0.16.0). A busca lê só o índice local — não existe "fonte fora do ar" na
 * hora da consulta —, então o que pode faltar é importação: a categoria fica
 * marcada quando uma fonte que alimenta alguma coleção dela está sem
 * conferência aprovada há mais que o limiar do catálogo (`limiarDefasagemDias`).
 * Fonte nunca conferida também conta, sem data.
 */
import type { CategoriaBuscaId } from "@/lib/busca/categorias";
import { limiarDefasagemDias, type EntradaCatalogoCobertura } from "@/lib/data/cobertura-catalogo";

/**
 * Coleções de conteúdo editorial do próprio site: não são fontes importadas,
 * então não têm entrada no catálogo de cobertura nem ficam "desatualizadas".
 */
export const COLECOES_EDITORIAIS: Record<string, CategoriaBuscaId> = {
  artigos: "artigos",
  perguntas: "perguntas",
  pergunta_modelos: "perguntas",
  roadmap_itens: "paginas",
  lacunas: "qualidade",
  paginas_publicas: "paginas",
  mapa_prompts: "artigos",
  qa_findings: "qualidade",
};

/**
 * Categoria que a projeção de cada coleção grava em `busca_indice.categoria`.
 * O teste confere com o SQL das projeções.
 */
export const CATEGORIA_DA_COLECAO: Record<string, CategoriaBuscaId> = {
  ...COLECOES_EDITORIAIS,
  contratos_cache: "contratos",
  pncp_contratos_cache: "contratos",
  cgu_licitacoes_cache: "licitacoes",
  cgu_transferegov_emendas_cache: "emendas",
  convenios_cache: "convenios",
  fornecedores_cache: "organizacoes",
  tse_candidatos_cache: "pessoas",
  tse_bens_candidato_cache: "eleicoes",
  tse_receitas_campanha_cache: "eleicoes",
  tse_despesas_campanha_cache: "eleicoes",
  tse_resultados_cache: "eleicoes",
  camara_deputados_cache: "pessoas",
  senado_senadores_cache: "pessoas",
  orgaos_cache: "organizacoes",
  ibge_municipios_cache: "organizacoes",
  camara_proposicoes_cache: "propostas",
  senado_materias_cache: "propostas",
  camara_votacoes_cache: "votacoes",
  senado_votacoes_cache: "votacoes",
  camara_votos_cache: "votos",
  senado_votos_cache: "votos",
  siconfi_relatorios: "financas",
  camara_despesas_cache: "despesas",
  senado_despesas_cache: "despesas",
};

export type Desatualizada = {
  /** Fontes atrasadas: título (do catálogo) e última importação conferida (null = nunca). */
  fontes: { titulo: string; ultima: string | null }[];
};

export type Desatualizadas = Partial<Record<CategoriaBuscaId, Desatualizada>>;

export function categoriasDesatualizadas(
  fontes: readonly { entrada: EntradaCatalogoCobertura; ultima: string | null }[],
  agora: Date = new Date(),
): Desatualizadas {
  const r: Desatualizadas = {};
  for (const { entrada, ultima } of fontes) {
    const limiarMs = limiarDefasagemDias(entrada) * 86_400_000;
    const atrasada = !ultima || agora.getTime() - new Date(ultima).getTime() > limiarMs;
    if (!atrasada) continue;
    const categorias = new Set(entrada.indice.map((c) => CATEGORIA_DA_COLECAO[c]).filter(Boolean));
    for (const cat of categorias) {
      const d = (r[cat] ??= { fontes: [] });
      if (!d.fontes.some((f) => f.titulo === entrada.titulo)) {
        d.fontes.push({ titulo: entrada.titulo, ultima });
      }
    }
  }
  return r;
}
