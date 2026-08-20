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
 */

export type GranularidadeCobertura = "mes" | "periodo" | "cadastro" | "ano";

export type EntradaCatalogoCobertura = {
  id: string;
  titulo: string;
  descricao: string;
  granularidade: GranularidadeCobertura;
  /** rota interna para explorar essa fonte; null quando não há página própria */
  rota: string | null;
};

export const CATALOGO_COBERTURA: EntradaCatalogoCobertura[] = [
  {
    id: "cgu",
    titulo: "Portal CGU — contratos do Executivo",
    descricao:
      "Contratos publicados pelo Portal da Transparência para órgãos do Executivo federal.",
    granularidade: "mes",
    rota: "/orgaos",
  },
  {
    id: "cgu_licitacoes",
    titulo: "Portal CGU — licitações do Executivo",
    descricao:
      "Licitações publicadas pelo Portal da Transparência para órgãos do Executivo federal.",
    granularidade: "mes",
    rota: "/licitacoes",
  },
  {
    id: "cgu_emendas",
    titulo: "Portal CGU — emendas parlamentares",
    descricao:
      "Emendas parlamentares (empenho, liquidação e pagamento) publicadas pelo Portal da Transparência, por ano.",
    granularidade: "ano",
    rota: "/emendas",
  },
  {
    id: "cgu_convenios",
    titulo: "Portal CGU — convênios",
    descricao:
      "Convênios e contratos de repasse da União, pelo endpoint /convenios do Portal da Transparência.",
    granularidade: "mes",
    rota: "/convenios",
  },
  {
    id: "pncp",
    titulo: "PNCP — contratos públicos",
    descricao:
      "Contratos publicados no Portal Nacional de Contratações Públicas (União, Estados, Municípios).",
    granularidade: "mes",
    rota: "/pncp",
  },
  {
    id: "transferegov",
    titulo: "Convênios por ente (Portal CGU)",
    descricao:
      "Convênios e contratos de repasse União ↔ Estados/Municípios, pelo ângulo de quem recebe. O Transferegov é o sistema de origem; a consulta é ao Portal da Transparência.",
    granularidade: "mes",
    rota: "/transferegov",
  },
  {
    id: "siconfi",
    titulo: "SICONFI — relatórios fiscais",
    descricao: "RREO/RGF/DCA por exercício e período (granularidade por período do ano).",
    granularidade: "periodo",
    rota: "/relatorios-fiscais",
  },
  {
    id: "camara_ceap",
    titulo: "Câmara — CEAP (cota parlamentar)",
    descricao: "Notas fiscais de cota parlamentar dos ~513 deputados federais.",
    granularidade: "mes",
    rota: "/camara/deputados",
  },
  {
    id: "camara_vot",
    titulo: "Câmara — votações nominais",
    descricao: "Votações registradas em plenário e comissões da Câmara.",
    granularidade: "mes",
    rota: "/camara/votacoes",
  },
  {
    id: "camara_props",
    titulo: "Câmara — proposições",
    descricao: "Proposições legislativas (PL, PEC, MPV…) com autores, por ano de apresentação.",
    granularidade: "ano",
    rota: "/camara/proposicoes",
  },
  {
    id: "camara_deputados",
    titulo: "Câmara — cadastro de deputados",
    descricao: "Cadastro vigente de parlamentares da Câmara dos Deputados.",
    granularidade: "cadastro",
    rota: "/camara/deputados",
  },
  {
    id: "senado_ceaps",
    titulo: "Senado — CEAPS (cota parlamentar)",
    descricao: "Notas fiscais de cota parlamentar dos 81 senadores.",
    granularidade: "mes",
    rota: "/senado/senadores",
  },
  {
    id: "senado_vot",
    titulo: "Senado — votações",
    descricao: "Votações registradas no Senado Federal.",
    granularidade: "mes",
    rota: "/senado/votacoes",
  },
  {
    id: "senado_mat",
    titulo: "Senado — matérias",
    descricao: "Matérias legislativas (PL, PEC, MPV…) com autores, por ano de apresentação.",
    granularidade: "ano",
    rota: "/senado/materias",
  },
  {
    id: "senado_senadores",
    titulo: "Senado — cadastro de senadores",
    descricao: "Cadastro vigente de parlamentares do Senado Federal.",
    granularidade: "cadastro",
    rota: "/senado/senadores",
  },
  {
    id: "orgaos_siafi",
    titulo: "Órgãos SIAFI — catálogo",
    descricao:
      "Catálogo de órgãos federais (código SIAFI) que ancora contratos e licitações da CGU.",
    granularidade: "cadastro",
    rota: "/orgaos",
  },
  {
    id: "ibge",
    titulo: "IBGE — cadastro de municípios",
    descricao:
      "Os 5.570 municípios brasileiros (código IBGE, nome e UF), base dos seletores de ente e das varreduras por município.",
    granularidade: "cadastro",
    rota: null,
  },
  {
    id: "convenios_origem",
    titulo: "Transferegov — enriquecimento pela origem",
    descricao:
      "Situação e execução financeira (empenhado, desembolsado) lidas do CSV oficial do SICONV e aplicadas aos convênios por código — o que só a origem publica.",
    granularidade: "cadastro",
    rota: "/convenios",
  },
  {
    id: "tse",
    titulo: "TSE — eleições (candidatos, bens, votos e contas)",
    descricao:
      "Dados abertos eleitorais de 1998 em diante (bens a partir de 2006, contas a partir de 2012).",
    granularidade: "ano",
    rota: "/eleicoes",
  },
];

export function entradaCatalogoCobertura(id: string): EntradaCatalogoCobertura {
  const e = CATALOGO_COBERTURA.find((x) => x.id === id);
  if (!e) throw new Error(`Fonte "${id}" fora do catálogo de cobertura.`);
  return e;
}
