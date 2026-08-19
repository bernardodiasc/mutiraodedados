import type { AnomaliaInput } from "@/lib/anomalia";

/** Bloco de identificação para colar em formulários oficiais (pure). */
export function buildIdentificacao(anomalia: AnomaliaInput, origin: string): string {
  return [
    `Tipo: ${anomalia.entidade.tipo}`,
    `ID: ${anomalia.entidade.id}`,
    anomalia.entidade.url_oficial && `URL: ${anomalia.entidade.url_oficial}`,
    `Caso documentado: ${origin}/qualidade/${anomalia.id}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Origem padrão para fallback em SSR (sem `window`). */
export const ORIGIN_FALLBACK = "https://mutiraodedados.com.br";

/** Devolve o `window.location.origin` ou o fallback estável. */
export function safeOrigin(): string {
  if (typeof window === "undefined") return ORIGIN_FALLBACK;
  return window.location.origin || ORIGIN_FALLBACK;
}
