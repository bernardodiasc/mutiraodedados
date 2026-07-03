import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { obterArtigoPublico } from "@/lib/data/artigos.functions";
import { artigoParaTextoCopiavel } from "@/lib/admin-artigos/logic";
import { ArtigoDetalheView } from "@/components/ArtigoDetalheView";
import { BotaoCopiar } from "@/components/BotaoCopiar";
import { BotaoSalvarItem } from "@/components/BotaoSalvarItem";
import { KitInvestigacao } from "@/components/KitInvestigacao";

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

  const artigo = data ?? null;

  // Kit de investigação só em mapas; tutoriais e notas ganham copiar/salvar.
  const kit =
    artigo && artigo.categoria === "mapa" ? (
      <KitInvestigacao
        artigoId={artigo.id}
        slug={artigo.slug}
        titulo={artigo.titulo}
        obterTextoMapa={() => artigoParaTextoCopiavel(artigo)}
      />
    ) : undefined;

  const acoes =
    artigo && artigo.categoria !== "mapa" ? (
      <div className="flex flex-wrap gap-2 pt-1">
        <BotaoCopiar
          obterTexto={() => artigoParaTextoCopiavel(artigo)}
          rotulo="Copiar texto"
          mensagemToast="Texto copiado — cole na sua IA ou nas suas anotações"
        />
        <BotaoSalvarItem
          entidadeTipo={artigo.categoria === "tutorial" ? "tutorial" : "artigo"}
          entidadeId={artigo.slug}
          titulo={artigo.titulo}
          url={`${voltarTo}/${artigo.slug}`}
          contexto={artigo.resumo ?? undefined}
        />
      </div>
    ) : undefined;

  return (
    <ArtigoDetalheView
      isLoading={isLoading}
      error={error as Error | null}
      artigo={artigo}
      voltarTo={voltarTo}
      voltarLabel={voltarLabel}
      kit={kit}
      acoes={acoes}
    />
  );
}
ArtigoDetalheContainer.displayName = "ArtigoDetalheContainer";
