/**
 * Política de retry HTTP única do projeto.
 *
 * Antes da v0.3.0 cada fonte tinha a sua: a CGU tentava 2× com espera fixa, o
 * PNCP 2×, o CKAN 4× com backoff, o SICONFI nenhuma. Uma importação histórica
 * longa depende de sobreviver a instabilidade da origem, então a política
 * passou a ser uma só — configurável por fonte quando houver motivo, nunca
 * reimplementada.
 *
 * O que é comum a todas as fontes:
 * - erro de rede, 429 e 5xx são transitórios → nova tentativa;
 * - 4xx (exceto 429) é definitivo → devolve na hora, quem chamou decide;
 * - a mensagem de erro de cada fonte continua sendo dela. Este módulo não
 *   formata mensagem: devolve a `Response` (mesmo com status ruim) ou lança o
 *   erro de rede da última tentativa.
 *
 * Sobre o prefixo `TRANSIENT:` — os ingests marcam assim as mensagens de falha
 * passageira, e o painel admin usa isso para abrir o circuito depois de três
 * seguidas. Quem chama continua responsável por esse prefixo; use
 * {@link ehStatusTransitorio} para decidir.
 */

export type PoliticaRetry = {
  /** Total de tentativas, incluindo a primeira. `1` desliga o retry. */
  tentativas: number;
  /** Espera antes da 2ª tentativa; as seguintes multiplicam por `fator`. */
  baseDelayMs: number;
  fator: number;
  /** Limite superior da espera, para o backoff não explodir. */
  tetoMs: number;
  /**
   * Espalha as esperas em ±25%. Sem isso, várias rodadas que falham juntas
   * voltam juntas e mantêm a origem sobrecarregada.
   */
  jitter: boolean;
};

/** 4 tentativas, 500ms → 1,5s → 4,5s. Herdada do cliente CKAN, a mais robusta. */
export const RETRY_PADRAO: PoliticaRetry = {
  tentativas: 4,
  baseDelayMs: 500,
  fator: 3,
  tetoMs: 10_000,
  jitter: true,
};

export function ehStatusTransitorio(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Espera antes da tentativa `n` (1-based: `n=2` é a primeira reexecução).
 * Fora do backoff, o jitter multiplica por algo entre 0,75 e 1,25.
 */
export function atrasoDaTentativa(
  n: number,
  politica: PoliticaRetry = RETRY_PADRAO,
  aleatorio: () => number = Math.random,
): number {
  if (n <= 1) return 0;
  const cru = politica.baseDelayMs * Math.pow(politica.fator, n - 2);
  const limitado = Math.min(cru, politica.tetoMs);
  if (!politica.jitter) return Math.round(limitado);
  return Math.round(limitado * (0.75 + aleatorio() * 0.5));
}

/**
 * Lê `Retry-After` (segundos ou data HTTP). A origem sabe melhor que a gente
 * quando voltar; respeitar isso evita levar bloqueio por insistência.
 */
export function atrasoDoRetryAfter(valor: string | null, agoraMs: number): number | null {
  if (!valor) return null;
  const segundos = Number(valor.trim());
  if (Number.isFinite(segundos) && segundos >= 0) return Math.round(segundos * 1000);
  const data = Date.parse(valor);
  if (Number.isNaN(data)) return null;
  return Math.max(0, data - agoraMs);
}

export type OpcoesFetchRetry = {
  politica?: Partial<PoliticaRetry>;
  /** Injetáveis para teste — em produção use os padrões. */
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
  aleatorio?: () => number;
  agora?: () => number;
};

const sleepPadrao = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * `fetch` com retry em erro de rede, 429 e 5xx.
 *
 * Devolve a `Response` da última tentativa — inclusive quando ela é 5xx, para
 * quem chamou montar a mensagem da sua fonte. Só lança quando nenhuma
 * tentativa chegou a ter resposta (falha de rede em todas).
 */
export async function fetchComRetry(
  url: string,
  init?: RequestInit,
  opcoes: OpcoesFetchRetry = {},
): Promise<Response> {
  const politica = { ...RETRY_PADRAO, ...opcoes.politica };
  const fetchImpl = opcoes.fetchImpl ?? fetch;
  const sleepImpl = opcoes.sleepImpl ?? sleepPadrao;
  const aleatorio = opcoes.aleatorio ?? Math.random;
  const agora = opcoes.agora ?? Date.now;

  let ultimoErroRede: Error | null = null;
  let ultimaResposta: Response | null = null;

  for (let n = 1; n <= politica.tentativas; n++) {
    if (n > 1) {
      const doServidor = ultimaResposta
        ? atrasoDoRetryAfter(ultimaResposta.headers.get("retry-after"), agora())
        : null;
      await sleepImpl(doServidor ?? atrasoDaTentativa(n, politica, aleatorio));
    }
    try {
      const res = await fetchImpl(url, init);
      if (res.ok || !ehStatusTransitorio(res.status)) return res;
      ultimaResposta = res;
      ultimoErroRede = null;
    } catch (e) {
      ultimoErroRede = e as Error;
      ultimaResposta = null;
    }
  }

  if (ultimaResposta) return ultimaResposta;
  throw ultimoErroRede ?? new Error(`Falha ao buscar ${url}`);
}
