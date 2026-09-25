import type { ArtigoCategoria, ArtigoDificuldade } from "./artigos.functions";

/** Entrada já validada de `salvarArtigo`. */
export type DadosSalvarArtigo = {
  slug: string;
  titulo: string;
  resumo?: string | null;
  conteudo_md?: string;
  categoria: ArtigoCategoria;
  capa_url?: string | null;
  dificuldade?: ArtigoDificuldade | null;
  tempo_estimado_min?: number | null;
  fontes_usadas?: string[];
  notas_internas?: string | null;
  publico: boolean;
  publicado_em?: string | null;
};

/**
 * Monta a linha gravada em `artigos` por `salvarArtigo`.
 * `capa_url` ausente = não mexe na capa gravada (o formulário do admin não
 * tem campo de capa); `null` explícito = remove.
 */
export function montarPayloadArtigo(data: DadosSalvarArtigo) {
  return {
    slug: data.slug,
    titulo: data.titulo,
    resumo: data.resumo ?? null,
    conteudo_md: data.conteudo_md ?? "",
    categoria: data.categoria,
    ...(data.capa_url !== undefined ? { capa_url: data.capa_url } : {}),
    dificuldade: data.dificuldade ?? null,
    tempo_estimado_min: data.tempo_estimado_min ?? null,
    fontes_usadas: data.fontes_usadas ?? [],
    notas_internas: data.notas_internas ?? null,
    publico: data.publico,
    publicado_em: publicadoEmAoSalvar(
      data.publico,
      data.publicado_em ?? null,
      new Date().toISOString(),
    ),
  };
}

/**
 * Data de publicação gravada ao salvar: público mantém a data que já tinha
 * (editar não "republica"); público sem data recebe `agora`; não público
 * fica sem data.
 */
export function publicadoEmAoSalvar(
  publico: boolean,
  atual: string | null,
  agora: string,
): string | null {
  if (!publico) return null;
  return atual ?? agora;
}
