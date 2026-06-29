/**
 * Cliente HTTP único do Portal da Transparência (CGU).
 *
 * Tanto `portal.functions.ts` (contratos) quanto
 * `transferegov/ingest.functions.ts` (convênios) usam este módulo. Toda
 * particularidade da API mora aqui:
 *
 * - chave + headers
 * - retries com backoff em erros transitórios (5xx / 429 / rede)
 * - `parseValorPortal`: parser de moeda. A CGU devolve `valorFinalCompra` /
 *   `valorInicialCompra` como number JSON, então o caminho number passa
 *   direto. O suporte a string fica como rede de segurança para campos
 *   livres ou variações pontuais ("R$ 1.234,56", "60.000").
 *
 * Princípio: o ingest grava exatamente o que a API devolve. Discrepâncias
 * são sinalizadas como findings de QA contra o cache pós-upsert (qa.ts),
 * nunca "auto-corrigidas".
 */

export const PORTAL_BASE = "https://api.portaldatransparencia.gov.br/api-de-dados";

/**
 * Parser único de valor monetário do Portal. Number passa direto;
 * string é normalizada como pt-BR ("1.234,56", "60.000") ou decimal
 * americano ("106226.64"). Nada de regras de escala.
 */
export function parseValorPortal(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v !== "string") return 0;
  const s = v.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!s) return 0;
  // pt-BR com vírgula decimal: "1.234.567,89" → "1234567.89".
  // pt-BR sem centavos: "60.000" → "60000" (sem isso, Number("60.000")=60).
  const pareceMilharPtBr = /^\d{1,3}(\.\d{3})+$/.test(s);
  const normalizado = s.includes(",")
    ? s.replace(/\./g, "").replace(",", ".")
    : pareceMilharPtBr
      ? s.replace(/\./g, "")
    : s;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : 0;
}

/**
 * GET no Portal, com:
 * - chave-api-dados a partir de PORTAL_TRANSPARENCIA_API_KEY
 * - retry 2× em 5xx/429/rede (mensagem prefixada "TRANSIENT: ...")
 */
async function portalFetch<T = unknown>(
  path: string,
  params: Record<string, string>,
): Promise<{ data: T; rawText: string }> {
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
      const rawText = await res.text();
      if (!ct.includes("application/json")) {
        throw new Error(`Portal respondeu não-JSON (${ct.slice(0, 40)}): ${rawText.slice(0, 160)}`);
      }
      try {
        return { data: JSON.parse(rawText) as T, rawText };
      } catch {
        throw new Error(`Portal retornou JSON inválido: ${rawText.slice(0, 160)}`);
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

export async function portalGet<T = unknown>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  return (await portalFetch<T>(path, params)).data;
}

// Como portalGet, mas também devolve o body bruto antes do JSON.parse.
export async function portalGetComTexto<T = unknown>(
  path: string,
  params: Record<string, string>,
): Promise<{ data: T; rawText: string }> {
  return portalFetch<T>(path, params);
}
