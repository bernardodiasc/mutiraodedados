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
 * Ficha do candidato no DivulgaCandContas (TSE). O id interno da eleição no
 * Divulga foi confirmado ao vivo via /eleicao/ordinarias (2026-07-06) — ver
 * docs/fontes/tse.ia.md. `ue` = UF nas eleições gerais, código da unidade
 * eleitoral nas municipais (mesmo SG_UE/SG_UF dos CSVs).
 */
const DIVULGA_ELEICAO_ID: Record<number, number> = {
  2014: 680,
  2016: 2,
  2018: 2022802018,
  2020: 2030402020,
  2022: 2040602022,
  2024: 2045202024,
};

export function linkDivulgaCandidato(
  ano: number,
  ue: string | null | undefined,
  sqCandidato: string,
): string {
  const idEleicao = DIVULGA_ELEICAO_ID[ano];
  if (!idEleicao || !ue) return "https://divulgacandcontas.tse.jus.br/divulga/#/home";
  return `https://divulgacandcontas.tse.jus.br/divulga/#/candidato/${ano}/${idEleicao}/${encodeURIComponent(ue)}/${encodeURIComponent(sqCandidato)}`;
}
