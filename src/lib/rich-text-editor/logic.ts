/**
 * Funções puras extraídas do RichTextEditor.
 */

/** Monta o snippet de fluxo embutido inserido no markdown. */
export function buildFluxoSnippet(nome: string): string {
  return `\n\n:::fluxo{nome="${nome}"}:::\n\n`;
}

/** Sanitiza o nome de um fluxo: trim + minúsculas + caracteres permitidos. */
export function sanitizeNomeFluxo(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Decide a ação a executar a partir do prompt de link (null cancela, vazio
 * remove, qualquer outra string define o href).
 */
export type AcaoLink =
  | { tipo: "cancelar" }
  | { tipo: "remover" }
  | { tipo: "definir"; href: string };

export function interpretarPromptLink(raw: string | null): AcaoLink {
  if (raw === null) return { tipo: "cancelar" };
  if (raw === "") return { tipo: "remover" };
  return { tipo: "definir", href: raw };
}