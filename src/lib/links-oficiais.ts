/**
 * Construtores de links para as fontes oficiais (Portal da Transparência, PNCP).
 *
 * Funções puras, client-safe (sem import de server) — usadas tanto no ingest
 * (para gravar `url_oficial`) quanto nas páginas (banner de cross-link).
 *
 * IMPORTANTE — chave de acoplamento PNCP: a API da CGU NÃO expõe o
 * `numeroControlePNCP`/`idContratacaoPncp` (confirmado por inspeção ao vivo dos
 * endpoints /contratos, /contratos/id e /licitacoes — nenhum campo "pncp"). Os
 * documentos de referência descrevem esse acoplamento de forma conceitual, mas
 * ele não está nos dados. Por isso o cross-link Portal→PNCP é um link de BUSCA
 * (por CNPJ do órgão + número), não um deep-link determinístico. Essa é a
 * "fratura de ID" que os próprios artigos citam.
 */

/** Só dígitos (CNPJ/CPF/número vêm formatados da CGU). */
function soDigitos(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

/**
 * Busca assistida no PNCP a partir do que a CGU fornece (CNPJ do órgão +
 * número da compra/processo). Não é deep-link — abre a busca do PNCP já
 * semeada com o termo. Degrada para a listagem de editais quando sem termo.
 */
export function linkBuscaPncp(args: { cnpjOrgao?: string | null; numero?: string | null }): string {
  const termo = [soDigitos(args.cnpjOrgao), (args.numero ?? "").trim()]
    .filter(Boolean)
    .join(" ")
    .trim();
  return termo
    ? `https://pncp.gov.br/app/editais?q=${encodeURIComponent(termo)}`
    : "https://pncp.gov.br/app/editais";
}

/**
 * Consulta da licitação no Portal da Transparência. A página por id dá 404 (id
 * da API ≠ id do site), então usamos a busca por órgão (mesmo padrão de
 * contratos em qa.functions.ts).
 */
export function linkConsultaLicitacaoPortal(args: { orgaoCod?: string | null }): string {
  const base = "https://portaldatransparencia.gov.br/licitacoes";
  return args.orgaoCod ? `${base}?orgaos=OS${encodeURIComponent(args.orgaoCod)}` : base;
}

/** Consulta da emenda no Portal da Transparência por código da emenda. */
export function linkConsultaEmendaPortal(codigoEmenda: string | null | undefined): string {
  const base = "https://portaldatransparencia.gov.br/emendas";
  return codigoEmenda ? `${base}/consulta?codigoEmenda=${encodeURIComponent(codigoEmenda)}` : base;
}

/** Consulta do convênio no Portal da Transparência por número. */
export function linkConsultaConvenioPortal(numero: string | null | undefined): string {
  const base = "https://portaldatransparencia.gov.br/convenios";
  return numero ? `${base}/consulta?nrConvenio=${encodeURIComponent(numero)}` : base;
}

/**
 * Página do favorecido no Portal da Transparência. Não há URL única canônica
 * para fornecedor: CNPJ (14 dígitos) tem página de pessoa jurídica direta;
 * CPF (pessoa física) é anonimizado, então caímos na busca por termo.
 */
export function linkFornecedorPortal(cnpjOuCpf: string | null | undefined): string {
  const d = soDigitos(cnpjOuCpf);
  if (d.length === 14) return `https://portaldatransparencia.gov.br/pessoa-juridica/${d}`;
  return d
    ? `https://portaldatransparencia.gov.br/busca?termo=${encodeURIComponent(d)}`
    : "https://portaldatransparencia.gov.br/busca";
}

/**
 * Ficha do candidato no DivulgaCandContas (TSE).
 *
 * Ids confirmados ao vivo em `/eleicao/ordinarias` (última conferência:
 * 2026-08-08) — ver docs/fontes/tse.ia.md.
 */
const DIVULGA_ELEICAO_ID: Record<number, number> = {
  // 1998–2002 não têm eleição no catálogo do Divulga: as fichas desses anos
  // caem na home dele, o que é o melhor disponível.
  2004: 14431,
  2006: 14423,
  2008: 14422,
  2010: 14417,
  2012: 1699,
  2014: 680,
  2016: 2,
  2018: 2022802018,
  2020: 2030402020, // há também 2032002020 (municipais de AP) — caso à parte
  2022: 2040602022,
  2024: 2045202024,
  2026: 20322002026,
};

/**
 * Região do segmento de URL do Divulga.
 *
 * Só alimenta a trilha de navegação do site deles — verificado: `SUL/AC/...`
 * abre a ficha de um candidato do Acre sem reclamar. Por isso um estado que
 * falte aqui degrada a migalha de pão, não quebra o link.
 */
const DIVULGA_REGIAO: Record<string, string> = {
  AC: "NORTE",
  AP: "NORTE",
  AM: "NORTE",
  PA: "NORTE",
  RO: "NORTE",
  RR: "NORTE",
  TO: "NORTE",
  AL: "NORDESTE",
  BA: "NORDESTE",
  CE: "NORDESTE",
  MA: "NORDESTE",
  PB: "NORDESTE",
  PE: "NORDESTE",
  PI: "NORDESTE",
  RN: "NORDESTE",
  SE: "NORDESTE",
  DF: "CENTRO-OESTE",
  GO: "CENTRO-OESTE",
  MT: "CENTRO-OESTE",
  MS: "CENTRO-OESTE",
  ES: "SUDESTE",
  MG: "SUDESTE",
  RJ: "SUDESTE",
  SP: "SUDESTE",
  PR: "SUL",
  RS: "SUL",
  SC: "SUL",
  BR: "BRASIL", // cargos nacionais (presidente)
};

/**
 * Monta a URL da ficha oficial.
 *
 * Formato novo do Divulga (SPA 2.8.12, verificado em 2026-08-08):
 *   #/candidato/<REGIÃO>/<UF>/<idEleicao>/<sq>/<ano>/<UE>
 *
 * O formato anterior que usávamos — `#/candidato/<ano>/<id>/<UE>/<sq>` — passou
 * a devolver "ERRO AO CARREGAR A PÁGINA" em TODOS os anos, não só nos novos.
 *
 * `uf` é sempre a sigla do estado (SG_UF). `ue` é a unidade eleitoral (SG_UE):
 * igual à UF nas eleições gerais, código do município nas municipais. São
 * campos diferentes e não podem ser trocados — daí o objeto nomeado.
 */
export function linkDivulgaCandidato(args: {
  ano: number;
  uf: string | null | undefined;
  ue: string | null | undefined;
  sqCandidato: string;
}): string {
  const { ano, uf, ue, sqCandidato } = args;
  const idEleicao = DIVULGA_ELEICAO_ID[ano];
  if (!idEleicao || !uf || !ue) return "https://divulgacandcontas.tse.jus.br/divulga/#/home";
  const regiao = DIVULGA_REGIAO[uf.toUpperCase()] ?? "BRASIL";
  const p = [regiao, uf, idEleicao, sqCandidato, ano, ue].map((s) => encodeURIComponent(String(s)));
  return `https://divulgacandcontas.tse.jus.br/divulga/#/candidato/${p.join("/")}`;
}
