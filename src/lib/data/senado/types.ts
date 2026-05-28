/**
 * Tipos de domínio para dados abertos do Senado Federal
 * (API: https://legis.senado.leg.br/dadosabertos)
 */

export type Senador = {
  id: number;
  codigoParlamentar: number;
  nome: string;
  nomeCompleto?: string | null;
  siglaPartido?: string | null;
  siglaUf?: string | null;
  urlFoto?: string | null;
  email?: string | null;
  situacao?: string | null;
};

export type DespesaCEAPS = {
  id: string;
  senadorId: number;
  ano: number;
  mes: number;
  tipoDespesa: string | null;
  fornecedorNome: string | null;
  fornecedorCnpj: string | null;
  dataDocumento: string | null;
  numDocumento: string | null;
  valorReembolsado: number;
  detalhamento: string | null;
};