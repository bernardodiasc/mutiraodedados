import type { PerguntaModelo } from "@/lib/pergunta-modelos.functions";
import type { Pergunta } from "@/lib/perguntas.functions";

/* ── Modelos ─────────────────────────────────────────────────────────── */

export type LinhaCsvModelo = {
  ordem: number;
  titulo: string;
  ativo: string;
  contexto: string;
  created_at: string;
  id: string;
};

export const CSV_COLUNAS_MODELO: (keyof LinhaCsvModelo)[] = [
  "ordem",
  "titulo",
  "ativo",
  "contexto",
  "created_at",
  "id",
];

export function modeloParaLinhaCsv(m: PerguntaModelo): LinhaCsvModelo {
  return {
    ordem: m.ordem,
    titulo: m.titulo,
    ativo: m.ativo ? "sim" : "não",
    contexto: m.contexto ?? "",
    created_at: m.created_at,
    id: m.id,
  };
}

export function modelosParaCsv(items: PerguntaModelo[]): LinhaCsvModelo[] {
  return items.map(modeloParaLinhaCsv);
}

export type AbaModelo = "tudo" | "ativos" | "inativos";

export function filtrarModelos(items: PerguntaModelo[], aba: AbaModelo): PerguntaModelo[] {
  if (aba === "ativos") return items.filter((m) => m.ativo);
  if (aba === "inativos") return items.filter((m) => !m.ativo);
  return items;
}

export function contarModelos(items: PerguntaModelo[]) {
  return {
    tudo: items.length,
    ativos: items.filter((m) => m.ativo).length,
    inativos: items.filter((m) => !m.ativo).length,
  };
}

export function modeloParaTextoCopiavel(m: PerguntaModelo): string {
  const partes: string[] = [m.titulo];
  if (m.contexto) partes.push("", m.contexto);
  return partes.join("\n");
}

/** Draft de criação/edição de um modelo. */
export type ModeloDraft = { titulo: string; contexto: string; ordem: number };
/** @deprecated usar ModeloDraft */
export type ModeloEditDraft = ModeloDraft;

export const MODELO_DRAFT_VAZIO: ModeloDraft = { titulo: "", contexto: "", ordem: 0 };

export function draftFromModelo(m: PerguntaModelo): ModeloDraft {
  return { titulo: m.titulo, contexto: m.contexto ?? "", ordem: m.ordem };
}

export function modeloDraftValido(d: ModeloDraft): boolean {
  return d.titulo.trim().length >= 5;
}

/** Payload para criar um modelo. */
export function payloadCriarModelo(d: ModeloDraft) {
  return { titulo: d.titulo.trim(), contexto: d.contexto.trim() || null, ordem: d.ordem };
}

/** Monta o patch mínimo (só campos alterados) para atualizarModelo. */
export function patchModelo(m: PerguntaModelo, d: ModeloDraft) {
  const patch: { titulo?: string; contexto?: string | null; ordem?: number } = {};
  if (d.titulo.trim() !== m.titulo) patch.titulo = d.titulo.trim();
  if ((d.contexto.trim() || null) !== m.contexto) patch.contexto = d.contexto.trim() || null;
  if (d.ordem !== m.ordem) patch.ordem = d.ordem;
  return patch;
}

/* ── Perguntas publicadas ────────────────────────────────────────────── */

export type LinhaCsvPergunta = {
  titulo: string;
  slug: string;
  descricao: string;
  contexto: string;
  tags: string;
  publicada_em: string;
  id: string;
};

export const CSV_COLUNAS_PERGUNTA: (keyof LinhaCsvPergunta)[] = [
  "titulo",
  "slug",
  "descricao",
  "contexto",
  "tags",
  "publicada_em",
  "id",
];

export function perguntaParaLinhaCsv(p: Pergunta): LinhaCsvPergunta {
  return {
    titulo: p.titulo,
    slug: p.slug ?? "",
    descricao: p.descricao ?? "",
    contexto: p.contexto ?? "",
    tags: (p.tags ?? []).join(" | "),
    publicada_em: p.publicada_em ?? "",
    id: p.id,
  };
}

export function perguntasParaCsv(items: Pergunta[]): LinhaCsvPergunta[] {
  return items.map(perguntaParaLinhaCsv);
}

export function perguntaParaTextoCopiavel(p: Pergunta): string {
  const partes: string[] = [`# ${p.titulo}`];
  if (p.descricao) partes.push("", p.descricao);
  if (p.contexto) partes.push("", p.contexto);
  return partes.join("\n");
}

/** Draft de edição de uma pergunta publicada. */
export type PerguntaEditDraft = {
  titulo: string;
  descricao: string;
  contexto: string;
  slug: string;
};

export function draftFromPergunta(p: Pergunta): PerguntaEditDraft {
  return {
    titulo: p.titulo,
    descricao: p.descricao ?? "",
    contexto: p.contexto ?? "",
    slug: p.slug ?? "",
  };
}

export function perguntaEditValido(d: PerguntaEditDraft): boolean {
  return d.titulo.trim().length >= 5;
}

export type PerguntaPatch = {
  titulo?: string;
  descricao?: string | null;
  contexto?: string | null;
  slug?: string;
};

/** Monta o patch mínimo (só campos alterados) para editarPerguntaAdmin. */
export function patchPergunta(p: Pergunta, d: PerguntaEditDraft): PerguntaPatch {
  const patch: PerguntaPatch = {};
  if (d.titulo.trim() !== p.titulo) patch.titulo = d.titulo.trim();
  if ((d.descricao.trim() || null) !== p.descricao) patch.descricao = d.descricao.trim() || null;
  if ((d.contexto.trim() || null) !== p.contexto) patch.contexto = d.contexto.trim() || null;
  if (d.slug.trim() && d.slug.trim() !== p.slug) patch.slug = d.slug.trim();
  return patch;
}
