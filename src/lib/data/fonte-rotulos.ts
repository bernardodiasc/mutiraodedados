/**
 * Como cada fonte de importação se chama na tela.
 *
 * **A chave é o identificador; o valor é de onde o dado veio.** Os dois não
 * precisam coincidir, e no caso dos convênios não coincidem: o id
 * `transferegov` está gravado em milhares de linhas de `importacoes` desde
 * antes de sabermos que o ingest consulta o Portal da Transparência, não o
 * Transferegov. Trocar o id é migration; trocar o rótulo é obrigação.
 *
 * A regra, que o teste-guarda ao lado protege: **o rótulo nomeia a API que
 * consultamos**. O sistema onde o dado nasce entra na descrição, nunca aqui —
 * dizer "Transferegov" numa linha de histórico produzida por uma chamada à
 * CGU é atribuir procedência que não temos.
 */
export const FONTE_LABEL: Record<string, string> = {
  camara_ceap: "Câmara CEAP",
  camara_vot: "Câmara votações",
  senado_ceaps: "Senado CEAPS",
  senado_vot: "Senado votações",
  pncp: "PNCP",
  transferegov: "Portal CGU — Convênios por ente",
  siconfi: "SICONFI",
  cgu: "Portal CGU",
  cgu_licitacoes: "Portal CGU — Licitações",
  cgu_emendas: "Portal CGU — Emendas",
  cgu_convenios: "Portal CGU — Convênios",
  camara_props: "Câmara — Proposições",
  camara_deputados: "Câmara — Cadastro de deputados",
  camara_trajetoria: "Câmara — Trajetória de deputados",
  senado_mat: "Senado — Matérias",
  senado_senadores: "Senado — Cadastro de senadores",
  orgaos_siafi: "Órgãos SIAFI",
  tse: "TSE",
  tse_candidatos: "TSE — Candidatos",
  tse_bens: "TSE — Bens de candidatos",
  tse_resultados: "TSE — Resultados por município",
  tse_receitas: "TSE — Receitas de campanha",
  tse_despesas: "TSE — Despesas de campanha",
  tse_ponte: "TSE — Vínculo parlamentar↔candidato",
  tse_lacunas: "TSE — Lacunas",
  tse_sinais: "TSE — Sinais investigativos",
  tse_doador_fornecedor: "TSE — Cruzamento doador↔fornecedor",
  ibge: "IBGE — municípios",
  convenios_origem: "Transferegov — origem (CSV)",
};

/**
 * Todo id que o projeto grava em `importacoes`. O teste-guarda ao lado cobra
 * rótulo para cada um: sem ele o Histórico exibia o id cru — o mantenedor via
 * "senado_mat" e "camara_props" no meio de "Senado votações" e "Câmara CEAP".
 */
export const FONTES_COM_HISTORICO = [
  "cgu",
  "cgu_licitacoes",
  "cgu_emendas",
  "cgu_convenios",
  "transferegov",
  "pncp",
  "siconfi",
  "camara_ceap",
  "camara_vot",
  "camara_props",
  "camara_deputados",
  "camara_trajetoria",
  "senado_ceaps",
  "senado_vot",
  "senado_mat",
  "senado_senadores",
  "orgaos_siafi",
  "tse_candidatos",
  "tse_bens",
  "tse_resultados",
  "tse_receitas",
  "tse_despesas",
  "tse_ponte",
  "tse_lacunas",
  "tse_sinais",
  "tse_doador_fornecedor",
  "ibge",
  "convenios_origem",
] as const;

/** Ids cujo ingest consulta o Portal da Transparência (CGU). */
export const FONTES_VIA_PORTAL_CGU = [
  "cgu",
  "cgu_licitacoes",
  "cgu_emendas",
  "cgu_convenios",
  "transferegov",
] as const;
