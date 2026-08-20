// Catálogo de fontes para limpeza seletiva (manutenção) e descrição do
// que cada uma cobre. Usado tanto pela UI quanto pelo server function
// clearImportData. NÃO importa nada de server.
export type FonteLimpeza = {
  id: string;
  label: string;
  descricao: string;
  /** Tabela principal (pai). Filtros de período se aplicam aqui. */
  table: string;
  /** Coluna usada para filtro por ano (int). */
  yearCol?: string;
  /** Coluna usada para filtro por data ISO. */
  dateCol?: string;
  /** Tabela filha apagada antes (cascade por FK lógica via .in()). */
  childTable?: string;
  /** Coluna na tabela filha que referencia o PK da pai. */
  childRef?: string;
  /** PK da pai usada para localizar filhos. */
  parentPk?: string;
  /**
   * Coluna NOT NULL usada como cláusula WHERE ao apagar TUDO (sem filtro de
   * período). PostgREST exige um WHERE no DELETE e o fallback padrão é `id` —
   * defina isto para tabelas de PK composta que não têm coluna `id`
   * (ex.: caches do TSE `tse_candidatos_cache`, `tse_bens_candidato_cache`,
   * `tse_resultados_cache`).
   */
  pk?: string;
  /**
   * Nome da fonte na tabela `importacoes`. Quando definido, a limpeza
   * também apaga os logs de importação dessa fonte (respeitando o filtro
   * de período), zerando as células "consultado, sem dados" da matriz e
   * permitindo reimportar do zero.
   */
  /** Ids em `importacoes` a apagar junto — um ou vários (tabela unificada). */
  tentativaFonte?: string | readonly string[];
  /** Filtro extra a aplicar (col = valor) quando várias modalidades compartilham a mesma tabela. */
  extraEq?: { col: string; value: string };
  /**
   * Sub-modo para a tabela `importacoes`:
   * - "ativos": apaga só rows com importados>0 OU erros não vazios (= histórico visível).
   * - "vazios": apaga só rows com importados=0 E erros vazios (= marcadores de
   *   "consultado, vazio" que evitam reconsulta de meses legitimamente sem dados).
   * Quando ausente, o comportamento padrão da tabela é aplicado (apagar tudo).
   */
  logKind?: "ativos" | "vazios";
};

export const FONTES_LIMPEZA: FonteLimpeza[] = [
  {
    id: "cgu",
    label: "CGU — contratos",
    descricao: "Contratos do Portal da Transparência (Executivo federal).",
    table: "contratos_cache",
    yearCol: "ano",
    tentativaFonte: "cgu",
  },
  {
    id: "cgu_licitacoes",
    label: "CGU — licitações",
    descricao: "Licitações do Portal da Transparência (Executivo federal).",
    table: "cgu_licitacoes_cache",
    yearCol: "ano",
    tentativaFonte: "cgu_licitacoes",
  },
  {
    id: "cgu_emendas",
    label: "Emendas (CGU + Transferegov)",
    descricao:
      "Emendas parlamentares do Portal da Transparência (por ano), enriquecidas com o plano de ação das Especiais (Transferegov).",
    table: "cgu_transferegov_emendas_cache",
    yearCol: "ano",
    tentativaFonte: "cgu_emendas",
  },
  {
    id: "convenios",
    label: "Convênios (tabela única)",
    descricao:
      "Convênios e contratos de repasse — os dois ângulos (execução federal e por ente) vivem na mesma tabela desde a v0.9.0. Limpar apaga o acervo e o histórico dos DOIS ids de importação.",
    table: "convenios_cache",
    yearCol: "ano",
    tentativaFonte: ["cgu_convenios", "transferegov"],
  },
  {
    id: "fornecedores",
    label: "Fornecedores (cadastro)",
    descricao: "Cadastro de fornecedores extraído dos contratos.",
    table: "fornecedores_cache",
  },
  {
    id: "orgaos",
    label: "Órgãos (cadastro)",
    descricao: "Cadastro de órgãos persistidos via importação.",
    table: "orgaos_cache",
  },
  {
    id: "camara_deputados",
    label: "Câmara — cadastro de deputados",
    descricao: "Cadastro (identidade) dos deputados.",
    table: "camara_deputados_cache",
    tentativaFonte: "camara_deputados",
  },
  {
    id: "camara_dep_leg",
    label: "Câmara — mandatos por legislatura",
    descricao: "Histórico de partido/UF por legislatura.",
    table: "camara_deputado_legislaturas",
    parentPk: "deputado_id",
  },
  {
    id: "camara_ceap",
    label: "Câmara — CEAP",
    descricao: "Notas fiscais da cota parlamentar.",
    table: "camara_despesas_cache",
    yearCol: "ano",
    tentativaFonte: "camara_ceap",
  },
  {
    id: "camara_vot",
    label: "Câmara — votações nominais",
    descricao: "Votações em plenário + votos individuais (cascata).",
    table: "camara_votacoes_cache",
    dateCol: "data",
    childTable: "camara_votos_cache",
    childRef: "votacao_id",
    parentPk: "id",
    tentativaFonte: "camara_vot",
  },
  {
    id: "camara_props",
    label: "Câmara — proposições",
    descricao: "PLs/PECs etc. + autores (cascata).",
    table: "camara_proposicoes_cache",
    yearCol: "ano",
    childTable: "camara_proposicoes_autores_cache",
    childRef: "proposicao_id",
    parentPk: "id",
  },
  {
    id: "senado_senadores",
    label: "Senado — cadastro de senadores",
    descricao: "Cadastro (identidade) dos senadores.",
    table: "senado_senadores_cache",
    tentativaFonte: "senado_senadores",
  },
  {
    id: "senado_sen_leg",
    label: "Senado — mandatos por legislatura",
    descricao: "Histórico de partido/UF por legislatura.",
    table: "senado_senador_legislaturas",
    parentPk: "codigo_parlamentar",
  },
  {
    id: "senado_ceaps",
    label: "Senado — CEAPS",
    descricao: "Notas fiscais da cota parlamentar.",
    table: "senado_despesas_cache",
    yearCol: "ano",
    tentativaFonte: "senado_ceaps",
  },
  {
    id: "senado_vot",
    label: "Senado — votações",
    descricao: "Votações + votos individuais (cascata).",
    table: "senado_votacoes_cache",
    dateCol: "data",
    childTable: "senado_votos_cache",
    childRef: "votacao_id",
    parentPk: "id",
    tentativaFonte: "senado_vot",
  },
  {
    id: "senado_mat",
    label: "Senado — matérias",
    descricao: "Matérias + autores (cascata).",
    table: "senado_materias_cache",
    yearCol: "ano",
    childTable: "senado_materias_autores_cache",
    childRef: "materia_id",
    parentPk: "id",
  },
  {
    id: "pncp",
    label: "PNCP — contratos",
    descricao: "Contratos do Portal Nacional de Contratações Públicas.",
    table: "pncp_contratos_cache",
    yearCol: "ano",
    tentativaFonte: "pncp",
  },
  {
    id: "siconfi",
    label: "SICONFI — relatórios fiscais",
    descricao: "RREO, RGF, DCA dos entes.",
    table: "siconfi_relatorios_cache",
    yearCol: "exercicio",
    tentativaFonte: "siconfi",
  },
  {
    id: "ibge",
    label: "IBGE — municípios",
    descricao: "Cadastro de municípios (código IBGE, nome, UF). Reimportável a qualquer momento.",
    table: "ibge_municipios_cache",
    tentativaFonte: "ibge",
  },
  {
    id: "tse_candidatos",
    label: "TSE — candidatos",
    descricao: "Catálogo eleitoral (candidaturas de 1998 em diante).",
    table: "tse_candidatos_cache",
    yearCol: "ano_eleicao",
    pk: "sq_candidato",
    tentativaFonte: "tse_candidatos",
  },
  {
    id: "tse_bens",
    label: "TSE — bens de candidatos",
    descricao: "Bens declarados por candidatura.",
    table: "tse_bens_candidato_cache",
    yearCol: "ano_eleicao",
    pk: "sq_candidato",
    tentativaFonte: "tse_bens",
  },
  {
    id: "tse_resultados",
    label: "TSE — resultados por município",
    descricao: "Votação nominal agregada por município.",
    table: "tse_resultados_cache",
    yearCol: "ano_eleicao",
    pk: "sq_candidato",
    tentativaFonte: "tse_resultados",
  },
  {
    id: "tse_receitas",
    label: "TSE — receitas de campanha",
    descricao: "Doações recebidas pelos candidatos (prestação de contas).",
    table: "tse_receitas_campanha_cache",
    yearCol: "ano_eleicao",
    tentativaFonte: "tse_receitas",
  },
  {
    id: "tse_despesas",
    label: "TSE — despesas de campanha",
    descricao: "Despesas contratadas pelos candidatos (prestação de contas).",
    table: "tse_despesas_campanha_cache",
    yearCol: "ano_eleicao",
    tentativaFonte: "tse_despesas",
  },
  // Não entram neste catálogo, de propósito, por serem SUBPRODUTOS do TSE e não
  // fontes que o admin escolhe: `tse_varredura` (estado retomável) e
  // `tse_parlamentar_candidato` (vínculos derivados do catálogo de candidatos).
  // Ambas são zeradas automaticamente pela limpeza da entidade que as origina —
  // ver clearImportData. Deixá-las de fora do catálogo E do reset automático foi
  // o que manteve 319 vínculos órfãos e 147 sinais `ponte_baixa_confianca` vivos
  // depois de uma limpeza completa.
  {
    id: "importacoes_log",
    label: "Histórico de importações (sucessos e erros)",
    descricao:
      "Esvazia a aba Histórico — apaga apenas as tentativas que importaram algum registro ou que falharam com erro, em todas as fontes (CGU, PNCP, Siconfi, Câmara, Senado, Transferegov). Não mexe nos marcadores de 'consultado, vazio', portanto meses legitimamente sem dados não voltam a ser consultados.",
    table: "importacoes",
    dateCol: "consultado_em",
    logKind: "ativos",
  },
  {
    id: "importacoes_vazias",
    label: "Marcadores 'consultado, vazio' da matriz",
    descricao:
      "Apaga só as tentativas que retornaram zero registros e sem erro (= células marcadas como consultadas, mas vazias). Útil quando você suspeita que a fonte passou a publicar dados que antes não existiam e quer reconsultar esses meses na próxima 'Sincronizar tudo'.",
    table: "importacoes",
    dateCol: "consultado_em",
    logKind: "vazios",
  },
];

export const FONTE_IDS = FONTES_LIMPEZA.map((f) => f.id);
