import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hrefDoArtigo } from "@/lib/artigo-referencias/logic";

export type ArtigoQueCita = {
  titulo: string;
  resumo: string | null;
  categoria: string;
  href: string;
};

const schema = z.object({
  colecao: z.string().regex(/^[a-z_]{1,63}$/),
  idOrigem: z.string().trim().min(1).max(200),
});

/**
 * "Aprenda a investigar este registro": os artigos publicados que citam
 * explicitamente o registro (`artigo_referencias` do tipo registro). Só
 * artigo público entra; rascunho nunca aparece.
 */
export const artigosQueCitam = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }): Promise<ArtigoQueCita[]> => {
    const { data: linhas, error } = await supabaseAdmin
      .from("artigo_referencias")
      .select("artigos!inner(titulo, resumo, categoria, slug, publico, ordem)")
      .eq("tipo", "registro")
      .eq("colecao", data.colecao)
      .eq("id_origem", data.idOrigem)
      .eq("artigos.publico", true);
    if (error) {
      console.error("[artigos que citam]", error.message);
      return [];
    }
    return (linhas ?? [])
      .map(
        (l) =>
          l.artigos as unknown as {
            titulo: string;
            resumo: string | null;
            categoria: string;
            slug: string;
            ordem: number;
          },
      )
      .sort((a, b) => a.ordem - b.ordem)
      .map((a) => ({
        titulo: a.titulo,
        resumo: a.resumo,
        categoria: a.categoria,
        href: hrefDoArtigo(a.categoria, a.slug),
      }));
  });
