/**
 * Catálogo das fontes exibidas em `/cobertura` — módulo puro, sem servidor.
 *
 * Existe pelo mesmo motivo de `fonte-rotulos.ts`: enquanto a lista morava
 * dentro da server function, ninguém cobrava paridade, e três fontes que
 * gravam rodada ficaram anos fora da página (`camara_props`, `senado_mat`,
 * `orgaos_siafi`) — o mantenedor notou "dados e fontes faltando" nos testes
 * da v0.6.0. O teste-guarda ao lado cruza este catálogo com
 * `FONTES_COM_HISTORICO`: fonte nova sem entrada aqui quebra a suíte.
 *
 * `granularidade` diz como ler o heatmap: `mes` é a matriz cheia; `ano`
 * agrupa fontes anuais (emendas, proposições, matérias, eleições); `periodo`
 * é o calendário fiscal do SICONFI; `cadastro` não tem série — é retrato
 * vigente, só contagem e última atualização.
 *
 * Desde a v0.16.0 o catálogo é também a linha do modelo de cobertura
 * estruturada: cada entrada declara as tarefas da ferramenta que a alimentam,
 * as tabelas cache, a janela de disponibilidade, o recorte (a linha da matriz
 * dentro da fonte), as coleções do índice de busca e o limiar de defasagem.
 * O estado de cada janela sai de `cobertura-estado.ts`.
 */

import type { FonteJanela } from "@/lib/data/janelas";

export type GranularidadeCobertura = "mes" | "periodo" | "cadastro" | "ano";

/**
 * Linha da matriz dentro da fonte: órgão (CGU), ente (convênios por ente),
 * sigla ou tipo (matérias, proposições), relatório (SICONFI) ou eleição (TSE).
 * `null`: uma linha só.
 */
export type RecorteCobertura = "orgao" | "ente" | "sigla" | "relatorio" | "eleicao";

export type EntradaCatalogoCobertura = {
  id: string;
  titulo: string;
  descricao: string;
  granularidade: GranularidadeCobertura;
  /** rota interna para explorar essa fonte; null quando não há página própria */
  rota: string | null;
  /** Tarefas da ferramenta de importação que alimentam a fonte (tabela de dependências). */
  tarefas: string[];
  /** Tabelas cache que a fonte grava. */
  tabelas: string[];
  /** Chave da janela de disponibilidade em `janelas.ts`; null nos cadastros. */
  janela: FonteJanela | null;
  recorte: RecorteCobertura | null;
  /** Coleções do índice de busca (`busca_indice.colecao`) alimentadas pela fonte. */
  indice: string[];
  /**
   * `importacoes.fonte` que mede a atualização das coleções do índice, quando
   * não é o próprio `id` (o TSE grava uma fonte por tipo de arquivo; as
   * candidaturas vêm de `tse_candidatos`).
   */
  fonteHistorico?: string;
  /**
   * Dias sem conferência aprovada até a fonte contar como desatualizada.
   * Omitido, vale o padrão da granularidade (`limiarDefasagemDias`).
   */
  limiarDias?: number;
};

/** Padrão do limiar de defasagem por granularidade, em dias. */
const LIMIAR_PADRAO: Record<GranularidadeCobertura, number> = {
  mes: 45,
  periodo: 45,
  ano: 400,
  cadastro: 30,
};

export function limiarDefasagemDias(e: EntradaCatalogoCobertura): number {
  return e.limiarDias ?? LIMIAR_PADRAO[e.granularidade];
}

export const CATALOGO_COBERTURA: EntradaCatalogoCobertura[] = [
  {
    id: "cgu",
    titulo: "Portal CGU — contratos do Executivo",
    descricao:
      "Contratos publicados pelo Portal da Transparência para órgãos do Executivo federal.",
    granularidade: "mes",
    rota: "/orgaos",
    tarefas: ["cgu_contratos"],
    tabelas: ["contratos_cache", "fornecedores_cache"],
    janela: "cgu",
    recorte: "orgao",
    indice: ["contratos_cache", "fornecedores_cache"],
  },
  {
    id: "cgu_licitacoes",
    titulo: "Portal CGU — licitações do Executivo",
    descricao:
      "Licitações publicadas pelo Portal da Transparência para órgãos do Executivo federal.",
    granularidade: "mes",
    rota: "/licitacoes",
    tarefas: ["cgu_licitacoes"],
    tabelas: ["cgu_licitacoes_cache"],
    janela: "cgu_licitacoes",
    recorte: "orgao",
    indice: ["cgu_licitacoes_cache"],
  },
  {
    id: "cgu_emendas",
    titulo: "Portal CGU — emendas parlamentares",
    descricao:
      "Emendas parlamentares (empenho, liquidação e pagamento) publicadas pelo Portal da Transparência, por ano.",
    granularidade: "ano",
    rota: "/emendas",
    tarefas: ["cgu_emendas"],
    tabelas: ["cgu_transferegov_emendas_cache"],
    janela: "cgu_emendas",
    recorte: null,
    indice: ["cgu_transferegov_emendas_cache"],
  },
  {
    id: "cgu_convenios",
    titulo: "Portal CGU — convênios",
    descricao:
      "Convênios e contratos de repasse da União, com dados do Portal da Transparência (CGU).",
    granularidade: "mes",
    rota: "/convenios",
    tarefas: ["convenios"],
    tabelas: ["convenios_cache"],
    janela: "cgu_convenios",
    recorte: null,
    indice: ["convenios_cache"],
  },
  {
    id: "pncp",
    titulo: "PNCP — contratos públicos",
    descricao:
      "Contratos publicados no Portal Nacional de Contratações Públicas (União, Estados, Municípios).",
    granularidade: "mes",
    rota: "/pncp",
    tarefas: ["pncp"],
    tabelas: ["pncp_contratos_cache"],
    janela: "pncp",
    recorte: null,
    indice: ["pncp_contratos_cache"],
  },
  {
    id: "transferegov",
    titulo: "Convênios por ente (Portal CGU)",
    descricao:
      "Convênios e contratos de repasse União ↔ Estados/Municípios, pelo ângulo de quem recebe. O Transferegov é o sistema de origem; a consulta é ao Portal da Transparência.",
    granularidade: "mes",
    rota: "/transferegov",
    tarefas: ["transferegov"],
    tabelas: ["convenios_cache"],
    janela: "transferegov",
    recorte: "ente",
    indice: ["convenios_cache"],
  },
  {
    id: "siconfi",
    titulo: "SICONFI — relatórios fiscais",
    descricao: "RREO/RGF/DCA por exercício e período (granularidade por período do ano).",
    granularidade: "periodo",
    rota: "/relatorios-fiscais",
    tarefas: ["siconfi_relatorio", "siconfi_ano", "siconfi_varredura"],
    tabelas: ["siconfi_relatorios_cache"],
    janela: "siconfi",
    recorte: "relatorio",
    indice: ["siconfi_relatorios"],
  },
  {
    id: "camara_ceap",
    titulo: "Câmara — CEAP (cota parlamentar)",
    descricao: "Notas fiscais de cota parlamentar dos ~513 deputados federais.",
    granularidade: "mes",
    rota: "/camara/deputados",
    tarefas: ["camara_ceap"],
    tabelas: ["camara_despesas_cache"],
    janela: "camara_ceap",
    recorte: null,
    indice: ["camara_despesas_cache"],
  },
  {
    id: "camara_vot",
    titulo: "Câmara — votações nominais",
    descricao: "Votações registradas em plenário e comissões da Câmara.",
    granularidade: "mes",
    rota: "/camara/votacoes",
    tarefas: ["camara_vot"],
    tabelas: ["camara_votacoes_cache", "camara_votos_cache"],
    janela: "camara_vot",
    recorte: null,
    indice: ["camara_votacoes_cache", "camara_votos_cache"],
  },
  {
    id: "camara_props",
    titulo: "Câmara — proposições",
    descricao: "Proposições legislativas (PL, PEC, MPV…) com autores, por ano de apresentação.",
    granularidade: "ano",
    rota: "/camara/proposicoes",
    tarefas: ["camara_props"],
    tabelas: ["camara_proposicoes_cache"],
    janela: "camara_props",
    recorte: "sigla",
    indice: ["camara_proposicoes_cache"],
  },
  {
    id: "camara_deputados",
    titulo: "Câmara — cadastro de deputados",
    descricao: "Cadastro vigente de parlamentares da Câmara dos Deputados.",
    granularidade: "cadastro",
    rota: "/camara/deputados",
    tarefas: ["camara_cadastro"],
    tabelas: ["camara_deputados_cache"],
    janela: null,
    recorte: null,
    indice: ["camara_deputados_cache"],
  },
  {
    id: "camara_trajetoria",
    titulo: "Câmara — trajetória de deputados",
    descricao:
      "Linha do tempo de cada mandato (posse, licença, afastamento, vacância), por legislatura.",
    granularidade: "cadastro",
    rota: "/camara/deputados",
    tarefas: ["camara_trajetoria"],
    tabelas: ["camara_deputado_eventos"],
    janela: null,
    recorte: null,
    indice: [],
  },
  {
    id: "senado_ceaps",
    titulo: "Senado — CEAPS (cota parlamentar)",
    descricao: "Notas fiscais de cota parlamentar dos 81 senadores.",
    granularidade: "mes",
    rota: "/senado/senadores",
    tarefas: ["senado_ceaps"],
    tabelas: ["senado_despesas_cache"],
    janela: "senado_ceaps",
    recorte: null,
    indice: ["senado_despesas_cache"],
  },
  {
    id: "senado_vot",
    titulo: "Senado — votações",
    descricao: "Votações registradas no Senado Federal.",
    granularidade: "mes",
    rota: "/senado/votacoes",
    tarefas: ["senado_vot"],
    tabelas: ["senado_votacoes_cache", "senado_votos_cache"],
    janela: "senado_vot",
    recorte: null,
    indice: ["senado_votacoes_cache", "senado_votos_cache"],
  },
  {
    id: "senado_mat",
    titulo: "Senado — matérias",
    descricao: "Matérias legislativas (PL, PEC, MPV…) com autores, por ano de apresentação.",
    granularidade: "ano",
    rota: "/senado/materias",
    tarefas: ["senado_mat"],
    tabelas: ["senado_materias_cache"],
    janela: "senado_mat",
    recorte: "sigla",
    indice: ["senado_materias_cache"],
  },
  {
    id: "senado_senadores",
    titulo: "Senado — cadastro de senadores",
    descricao: "Cadastro vigente de parlamentares do Senado Federal.",
    granularidade: "cadastro",
    rota: "/senado/senadores",
    tarefas: ["senado_cadastro"],
    tabelas: ["senado_senadores_cache"],
    janela: null,
    recorte: null,
    indice: ["senado_senadores_cache"],
  },
  {
    id: "orgaos_siafi",
    titulo: "Órgãos SIAFI — catálogo",
    descricao:
      "Catálogo de órgãos federais (código SIAFI) que identifica o órgão em contratos e licitações da CGU.",
    granularidade: "cadastro",
    rota: "/orgaos",
    tarefas: ["cgu_siafi", "cgu_atividade"],
    tabelas: ["orgaos_cache"],
    janela: null,
    recorte: null,
    indice: ["orgaos_cache"],
  },
  {
    id: "ibge",
    titulo: "IBGE — cadastro de municípios",
    descricao:
      "Os 5.570 municípios brasileiros (código IBGE, nome e UF) — a base para navegar os dados por estado e município.",
    granularidade: "cadastro",
    rota: null,
    tarefas: ["ibge"],
    tabelas: ["ibge_municipios_cache"],
    janela: null,
    recorte: null,
    indice: ["ibge_municipios_cache"],
  },
  {
    id: "convenios_origem",
    titulo: "Transferegov — situação e execução dos convênios",
    descricao:
      "Situação e execução financeira (empenhado, desembolsado) de cada convênio, lidas dos arquivos oficiais do Transferegov — informação que só a origem publica.",
    granularidade: "cadastro",
    rota: "/convenios",
    tarefas: ["convenios_origem"],
    tabelas: ["convenios_cache"],
    janela: null,
    recorte: null,
    indice: ["convenios_cache"],
  },
  {
    id: "tse",
    titulo: "TSE — eleições (candidatos, bens, votos e contas)",
    descricao:
      "Dados abertos eleitorais de 1998 em diante (bens a partir de 2006, contas a partir de 2012).",
    granularidade: "ano",
    rota: "/eleicoes",
    tarefas: [
      "tse_arquivo",
      "tse_ponte",
      "tse_lacunas",
      "tse_sinais",
      "cruzamento_doador_fornecedor",
    ],
    tabelas: [
      "tse_candidatos_cache",
      "tse_bens_candidato_cache",
      "tse_receitas_campanha_cache",
      "tse_despesas_campanha_cache",
      "tse_resultados_cache",
    ],
    janela: "tse",
    recorte: "eleicao",
    indice: [
      "tse_candidatos_cache",
      "tse_bens_candidato_cache",
      "tse_receitas_campanha_cache",
      "tse_despesas_campanha_cache",
      "tse_resultados_cache",
    ],
    fonteHistorico: "tse_candidatos",
  },
];

export function entradaCatalogoCobertura(id: string): EntradaCatalogoCobertura {
  const e = CATALOGO_COBERTURA.find((x) => x.id === id);
  if (!e) throw new Error(`Fonte "${id}" fora do catálogo de cobertura.`);
  return e;
}
