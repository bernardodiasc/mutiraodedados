/**
 * Tipos de domínio para os dados da Câmara dos Deputados
 * (API pública: https://dadosabertos.camara.leg.br/api/v2)
 */

export type Deputado = {
  id: number;
  nome: string;
  nomeCivil?: string | null;
  siglaPartido?: string | null;
  siglaUf?: string | null;
  idLegislatura?: number | null;
  urlFoto?: string | null;
  email?: string | null;
  situacao?: string | null;
  condicaoEleitoral?: string | null;
};

/** Despesa CEAP (Cota para Exercício da Atividade Parlamentar). */
export type DespesaCEAP = {
  id: string; // composto: deputadoId-codDocumento
  deputadoId: number;
  ano: number;
  mes: number;
  tipoDespesa: string;
  codDocumento?: number | null;
  tipoDocumento?: string | null;
  numDocumento?: string | null;
  dataDocumento?: string | null; // ISO YYYY-MM-DD
  valorDocumento: number;
  valorLiquido: number;
  valorGlosa: number;
  fornecedorNome?: string | null;
  fornecedorCnpj?: string | null;
  urlDocumento?: string | null;
};
