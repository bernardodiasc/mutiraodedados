import type { QueryClient } from "@tanstack/react-query";
import { obterArtigoPublico } from "@/lib/data/artigos.functions";
import { carregarFicha } from "@/lib/titulo-pagina/loader";
import { h1DoArtigo } from "./logic";

/**
 * Loader compartilhado de /mapas, /notas e /tutoriais/$slug: o artigo vem nos
 * dados da rota (ver `carregarFicha`) e o H1 vai para o título da aba.
 */
export async function carregarArtigo(queryClient: QueryClient, slug: string) {
  const { dado, h1 } = await carregarFicha(queryClient, {
    queryKey: ["artigo-publico", slug],
    queryFn: () => obterArtigoPublico({ data: { slug } }),
    h1: h1DoArtigo,
  });
  return { artigo: dado, h1 };
}
