import type { Orgao } from "./types";

/**
 * Catálogo de órgãos federais reconhecidos pela plataforma.
 *
 * Inclui Executivo (cobertos por `/contratos` do Portal da Transparência),
 * Legislativo, Judiciário e MPU (que possuem APIs próprias e ainda não estão
 * conectadas — marcados com `disponivelPortal: false` para deixar isso
 * explícito no UI).
 *
 * Códigos SIAFI seguem o padrão usado pelo Portal da Transparência (CGU).
 */
export const ORGAOS_BASE: Orgao[] = [
  // ===== Executivo — Ministérios =====
  { cod: "20101", sigla: "PR", nome: "Presidência da República", funcao: "Administração", poder: "executivo", disponivelPortal: true },
  { cod: "22000", sigla: "MAPA", nome: "Ministério da Agricultura e Pecuária", funcao: "Agricultura", poder: "executivo", disponivelPortal: true },
  { cod: "24000", sigla: "MCTI", nome: "Ministério da Ciência, Tecnologia e Inovação", funcao: "Ciência e Tecnologia", poder: "executivo", disponivelPortal: true },
  { cod: "25000", sigla: "MF", nome: "Ministério da Fazenda", funcao: "Fazenda", poder: "executivo", disponivelPortal: true },
  { cod: "26000", sigla: "MEC", nome: "Ministério da Educação", funcao: "Educação", poder: "executivo", disponivelPortal: true },
  { cod: "30000", sigla: "MJSP", nome: "Ministério da Justiça e Segurança Pública", funcao: "Justiça", poder: "executivo", disponivelPortal: true },
  { cod: "32000", sigla: "MME", nome: "Ministério de Minas e Energia", funcao: "Energia", poder: "executivo", disponivelPortal: true },
  { cod: "33000", sigla: "MPS", nome: "Ministério da Previdência Social", funcao: "Previdência", poder: "executivo", disponivelPortal: true },
  { cod: "35000", sigla: "MRE", nome: "Ministério das Relações Exteriores", funcao: "Relações Exteriores", poder: "executivo", disponivelPortal: true },
  { cod: "36000", sigla: "MS", nome: "Ministério da Saúde", funcao: "Saúde", poder: "executivo", disponivelPortal: true },
  { cod: "38000", sigla: "MTE", nome: "Ministério do Trabalho e Emprego", funcao: "Trabalho", poder: "executivo", disponivelPortal: true },
  { cod: "39000", sigla: "MT", nome: "Ministério dos Transportes", funcao: "Transporte", poder: "executivo", disponivelPortal: true },
  { cod: "40000", sigla: "MDIC", nome: "Ministério do Desenvolvimento, Indústria, Comércio e Serviços", funcao: "Indústria e Comércio", poder: "executivo", disponivelPortal: true },
  { cod: "42000", sigla: "MinC", nome: "Ministério da Cultura", funcao: "Cultura", poder: "executivo", disponivelPortal: true },
  { cod: "44000", sigla: "MMA", nome: "Ministério do Meio Ambiente e Mudança do Clima", funcao: "Gestão Ambiental", poder: "executivo", disponivelPortal: true },
  { cod: "51000", sigla: "MEsp", nome: "Ministério do Esporte", funcao: "Esporte", poder: "executivo", disponivelPortal: true },
  { cod: "52000", sigla: "MD", nome: "Ministério da Defesa", funcao: "Defesa Nacional", poder: "executivo", disponivelPortal: true },
  { cod: "53000", sigla: "MIDR", nome: "Ministério da Integração e do Desenvolvimento Regional", funcao: "Desenvolvimento Regional", poder: "executivo", disponivelPortal: true },
  { cod: "54000", sigla: "MTur", nome: "Ministério do Turismo", funcao: "Turismo", poder: "executivo", disponivelPortal: true },
  { cod: "55000", sigla: "MDS", nome: "Ministério do Desenvolvimento e Assistência Social, Família e Combate à Fome", funcao: "Assistência Social", poder: "executivo", disponivelPortal: true },
  { cod: "56000", sigla: "MCID", nome: "Ministério das Cidades", funcao: "Urbanismo", poder: "executivo", disponivelPortal: true },

  // ===== Legislativo (cota parlamentar / CEAP, despesas administrativas) =====
  {
    cod: "01000",
    sigla: "CD",
    nome: "Câmara dos Deputados",
    funcao: "Legislativo",
    poder: "legislativo",
    disponivelPortal: false,
    rotaPropria: "/camara",
    nota: "Integração ativa via dadosabertos.camara.leg.br — deputados, despesas CEAP, proposições e votações nominais disponíveis em /camara.",
  },
  {
    cod: "02000",
    sigla: "SF",
    nome: "Senado Federal",
    funcao: "Legislativo",
    poder: "legislativo",
    disponivelPortal: false,
    rotaPropria: "/senado",
    nota: "Integração ativa via legis.senado.leg.br/dadosabertos — senadores, CEAPS, matérias e votações.",
  },
  {
    cod: "03000",
    sigla: "TCU",
    nome: "Tribunal de Contas da União",
    funcao: "Controle Externo",
    poder: "legislativo",
    disponivelPortal: false,
    nota: "Dados em dadosabertos.tcu.gov.br — integração planejada.",
  },

  // ===== Judiciário =====
  { cod: "10000", sigla: "STF", nome: "Supremo Tribunal Federal", funcao: "Judiciário", poder: "judiciario", disponivelPortal: false, nota: "Portal de Transparência próprio do STF — integração planejada." },
  { cod: "11000", sigla: "STJ", nome: "Superior Tribunal de Justiça", funcao: "Judiciário", poder: "judiciario", disponivelPortal: false, nota: "Dados via CNJ/STJ — integração planejada." },
  { cod: "12000", sigla: "JF", nome: "Justiça Federal", funcao: "Judiciário", poder: "judiciario", disponivelPortal: false },
  { cod: "13000", sigla: "JT", nome: "Justiça do Trabalho", funcao: "Judiciário", poder: "judiciario", disponivelPortal: false },
  { cod: "14000", sigla: "JE", nome: "Justiça Eleitoral", funcao: "Judiciário", poder: "judiciario", disponivelPortal: false },

  // ===== Ministério Público da União =====
  { cod: "34000", sigla: "MPU", nome: "Ministério Público da União", funcao: "Essencial à Justiça", poder: "mpu", disponivelPortal: false, nota: "Inclui MPF, MPT, MPM e MPDFT — integração planejada." },

  // ===== Estados e Municípios (cobertura nacional via agregadores) =====
  {
    cod: "PNCP",
    sigla: "PNCP",
    nome: "Contratações Públicas (União/Estados/Municípios)",
    funcao: "Cobertura Nacional",
    poder: "outros",
    disponivelPortal: false,
    rotaPropria: "/pncp",
    nota: "Portal Nacional de Contratações Públicas — cobre os 5.598 entes federados desde 2021.",
  },
  {
    cod: "SICONFI",
    sigla: "SICONFI",
    nome: "Receitas e Despesas dos Entes (Tesouro Nacional)",
    funcao: "Cobertura Nacional",
    poder: "outros",
    disponivelPortal: false,
    rotaPropria: "/siconfi",
    nota: "RREO, RGF e DCA padronizados de todos os estados e municípios.",
  },
  {
    cod: "TRANSF",
    sigla: "TRANSF",
    nome: "Convênios e Contratos de Repasse",
    funcao: "Cobertura Nacional",
    poder: "outros",
    disponivelPortal: false,
    rotaPropria: "/convenios",
    nota: "Transferegov/SICONV via espelho CGU — exige plano de trabalho e prestação de contas.",
  },
  {
    cod: "EMENDAS",
    sigla: "EMENDAS",
    nome: "Transferências diretas (EC 105 / emendas Pix)",
    funcao: "Cobertura Nacional",
    poder: "outros",
    disponivelPortal: false,
    rotaPropria: "/transferencias",
    nota: "Emendas parlamentares repassadas direto aos entes — Especiais (livre aplicação) e Finalidade Definida (carimbadas).",
  },
];

export const PODER_LABEL: Record<Orgao["poder"], string> = {
  executivo: "Executivo",
  legislativo: "Legislativo",
  judiciario: "Judiciário",
  mpu: "Ministério Público",
  outros: "Bases nacionais",
};

export const FUNCOES = Array.from(new Set(ORGAOS_BASE.map((o) => o.funcao)));