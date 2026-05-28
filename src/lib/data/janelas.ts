// Janelas de disponibilidade conhecidas das fontes oficiais.
// Usado pelos lotes do admin para evitar requisições inúteis a períodos
// em que sabidamente não existem dados (antes do início da publicação
// daquela fonte ou no futuro).

export type FonteJanela =
  | "cgu"
  | "camara_ceap"
  | "camara_vot"
  | "senado_ceaps"
  | "senado_vot"
  | "pncp"
  | "transferegov"
  | "transferegov_especiais"
  | "transferegov_finalidade"
  | "siconfi";

// Ano a partir do qual a fonte tem (ou tipicamente tem) dados publicados.
// Valores conservadores baseados na documentação das APIs.
export const ANO_INICIO_POR_FONTE: Record<FonteJanela, number> = {
  cgu: 2013,          // Portal da Transparência — contratos
  camara_ceap: 2009,  // Cota para Exercício da Atividade Parlamentar
  camara_vot: 2003,   // Votações nominais da Câmara
  senado_ceaps: 2008, // CEAPS
  senado_vot: 2003,   // Votações do Senado
  pncp: 2021,         // Portal Nacional de Contratações Públicas
  transferegov: 2017, // Espelho CGU consolida convênios consistentes a partir de 2017
  transferegov_especiais: 2020,  // Transferências Especiais (EC 105/2019, regulamentadas em 2020)
  transferegov_finalidade: 2020, // Transferências com Finalidade Definida (EC 105)
  siconfi: 2013,      // RREO/RGF/DCA via API SICONFI
};

/** True se (ano, mes) está dentro da janela conhecida e não é futuro. */
export function dentroDaJanela(fonte: FonteJanela, ano: number, mes: number): boolean {
  const inicio = ANO_INICIO_POR_FONTE[fonte];
  if (ano < inicio) return false;
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1;
  if (ano > anoAtual) return false;
  if (ano === anoAtual && mes > mesAtual) return false;
  return true;
}