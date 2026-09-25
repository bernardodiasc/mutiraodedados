import type { QueryClient } from "@tanstack/react-query";
import { obterArtigoPublico } from "@/lib/data/artigos.functions";
import { carregarH1 } from "@/lib/titulo-pagina/loader";
import { h1DoArtigo } from "./logic";

/**
 * Loader compartilhado de /mapas, /notas e /tutoriais/$slug: pré-carrega o
 * artigo com a mesma queryKey do ArtigoDetalheContainer e devolve o H1 para o
 * título da aba.
 */
export function carregarH1DoArtigo(queryClient: QueryClient, slug: string) {
  return carregarH1(queryClient, {
    queryKey: ["artigo-publico", slug],
    queryFn: () => obterArtigoPublico({ data: { slug } }),
    h1: h1DoArtigo,
  });
}
