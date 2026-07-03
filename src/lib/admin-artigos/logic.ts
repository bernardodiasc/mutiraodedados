import type {
  Artigo,
  ArtigoCategoria,
  ArtigoDificuldade,
} from "@/lib/data/artigos.functions";

export type Aba = "tudo" | "mapa" | "tutorial" | "nota";

export const CATEGORIA_LABEL: Record<ArtigoCategoria, string> = {
  mapa: "Mapa investigativo",
  tutorial: "Tutorial",
  nota: "Nota",
};

export type LinhaCsvArtigo = {
  titulo: string;
  slug: string;
  categoria: string;
  publico: string;
  dificuldade: string;
  tempo_estimado_min: number | string;
  resumo: string;
  fontes_usadas: string;
  conteudo_md: string;
  notas_internas: string;
  publicado_em: string;
  created_at: string;
  updated_at: string;
  id: string;
};

export const CSV_COLUNAS: (keyof LinhaCsvArtigo)[] = [
  "titulo",
  "slug",
  "categoria",
  "publico",
  "dificuldade",
  "tempo_estimado_min",
  "resumo",
  "fontes_usadas",
  "conteudo_md",
  "notas_internas",
  "publicado_em",
  "created_at",
  "updated_at",
  "id",
];

export function artigoParaLinhaCsv(a: Artigo): LinhaCsvArtigo {
  return {
    titulo: a.titulo,
    slug: a.slug,
    categoria: CATEGORIA_LABEL[a.categoria],
    publico: a.publico ? "sim" : "não",
    dificuldade: a.dificuldade ?? "",
    tempo_estimado_min: a.tempo_estimado_min ?? "",
    resumo: a.resumo ?? "",
    fontes_usadas: (a.fontes_usadas ?? []).join(" | "),
    conteudo_md: a.conteudo_md ?? "",
    notas_internas: a.notas_internas ?? "",
    publicado_em: a.publicado_em ?? "",
    created_at: a.created_at,
    updated_at: a.updated_at,
    id: a.id,
  };
}

export function artigosParaCsv(items: Artigo[]): LinhaCsvArtigo[] {
  return items.map(artigoParaLinhaCsv);
}

export type ArtigoCopiavel = Pick<Artigo, "titulo" | "conteudo_md"> &
  Partial<Pick<Artigo, "resumo" | "fontes_usadas">>;

export function artigoParaTextoCopiavel(a: ArtigoCopiavel): string {
  const partes: string[] = [`# ${a.titulo}`];
  if (a.resumo) partes.push("", a.resumo);
  if (a.fontes_usadas?.length) partes.push("", `Fontes: ${a.fontes_usadas.join(", ")}`);
  partes.push("", a.conteudo_md ?? "");
  return partes.join("\n");
}

export type FormState = {
  slug: string;
  titulo: string;
  resumo: string;
  conteudo_md: string;
  categoria: ArtigoCategoria;
  dificuldade: ArtigoDificuldade | "";
  tempo_estimado_min: string;
  fontes_usadas: string;
  notas_internas: string;
  publico: boolean;
};

export const FORM_INICIAL: FormState = {
  slug: "",
  titulo: "",
  resumo: "",
  conteudo_md: "",
  categoria: "mapa",
  dificuldade: "",
  tempo_estimado_min: "",
  fontes_usadas: "",
  notas_internas: "",
  publico: false,
};

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 160);
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

export function formFromArtigo(a: Artigo): FormState {
  return {
    slug: a.slug,
    titulo: a.titulo,
    resumo: a.resumo ?? "",
    conteudo_md: a.conteudo_md ?? "",
    categoria: a.categoria,
    dificuldade: a.dificuldade ?? "",
    tempo_estimado_min:
      a.tempo_estimado_min != null ? String(a.tempo_estimado_min) : "",
    fontes_usadas: (a.fontes_usadas ?? []).join(", "),
    notas_internas: a.notas_internas ?? "",
    publico: a.publico,
  };
}

export type SavePayload = {
  id?: string;
  slug: string;
  titulo: string;
  resumo: string | null;
  conteudo_md: string;
  categoria: ArtigoCategoria;
  dificuldade: ArtigoDificuldade | null;
  tempo_estimado_min: number | null;
  fontes_usadas: string[];
  notas_internas: string | null;
  publico: boolean;
};

export function buildSavePayload(form: FormState, editingId?: string): SavePayload {
  const slug = (form.slug || slugify(form.titulo)).trim();
  return {
    ...(editingId ? { id: editingId } : {}),
    slug,
    titulo: form.titulo.trim(),
    resumo: form.resumo.trim() || null,
    conteudo_md: form.conteudo_md,
    categoria: form.categoria,
    dificuldade:
      form.categoria === "nota"
        ? null
        : ((form.dificuldade || null) as ArtigoDificuldade | null),
    tempo_estimado_min:
      form.categoria === "nota"
        ? null
        : form.tempo_estimado_min
          ? Number(form.tempo_estimado_min)
          : null,
    fontes_usadas: form.fontes_usadas
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    notas_internas: form.notas_internas.trim() || null,
    publico: form.publico,
  };
}

export function filtrarPorAba(items: Artigo[], aba: Aba): Artigo[] {
  return aba === "tudo" ? items : items.filter((a) => a.categoria === aba);
}

export function contarPorCategoria(items: Artigo[]) {
  return {
    tudo: items.length,
    mapa: items.filter((i) => i.categoria === "mapa").length,
    tutorial: items.filter((i) => i.categoria === "tutorial").length,
    nota: items.filter((i) => i.categoria === "nota").length,
  };
}

export function rotaPublicaCategoria(c: ArtigoCategoria): string {
  return c === "mapa" ? "/mapas" : c === "tutorial" ? "/tutoriais" : "/notas";
}

export function aplicarTituloNoForm(
  form: FormState,
  novoTitulo: string,
  editando: boolean,
): FormState {
  return {
    ...form,
    titulo: novoTitulo,
    slug: !editando && !form.slug ? slugify(novoTitulo) : form.slug,
  };
}