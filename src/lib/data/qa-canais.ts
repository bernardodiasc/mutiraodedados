/**
 * Catálogo estático de canais oficiais para reporte de inconsistências
 * por fonte. Quando o defeito está confirmado na fonte (não é bug nosso),
 * a UX de denúncia oficial usa esse mapa para sugerir canal, URL,
 * instruções e email secundário.
 */

export type CanalReporte = {
  fonte: string;
  fonteLabel: string;
  orgao: string;
  canalPrimario: string;
  urlReporte: string;
  tipoManifestacao?: string;
  emailSecundario?: string;
  instrucoes: string;
};

export const QA_CANAIS: Record<string, CanalReporte> = {
  cgu: {
    fonte: "cgu",
    fonteLabel: "Portal da Transparência (CGU)",
    orgao: "Controladoria-Geral da União (CGU)",
    canalPrimario: "Fala.BR",
    urlReporte:
      "https://falabr.cgu.gov.br/publico/Manifestacao/SelecionarTipoManifestacao.aspx",
    tipoManifestacao: "Comunicação",
    emailSecundario: "portaldatransparencia@cgu.gov.br",
    instrucoes:
      "No Fala.BR, escolha 'Comunicação' como tipo de manifestação e selecione a CGU como órgão destinatário. Cole o texto sugerido, anexe links e salve o número de protocolo gerado.",
  },
  cgu_licitacoes: {
    fonte: "cgu_licitacoes",
    fonteLabel: "Portal da Transparência (CGU) — Licitações",
    orgao: "Controladoria-Geral da União (CGU)",
    canalPrimario: "Fala.BR",
    urlReporte:
      "https://falabr.cgu.gov.br/publico/Manifestacao/SelecionarTipoManifestacao.aspx",
    tipoManifestacao: "Comunicação",
    emailSecundario: "portaldatransparencia@cgu.gov.br",
    instrucoes:
      "No Fala.BR, escolha 'Comunicação' e selecione a CGU. Cite o número da licitação e o número do processo, e cole o texto sugerido com os links.",
  },
  cgu_emendas: {
    fonte: "cgu_emendas",
    fonteLabel: "Portal da Transparência (CGU) — Emendas",
    orgao: "Controladoria-Geral da União (CGU)",
    canalPrimario: "Fala.BR",
    urlReporte:
      "https://falabr.cgu.gov.br/publico/Manifestacao/SelecionarTipoManifestacao.aspx",
    tipoManifestacao: "Comunicação",
    emailSecundario: "portaldatransparencia@cgu.gov.br",
    instrucoes:
      "No Fala.BR, escolha 'Comunicação' e selecione a CGU. Cite o código da emenda e o ano, e cole o texto sugerido com os links.",
  },
  cgu_convenios: {
    fonte: "cgu_convenios",
    fonteLabel: "Portal da Transparência (CGU) — Convênios",
    orgao: "Controladoria-Geral da União (CGU)",
    canalPrimario: "Fala.BR",
    urlReporte:
      "https://falabr.cgu.gov.br/publico/Manifestacao/SelecionarTipoManifestacao.aspx",
    tipoManifestacao: "Comunicação",
    emailSecundario: "portaldatransparencia@cgu.gov.br",
    instrucoes:
      "No Fala.BR, escolha 'Comunicação' e selecione a CGU. Cite o número do convênio e o órgão concedente, e cole o texto sugerido com os links.",
  },
  pncp: {
    fonte: "pncp",
    fonteLabel: "Portal Nacional de Contratações Públicas (PNCP)",
    orgao: "Ministério da Gestão e Inovação — Compras.gov.br",
    canalPrimario: "Suporte Compras.gov.br",
    urlReporte: "https://www.gov.br/compras/pt-br/atendimento",
    emailSecundario: "comprasnet@economia.gov.br",
    instrucoes:
      "Abra chamado no atendimento do Compras.gov.br informando o numeroControlePNCP e a divergência observada.",
  },
  camara_ceap: {
    fonte: "camara_ceap",
    fonteLabel: "Câmara dos Deputados — CEAP",
    orgao: "Câmara dos Deputados",
    canalPrimario: "Serviço de Informação ao Cidadão (SIC)",
    urlReporte: "https://www2.camara.leg.br/transparencia/acesso-a-informacao/sic",
    emailSecundario: "sic@camara.leg.br",
    instrucoes:
      "Use o SIC da Câmara para reportar a inconsistência. Inclua o cod_documento e o id do deputado.",
  },
  senado_ceaps: {
    fonte: "senado_ceaps",
    fonteLabel: "Senado Federal — CEAPS",
    orgao: "Senado Federal",
    canalPrimario: "Serviço de Informação ao Cidadão (SIC)",
    urlReporte: "https://www12.senado.leg.br/transparencia/sic",
    emailSecundario: "sic@senado.leg.br",
    instrucoes:
      "Abra solicitação no SIC do Senado citando o codigoParlamentar e o id do documento.",
  },
  transferegov: {
    fonte: "transferegov",
    fonteLabel: "Transferegov",
    orgao: "Ministério da Gestão e Inovação — Transferegov",
    canalPrimario: "Suporte Transferegov",
    urlReporte: "https://www.gov.br/transferegov/pt-br",
    emailSecundario: "duvidas.transferegov@economia.gov.br",
    instrucoes:
      "Reporte pela página de suporte do Transferegov, mencionando número do instrumento.",
  },
  siconfi: {
    fonte: "siconfi",
    fonteLabel: "SICONFI (STN/Tesouro Nacional)",
    orgao: "Secretaria do Tesouro Nacional",
    canalPrimario: "Suporte SICONFI",
    urlReporte: "https://siconfi.tesouro.gov.br/siconfi/index.jsf",
    emailSecundario: "siconfi@tesouro.gov.br",
    instrucoes:
      "Use o suporte do SICONFI informando ente, exercício, anexo e coluna do valor inconsistente.",
  },
};

export function canalParaFonte(fonte: string): CanalReporte | null {
  return QA_CANAIS[fonte] ?? null;
}