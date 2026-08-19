/**
 * Cliente da API DivulgaCandContas do TSE — usado APENAS para revalidação
 * pontual e frescor (a carga em massa vem do CKAN; ver client-ckan.ts).
 *
 * A API não é oficialmente documentada (é a API interna do site
 * divulgacandcontas.tse.jus.br) e pode mudar sem aviso. Endpoints confirmados
 * por inspeção ao vivo (2026-07-06):
 *   GET /divulga/rest/v1/eleicao/ordinarias
 *   GET /divulga/rest/v1/candidatura/buscar/{ano}/{sgUe}/{idEleicao}/candidato/{sq}
 *
 * Hoje é pública sem chave. Se o TSE passar a exigir token, criar o secret
 * TSE_API_KEY e anexá-lo aqui (mesmo mecanismo do PORTAL_TRANSPARENCIA_API_KEY).
 *
 * Mesmo padrão do portal-client.ts: retries com backoff em 429/5xx/rede,
 * user-agent de navegador.
 */

export const DIVULGA_BASE = "https://divulgacandcontas.tse.jus.br/divulga/rest/v1";

const RETRY_DELAYS_MS = [500, 1500, 4500];

const HEADERS = {
  accept: "application/json",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
};

export async function divulgaGet<T = unknown>(path: string): Promise<T> {
  const url = `${DIVULGA_BASE}${path}`;
  let lastErr: Error | null = null;
  for (let tentativa = 0; tentativa <= RETRY_DELAYS_MS.length; tentativa++) {
    let res: Response;
    try {
      res = await fetch(url, { headers: HEADERS });
    } catch (e) {
      lastErr = new Error(
        `TRANSIENT: DivulgaCandContas indisponível (rede): ${(e as Error).message}`,
      );
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[Math.min(tentativa, 2)]));
      continue;
    }
    if (res.ok) {
      const texto = await res.text();
      if (!texto) throw new Error(`DivulgaCandContas devolveu corpo vazio em ${path}`);
      try {
        return JSON.parse(texto) as T;
      } catch {
        throw new Error(
          `DivulgaCandContas devolveu JSON inválido em ${path}: ${texto.slice(0, 120)}`,
        );
      }
    }
    if (res.status === 429 || res.status >= 500) {
      lastErr = new Error(`TRANSIENT: DivulgaCandContas ${res.status}`);
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[Math.min(tentativa, 2)]));
      continue;
    }
    throw new Error(`DivulgaCandContas ${res.status} em ${path}`);
  }
  throw lastErr ?? new Error("TRANSIENT: DivulgaCandContas indisponível");
}

export type DivulgaEleicao = {
  id: number;
  ano: number;
  nomeEleicao: string;
  tipoAbrangencia: string; // "F" | "M"
};

let catalogoEleicoes: DivulgaEleicao[] | null = null;

/** Catálogo de eleições ordinárias (id interno do Divulga por ano). Cacheado. */
export async function listarEleicoesOrdinarias(): Promise<DivulgaEleicao[]> {
  if (catalogoEleicoes) return catalogoEleicoes;
  const lista = await divulgaGet<DivulgaEleicao[]>("/eleicao/ordinarias");
  catalogoEleicoes = lista.filter((e) => e.ano >= 1998);
  return catalogoEleicoes;
}

/** Id do Divulga para (ano). Ex.: 2022 → 2040602022; 2014 → 680. */
export async function idEleicaoDivulga(ano: number): Promise<number | null> {
  const lista = await listarEleicoesOrdinarias();
  // Anos com mais de uma entrada (2020 tem AP apartado): fica a abrangente.
  const doAno = lista.filter((e) => e.ano === ano);
  if (doAno.length === 0) return null;
  const semSufixo = doAno.find((e) => !/- ?[A-Z]{2}$/.test(e.nomeEleicao.trim()));
  return (semSufixo ?? doAno[0]).id;
}

export type DivulgaCandidato = {
  id: number;
  nomeUrna: string;
  nomeCompleto: string;
  numero: number;
  descricaoSituacao: string | null;
  descricaoTotalizacao?: string | null;
  cpf: string | null;
  gastoCampanha1T?: number | null;
  gastoCampanha2T?: number | null;
  dataDeNascimento?: string | null;
};

/**
 * Detalhe fresco de um candidato. `sgUe` = UF nas gerais, código da UE nas
 * municipais (mesmo `SG_UE`/`SG_UF` do CSV).
 */
export async function buscarCandidatoDivulga(
  ano: number,
  sgUe: string,
  sqCandidato: string,
): Promise<DivulgaCandidato | null> {
  const idEleicao = await idEleicaoDivulga(ano);
  if (!idEleicao) return null;
  try {
    return await divulgaGet<DivulgaCandidato>(
      `/candidatura/buscar/${ano}/${encodeURIComponent(sgUe)}/${idEleicao}/candidato/${encodeURIComponent(sqCandidato)}`,
    );
  } catch (e) {
    // Corpo vazio = candidato não encontrado nessa combinação (ex.: UE errada).
    if ((e as Error).message.includes("corpo vazio")) return null;
    throw e;
  }
}
