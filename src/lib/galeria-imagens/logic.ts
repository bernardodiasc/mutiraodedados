/**
 * Funções puras extraídas de GaleriaImagensDialog.
 */

/** Normaliza um nome de arquivo a um slug ASCII apropriado para storage path. */
export function slugifyNome(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/** Extrai a extensão (sem ponto) de um nome; "bin" como fallback. */
export function extrairExtensao(nome: string): string {
  if (!nome.includes(".")) return "bin";
  const ext = nome.split(".").pop();
  return ext && ext.length > 0 ? ext : "bin";
}

/** Remove a extensão final de um nome de arquivo. */
export function nomeBase(nome: string): string {
  return nome.replace(/\.[^.]+$/, "");
}

export function buildStoragePath(userId: string, uuid: string, nomeArquivo: string): string {
  const base = slugifyNome(nomeBase(nomeArquivo));
  const ext = extrairExtensao(nomeArquivo);
  return `${userId}/${uuid}-${base}.${ext}`;
}

export type ValidacaoArquivo =
  | { ok: true }
  | { ok: false; motivo: "mime" | "tamanho"; mensagem: string };

export function validarArquivo(
  file: { name: string; type: string; size: number },
  limites: { MAX_BYTES: number; MIMES_OK: readonly string[] },
): ValidacaoArquivo {
  if (!limites.MIMES_OK.includes(file.type)) {
    return { ok: false, motivo: "mime", mensagem: `${file.name}: tipo não suportado.` };
  }
  if (file.size > limites.MAX_BYTES) {
    return { ok: false, motivo: "tamanho", mensagem: `${file.name}: excede 5 MB.` };
  }
  return { ok: true };
}
