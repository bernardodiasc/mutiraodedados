/**
 * Categorias do índice de busca (`busca_indice`), na ordem fixa em que a
 * /buscar as apresenta. A lista vale para todas as versões: categoria sem
 * adaptador ainda existe aqui, com `ativa: false`, e aparece só quando a
 * coleção que a alimenta entrar no índice.
 *
 * Cada coleção entra no índice por duas peças: a função SQL de projeção
 * (`busca_projecao_*`, em `drizzle/migrations/`) e a entrada da categoria
 * aqui. Os ids precisam bater com o CHECK de `busca_indice.categoria`.
 */

export type CategoriaBuscaId =
  | "propostas"
  | "normas"
  | "votacoes"
  | "votos"
  | "documentos"
  | "eventos"
  | "pessoas"
  | "organizacoes"
  | "contratos"
  | "licitacoes"
  | "emendas"
  | "convenios"
  | "despesas"
  | "eleicoes"
  | "financas"
  | "estudos"
  | "artigos"
  | "perguntas"
  | "qualidade"
  | "paginas";

/** Natureza da data principal de uma linha do índice (lista fechada). */
export type NaturezaData =
  | "assinatura"
  | "apresentacao"
  | "publicacao"
  | "fato"
  | "exercicio"
  | "eleicao";

export type FacetaEspecifica = {
  /** Chave em `busca_indice.facetas`. */
  chave: string;
  /** Nome do parâmetro na URL, quando a chave colide com um reservado. */
  param?: string;
  rotulo: string;
  /** Muitas opções: pesquisa dentro do filtro e paginação de opções. */
  longa?: boolean;
};

export type CategoriaBusca = {
  id: CategoriaBuscaId;
  rotulo: string;
  /** Rótulo da data principal dentro da categoria ("Assinatura"). */
  rotuloData: string | null;
  /** Facetas próprias da categoria, além das universais (fonte, ano, UF). */
  facetas: FacetaEspecifica[];
  /** Já tem adaptador no índice. */
  ativa: boolean;
};

export const CATEGORIAS_BUSCA: readonly CategoriaBusca[] = [
  { id: "propostas", rotulo: "Propostas", rotuloData: "Apresentação", facetas: [], ativa: false },
  { id: "normas", rotulo: "Normas", rotuloData: "Publicação", facetas: [], ativa: false },
  { id: "votacoes", rotulo: "Votações", rotuloData: "Data da votação", facetas: [], ativa: false },
  { id: "votos", rotulo: "Votos", rotuloData: "Data da votação", facetas: [], ativa: false },
  {
    id: "documentos",
    rotulo: "Documentos e debates",
    rotuloData: "Publicação",
    facetas: [],
    ativa: false,
  },
  { id: "eventos", rotulo: "Eventos", rotuloData: "Data do evento", facetas: [], ativa: false },
  {
    id: "pessoas",
    rotulo: "Pessoas",
    rotuloData: "Eleição",
    facetas: [
      { chave: "cargo", rotulo: "Cargo" },
      { chave: "partido", rotulo: "Partido" },
      { chave: "situacao", rotulo: "Situação" },
    ],
    ativa: true,
  },
  { id: "organizacoes", rotulo: "Organizações", rotuloData: null, facetas: [], ativa: true },
  {
    id: "contratos",
    rotulo: "Contratos",
    rotuloData: "Assinatura",
    facetas: [
      { chave: "modalidade", rotulo: "Modalidade" },
      { chave: "tipo_contrato", rotulo: "Tipo de contrato" },
      { chave: "orgao", rotulo: "Órgão", longa: true },
      { chave: "fornecedor", rotulo: "Fornecedor", longa: true },
      { chave: "situacao", rotulo: "Situação" },
      { chave: "municipio", rotulo: "Município", longa: true },
    ],
    ativa: true,
  },
  {
    id: "licitacoes",
    rotulo: "Licitações",
    rotuloData: "Abertura",
    facetas: [
      { chave: "modalidade", rotulo: "Modalidade" },
      { chave: "situacao", rotulo: "Situação" },
      { chave: "orgao", rotulo: "Unidade gestora", longa: true },
      { chave: "municipio", rotulo: "Município", longa: true },
    ],
    ativa: true,
  },
  {
    id: "emendas",
    rotulo: "Emendas orçamentárias",
    rotuloData: "Exercício",
    facetas: [
      { chave: "tipo", param: "tipo_emenda", rotulo: "Tipo de emenda" },
      { chave: "funcao", rotulo: "Função" },
      { chave: "autor", rotulo: "Autor", longa: true },
    ],
    ativa: true,
  },
  {
    id: "convenios",
    rotulo: "Convênios e transferências",
    rotuloData: "Assinatura",
    facetas: [
      { chave: "situacao", rotulo: "Situação" },
      { chave: "orgao", rotulo: "Órgão", longa: true },
      { chave: "convenente", rotulo: "Convenente", longa: true },
      { chave: "municipio", rotulo: "Município", longa: true },
    ],
    ativa: true,
  },
  {
    id: "despesas",
    rotulo: "Despesas",
    rotuloData: "Data do documento",
    facetas: [],
    ativa: false,
  },
  {
    id: "eleicoes",
    rotulo: "Eleições e campanhas",
    rotuloData: "Eleição",
    facetas: [],
    ativa: false,
  },
  {
    id: "financas",
    rotulo: "Finanças públicas",
    rotuloData: "Exercício",
    facetas: [],
    ativa: false,
  },
  {
    id: "estudos",
    rotulo: "Estudos externos",
    rotuloData: "Publicação",
    facetas: [],
    ativa: false,
  },
  {
    id: "artigos",
    rotulo: "Artigos",
    rotuloData: "Publicação",
    facetas: [{ chave: "dificuldade", rotulo: "Dificuldade" }],
    ativa: true,
  },
  {
    id: "perguntas",
    rotulo: "Perguntas e investigações",
    rotuloData: "Publicação",
    facetas: [],
    ativa: false,
  },
  {
    id: "qualidade",
    rotulo: "Qualidade e sinais",
    rotuloData: "Detecção",
    facetas: [],
    ativa: false,
  },
  { id: "paginas", rotulo: "Páginas e ajuda", rotuloData: null, facetas: [], ativa: false },
];

/** Rótulo curto da natureza da data, para a visão geral (onde o significado varia por tipo). */
export const ROTULO_NATUREZA_DATA: Record<NaturezaData, string> = {
  assinatura: "assinatura",
  apresentacao: "apresentação",
  publicacao: "publicação",
  fato: "data do fato",
  exercicio: "exercício",
  eleicao: "eleição",
};

export function categoriaBusca(id: string): CategoriaBusca | undefined {
  return CATEGORIAS_BUSCA.find((c) => c.id === id);
}
