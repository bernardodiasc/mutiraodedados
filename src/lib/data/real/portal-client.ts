/**
 * Cliente HTTP único do Portal da Transparência (CGU).
 *
 * Tanto `portal.functions.ts` (contratos) quanto
 * `transferegov/ingest.functions.ts` (convênios) usam este módulo. Toda
 * particularidade da API mora aqui:
 *
 * - chave + headers
 * - retries com backoff em erros transitórios (5xx / 429 / rede)
 * - `preservarNumerosBR`: o JSON da CGU envia campos monetários como
 *   números decimais (ex.: `117560.3000`); convertemos esses campos pra
 *   string ANTES do `JSON.parse` para preservar as casas decimais
 *   originais e deixar o parser numérico autoritativo.
 * - `parseValorPortal`: parser único de moeda (aceita number ou string,
 *   formato americano com qualquer número de casas OU pt-BR com vírgula
 *   decimal).
 * - `corrigirComDetalhe`: helper genérico. Quando algum valor da
 *   listagem cair abaixo do limiar de suspeita, busca o detalhe
 *   correspondente e compara. Retorna `corrigido: true` se a diferença
 *   for >5% (ou seja: o detalhe é DIFERENTE da listagem) — só então o
 *   ingest deve registrar QA finding de auto-correção.
 *
 * Importante: a heurística de "suspeita" usa o MESMO limiar das regras
 * de QA (`< 100`) — abaixo disso, o registro provavelmente sofreu
 * algum tipo de truncamento. Acima, confiamos na listagem e NÃO
 * pagamos a latência do detalhe.
 */

export const PORTAL_BASE = "https://api.portaldatransparencia.gov.br/api-de-dados";

const CAMPOS_NUMERICOS_BR = [
  "valorInicialCompra",
  "valorFinalCompra",
  "valor",
  "valorLiberado",
  "valorContrapartida",
  "valorContratado",
  "valorEmpenhado",
  "valorLiquidado",
  "valorPago",
];

function preservarNumerosBR(jsonText: string): string {
  let out = jsonText;
  for (const campo of CAMPOS_NUMERICOS_BR) {
    const re = new RegExp(`"${campo}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`, "g");
    out = out.replace(re, `"${campo}":"$1"`);
  }
  return out;
}

/**
 * Parser de valor monetário do Portal da Transparência.
 *
 * Regra: decimal americano (sem vírgula) é decimal puro de qualquer
 * tamanho; havendo vírgula, ela é o separador decimal e pontos são
 * separadores de milhar pt-BR. NÃO existe regra de "×10.000".
 */
export function parseValorPortal(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v !== "string") return 0;
  const s = v.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!s) return 0;
  let normalizado: string;
  if (s.includes(",")) {
    normalizado = s.replace(/\./g, "").replace(",", ".");
  } else {
    const partes = s.split(".");
    if (partes.length <= 2) {
      normalizado = s; // decimal americano (ou inteiro)
    } else {
      normalizado = s.replace(/\./g, ""); // milhar pt-BR
    }
  }
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Único limiar de "valor suspeito" do Portal. Valores monetários >0 e
 * <R$100 são tão raros em contratos/convênios reais que vale o custo
 * de uma chamada de detalhe pra confirmar. Acima disso, NÃO consultamos
 * o detalhe — confiamos na listagem.
 *
 * Alinhado com a regra de QA `valor_truncado_suspeito` (também < 100).
 */
export const PORTAL_LIMIAR_SUSPEITA = 100;

export function valorPortalSuspeito(valor: number): boolean {
  return valor > 0 && valor < PORTAL_LIMIAR_SUSPEITA;
}

/**
 * GET no Portal, com:
 * - chave-api-dados a partir de PORTAL_TRANSPARENCIA_API_KEY
 * - retry 2× em 5xx/429/rede (mensagem prefixada "TRANSIENT: ...")
 * - preservarNumerosBR antes do JSON.parse (mantém casas decimais)
 */
export async function portalGet<T = unknown>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const key = process.env.PORTAL_TRANSPARENCIA_API_KEY;
  if (!key) throw new Error("PORTAL_TRANSPARENCIA_API_KEY não configurada no servidor.");
  const qs = new URLSearchParams(params).toString();
  const url = `${PORTAL_BASE}${path}?${qs}`;
  const headers = {
    "chave-api-dados": key,
    accept: "application/json",
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
  };
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { headers });
    } catch (e) {
      lastErr = new Error(`TRANSIENT: Portal indisponível (rede): ${(e as Error).message}`);
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    const ct = res.headers.get("content-type") ?? "";
    if (res.ok) {
      const text = await res.text();
      if (!ct.includes("application/json")) {
        throw new Error(`Portal respondeu não-JSON (${ct.slice(0, 40)}): ${text.slice(0, 160)}`);
      }
      try {
        return JSON.parse(preservarNumerosBR(text)) as T;
      } catch {
        throw new Error(`Portal retornou JSON inválido: ${text.slice(0, 160)}`);
      }
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error("Chave do Portal inválida ou sem permissão.");
    }
    const transient = res.status >= 500 || res.status === 429;
    const body = await res.text().catch(() => "");
    const snippet = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
    const msg = transient
      ? `TRANSIENT: Portal ${res.status} (serviço indisponível${snippet ? ` — ${snippet}` : ""})`
      : `Portal API ${res.status}: ${snippet}`;
    lastErr = new Error(msg);
    if (!transient) throw lastErr;
    if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
  }
  throw lastErr ?? new Error("TRANSIENT: Portal indisponível");
}

export type CorrigirComDetalheResult<T> = {
  /** Valores finais (corrigidos pelo detalhe ou idênticos à listagem). */
  valores: T;
  /**
   * `true` quando o detalhe diferiu da listagem em >5% em algum campo —
   * caso em que o chamador DEVE registrar um QA finding documentando
   * a auto-correção. `false` significa "nada a reportar" (heurística
   * não disparou OU disparou mas detalhe confirmou a listagem).
   */
  corrigido: boolean;
  /** Valores originais da listagem, presentes quando `corrigido = true`. */
  valoresOriginais?: T;
  /**
   * `false` quando a heurística disparou mas TODAS as tentativas de
   * buscar o detalhe falharam — o chamador deve pular esse registro
   * (não importar valor possivelmente errado).
   */
  ok: boolean;
};

/**
 * Helper genérico de "valida via detalhe quando a listagem cheira mal".
 *
 * `valoresLista` é um objeto cujas chaves são os campos monetários
 * do registro (ex.: `{ valor_global, valor_repasse }`). Se nenhum
 * for suspeito, devolve o próprio objeto sem chamar a rede.
 */
export async function corrigirComDetalhe<T extends Record<string, number>>(opts: {
  id: string;
  endpointDetalhe: string;
  valoresLista: T;
  /** Recebe o JSON do detalhe e devolve os mesmos campos do `valoresLista`. */
  extrairDoDetalhe: (detalhe: unknown) => Partial<Record<keyof T, number>>;
  /** Tentativas em caso de erro transitório. Default 5 (0.5s … 8s). */
  maxTentativas?: number;
}): Promise<CorrigirComDetalheResult<T>> {
  const algumSuspeito = (Object.values(opts.valoresLista) as number[]).some(
    valorPortalSuspeito,
  );
  if (!algumSuspeito) {
    return { valores: opts.valoresLista, corrigido: false, ok: true };
  }
  const maxTentativas = opts.maxTentativas ?? 5;
  let ultimoErro: Error | null = null;
  for (let tentativa = 0; tentativa < maxTentativas; tentativa++) {
    try {
      const det = await portalGet(opts.endpointDetalhe, { id: opts.id });
      const extr = opts.extrairDoDetalhe(det);
      const novos = { ...opts.valoresLista } as T;
      for (const k of Object.keys(extr) as (keyof T)[]) {
        const v = extr[k];
        if (typeof v === "number" && v > 0) {
          (novos as Record<keyof T, number>)[k] = v;
        }
      }
      const corrigido = (Object.keys(novos) as (keyof T)[]).some((k) => {
        const antes = opts.valoresLista[k];
        const depois = (novos as Record<keyof T, number>)[k];
        return (
          antes > 0 &&
          depois > 0 &&
          Math.abs(antes - depois) > Math.max(antes, depois) * 0.05
        );
      });
      return {
        valores: novos,
        corrigido,
        valoresOriginais: corrigido ? opts.valoresLista : undefined,
        ok: true,
      };
    } catch (e) {
      ultimoErro = e as Error;
      const msg = ultimoErro.message ?? "";
      const transient = msg.startsWith("TRANSIENT");
      if (!transient || tentativa === maxTentativas - 1) break;
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, tentativa)));
    }
  }
  return {
    valores: opts.valoresLista,
    corrigido: false,
    ok: false,
  };
}