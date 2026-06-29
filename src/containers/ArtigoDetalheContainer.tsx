import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { obterArtigoPublico } from "@/lib/data/artigos.functions";
import { ArtigoDetalheView } from "@/components/ArtigoDetalheView";

export type ArtigoDetalheContainerProps = {
  slug: string;
  voltarTo: "/mapas" | "/tutoriais" | "/notas";
  voltarLabel: string;
};

export function ArtigoDetalheContainer({
  slug,
  voltarTo,
  voltarLabel,
}: ArtigoDetalheContainerProps) {
  const fetchArtigo = useServerFn(obterArtigoPublico);
  const { data, isLoading, error } = useQuery({
    queryKey: ["artigo-publico", slug],
    queryFn: () => fetchArtigo({ data: { slug } }),
  });

  return (
    <ArtigoDetalheView
      isLoading={isLoading}
      error={error as Error | null}
      artigo={data ?? null}
      voltarTo={voltarTo}
      voltarLabel={voltarLabel}
    />
  );
}
ArtigoDetalheContainer.displayName = "ArtigoDetalheContainer";
