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
   * Nome da fonte na tabela `importacoes`. Quando definido, a limpeza
   * também apaga os logs de importação dessa fonte (respeitando o filtro
   * de período), zerando as células "consultado, sem dados" da matriz e
   * permitindo reimportar do zero.
   */
  tentativaFonte?: string;
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
  { id: "cgu", label: "CGU — contratos", descricao: "Contratos do Portal da Transparência (Executivo federal).", table: "contratos_cache", yearCol: "ano", tentativaFonte: "cgu" },
  { id: "cgu_licitacoes", label: "CGU — licitações", descricao: "Licitações do Portal da Transparência (Executivo federal).", table: "cgu_licitacoes_cache", yearCol: "ano", tentativaFonte: "cgu_licitacoes" },
  { id: "cgu_emendas", label: "Emendas (CGU + Transferegov)", descricao: "Emendas parlamentares do Portal da Transparência (por ano), enriquecidas com o plano de ação das Especiais (Transferegov).", table: "cgu_transferegov_emendas_cache", yearCol: "ano", tentativaFonte: "cgu_emendas" },
  { id: "cgu_convenios", label: "CGU — convênios", descricao: "Convênios do Portal da Transparência (eixo tema).", table: "cgu_convenios_cache", yearCol: "ano", tentativaFonte: "cgu_convenios" },
  { id: "fornecedores", label: "Fornecedores (cadastro)", descricao: "Cadastro de fornecedores extraído dos contratos.", table: "fornecedores_cache" },
  { id: "orgaos", label: "Órgãos (cadastro)", descricao: "Cadastro de órgãos persistidos via importação.", table: "orgaos_cache" },
  { id: "camara_deputados", label: "Câmara — cadastro de deputados", descricao: "Cadastro (identidade) dos deputados.", table: "camara_deputados_cache", tentativaFonte: "camara_deputados" },
  { id: "camara_dep_leg", label: "Câmara — mandatos por legislatura", descricao: "Histórico de partido/UF por legislatura.", table: "camara_deputado_legislaturas", parentPk: "deputado_id" },
  { id: "camara_ceap", label: "Câmara — CEAP", descricao: "Notas fiscais da cota parlamentar.", table: "camara_despesas_cache", yearCol: "ano", tentativaFonte: "camara_ceap" },
  { id: "camara_vot", label: "Câmara — votações nominais", descricao: "Votações em plenário + votos individuais (cascata).", table: "camara_votacoes_cache", dateCol: "data", childTable: "camara_votos_cache", childRef: "votacao_id", parentPk: "id", tentativaFonte: "camara_vot" },
  { id: "camara_props", label: "Câmara — proposições", descricao: "PLs/PECs etc. + autores (cascata).", table: "camara_proposicoes_cache", yearCol: "ano", childTable: "camara_proposicoes_autores_cache", childRef: "proposicao_id", parentPk: "id" },
  { id: "senado_senadores", label: "Senado — cadastro de senadores", descricao: "Cadastro (identidade) dos senadores.", table: "senado_senadores_cache", tentativaFonte: "senado_senadores" },
  { id: "senado_sen_leg", label: "Senado — mandatos por legislatura", descricao: "Histórico de partido/UF por legislatura.", table: "senado_senador_legislaturas", parentPk: "codigo_parlamentar" },
  { id: "senado_ceaps", label: "Senado — CEAPS", descricao: "Notas fiscais da cota parlamentar.", table: "senado_despesas_cache", yearCol: "ano", tentativaFonte: "senado_ceaps" },
  { id: "senado_vot", label: "Senado — votações", descricao: "Votações + votos individuais (cascata).", table: "senado_votacoes_cache", dateCol: "data", childTable: "senado_votos_cache", childRef: "votacao_id", parentPk: "id", tentativaFonte: "senado_vot" },
  { id: "senado_mat", label: "Senado — matérias", descricao: "Matérias + autores (cascata).", table: "senado_materias_cache", yearCol: "ano", childTable: "senado_materias_autores_cache", childRef: "materia_id", parentPk: "id" },
  { id: "pncp", label: "PNCP — contratos", descricao: "Contratos do Portal Nacional de Contratações Públicas.", table: "pncp_contratos_cache", yearCol: "ano", tentativaFonte: "pncp" },
  { id: "siconfi", label: "SICONFI — relatórios fiscais", descricao: "RREO, RGF, DCA dos entes.", table: "siconfi_relatorios_cache", yearCol: "exercicio", tentativaFonte: "siconfi" },
  { id: "transferegov", label: "Transferegov — convênios", descricao: "Instrumentos de repasse União ↔ entes (espelho CGU).", table: "transferegov_instrumentos_cache", dateCol: "data_assinatura", tentativaFonte: "transferegov" },
  {
    id: "importacoes_log",
    label: "Histórico de importações (sucessos e erros)",
    descricao: "Esvazia a aba Histórico — apaga apenas as tentativas que importaram algum registro ou que falharam com erro, em todas as fontes (CGU, PNCP, Siconfi, Câmara, Senado, Transferegov). Não mexe nos marcadores de 'consultado, vazio', portanto meses legitimamente sem dados não voltam a ser consultados.",
    table: "importacoes",
    dateCol: "consultado_em",
    logKind: "ativos",
  },
  {
    id: "importacoes_vazias",
    label: "Marcadores 'consultado, vazio' da matriz",
    descricao: "Apaga só as tentativas que retornaram zero registros e sem erro (= células marcadas como consultadas, mas vazias). Útil quando você suspeita que a fonte passou a publicar dados que antes não existiam e quer reconsultar esses meses na próxima 'Sincronizar tudo'.",
    table: "importacoes",
    dateCol: "consultado_em",
    logKind: "vazios",
  },
];

export const FONTE_IDS = FONTES_LIMPEZA.map((f) => f.id);
