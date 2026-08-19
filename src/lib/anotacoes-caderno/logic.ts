import type { Anotacao } from "@/lib/anotacoes.functions";

export type AnotacaoDraft = {
  /** "new" para nova anotação; uuid quando editando. */
  id: "new" | string;
  titulo: string;
  conteudo_md: string;
};

export const DRAFT_INICIAL: AnotacaoDraft = { id: "new", titulo: "", conteudo_md: "" };

/** Pode salvar quando há título OU conteúdo. */
export function podeSalvar(draft: AnotacaoDraft): boolean {
  return draft.titulo.trim().length > 0 || draft.conteudo_md.trim().length > 0;
}

/** Preview do conteúdo markdown — corta em N chars. */
export function previewConteudo(md: string, max = 200): string {
  const t = md.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/** Cria draft a partir de uma anotação existente. */
export function draftDeAnotacao(a: Anotacao): AnotacaoDraft {
  return { id: a.id, titulo: a.titulo ?? "", conteudo_md: a.conteudo_md ?? "" };
}

/** Formata data ISO em pt-BR; devolve string original se inválida. */
export function formatarDataPt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}
