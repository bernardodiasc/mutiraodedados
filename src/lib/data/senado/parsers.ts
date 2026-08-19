/**
 * Parsers puros da fonte Senado (API legis.senado.leg.br).
 * Separados do ingest para serem testáveis sem I/O.
 */

/**
 * Valor monetário do Senado (ex.: `ValorReembolsado` do CEAPS, que a API
 * emite como string). Number JSON passa direto. String só perde os pontos
 * quando há vírgula decimal (pt-BR "1.234,56") ou quando é inequivocamente
 * milhar pt-BR ("1.234.567") — uma string decimal americana ("3000.00")
 * passa direta; antes virava 300000 (×100).
 */
export function parseValorSenado(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).trim();
  if (!s) return 0;
  const pareceMilharPtBr = /^-?\d{1,3}(\.\d{3})+$/.test(s);
  const normalizado = s.includes(",")
    ? s.replace(/\./g, "").replace(",", ".")
    : pareceMilharPtBr
      ? s.replace(/\./g, "")
      : s;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : 0;
}
