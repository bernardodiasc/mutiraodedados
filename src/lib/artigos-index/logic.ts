const DATA_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const DIFICULDADE_LABEL: Record<string, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

/** Rótulo amigável para dificuldade; devolve a entrada se desconhecida. */
export function dificuldadeLabel(d: string | null | undefined): string | null {
  if (!d) return null;
  return DIFICULDADE_LABEL[d] ?? d;
}

/** Formata "dd mmm yyyy" em pt-BR; devolve "" para entradas inválidas. */
export function formatDataPublicacao(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return DATA_FMT.format(d);
}

export type ArtigoBasePath = "/mapas" | "/tutoriais" | "/notas";
export type ArtigoDetailPath = "/mapas/$slug" | "/tutoriais/$slug" | "/notas/$slug";

/** Constrói o path de detalhe a partir do path base. */
export function detailPathFor(basePath: ArtigoBasePath): ArtigoDetailPath {
  return `${basePath}/$slug` as ArtigoDetailPath;
}
