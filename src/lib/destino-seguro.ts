const PADRAO = "/minhas-marcacoes";
const BASE = "https://base.invalid";

/**
 * Destino após o login: só aceita caminho interno do próprio site.
 * Qualquer outro valor cai no padrão.
 */
export function destinoSeguro(redirect: string | undefined): string {
  if (!redirect || !redirect.startsWith("/")) return PADRAO;
  let url: URL;
  try {
    url = new URL(redirect, BASE);
  } catch {
    return PADRAO;
  }
  if (url.origin !== BASE) return PADRAO;
  return url.pathname + url.search + url.hash;
}
