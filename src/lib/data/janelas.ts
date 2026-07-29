// Janelas de disponibilidade conhecidas das fontes oficiais.
// Usado pelos lotes do admin para evitar requisições inúteis a períodos
// em que sabidamente não existem dados (antes do início da publicação
// daquela fonte ou no futuro).

export type FonteJanela =
  | "cgu"
  | "cgu_licitacoes"
  | "cgu_emendas"
  | "cgu_convenios"
  | "camara_ceap"
  | "camara_vot"
  | "camara_props"
  | "senado_ceaps"
  | "senado_vot"
  | "senado_mat"
  | "pncp"
  | "transferegov"
  | "siconfi"
  | "tse";

// Ano a partir do qual a fonte tem (ou tipicamente tem) dados publicados.
// Valores conservadores baseados na documentação das APIs.
export const ANO_INICIO_POR_FONTE: Record<FonteJanela, number> = {
  cgu: 2013,          // Portal da Transparência — contratos
  cgu_licitacoes: 2013, // Portal da Transparência — licitações
  cgu_emendas: 2014,  // Portal da Transparência — emendas (SIOP)
  cgu_convenios: 2017, // Portal da Transparência — convênios (espelho CGU desde ~2017)
  camara_ceap: 2009,  // Cota para Exercício da Atividade Parlamentar
  camara_vot: 2003,   // Votações nominais da Câmara (jan = recesso, sem sessões)
  camara_props: 1988, // Proposições — API cobre até ~1960; piso na Constituição de 1988
  senado_ceaps: 2008, // CEAPS
  senado_vot: 2003,   // Votações do Senado (endpoint usa data YYYYMMDD)
  senado_mat: 1988,   // Matérias (sigla PLS até 2018, PL a partir de 2019); dados desde ~1990
  pncp: 2021,         // Portal Nacional de Contratações Públicas
  transferegov: 2017, // Espelho CGU consolida convênios consistentes a partir de 2017
  siconfi: 2013,      // RREO/RGF/DCA via API SICONFI
  tse: 2014,          // Dados abertos do TSE (eleições de 2014 em diante)
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