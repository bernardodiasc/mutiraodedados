/**
 * Lista controlada das fontes de um artigo (`artigos.fontes_usadas`), decidida
 * na v0.16.0 junto com as referências de artigo. Antes era texto livre e
 * misturava nomes, siglas minúsculas, URLs, leis e conceitos.
 *
 * Duas partes: as fontes do acervo, com os mesmos rótulos da faceta Fonte da
 * busca, e as fontes oficiais externas que os artigos citam sem que o site as
 * importe. Leis e conceitos não são fonte e ficam fora — o artigo os cita no
 * texto.
 */
export const FONTES_DO_ACERVO = [
  "CGU",
  "PNCP",
  "Transferegov",
  "SICONFI",
  "Câmara",
  "Senado",
  "TSE",
  "IBGE",
] as const;

export const FONTES_EXTERNAS = [
  "SIOP",
  "Receita Federal",
  "SICAF",
  "Painel de Preços",
  "CEIS",
  "CNEP",
  "TCU",
  "MGI",
] as const;

export const FONTES_ARTIGO = [...FONTES_DO_ACERVO, ...FONTES_EXTERNAS] as const;

export type FonteArtigo = (typeof FONTES_ARTIGO)[number];

export function eFonteArtigo(v: string): v is FonteArtigo {
  return (FONTES_ARTIGO as readonly string[]).includes(v);
}

/** Marca ou desmarca a fonte, mantendo a ordem da lista controlada. */
export function alternarFonte(fontes: readonly FonteArtigo[], fonte: FonteArtigo): FonteArtigo[] {
  const set = new Set(fontes);
  if (set.has(fonte)) set.delete(fonte);
  else set.add(fonte);
  return FONTES_ARTIGO.filter((f) => set.has(f));
}
