import { createFileRoute, Link } from "@tanstack/react-router";
import { ArtigoDetalhe } from "@/components/ArtigoDetalhe";
import { carregarArtigo } from "@/lib/artigo-detalhe/loader";
import { tituloDaPagina } from "@/lib/titulo-pagina/logic";

export const Route = createFileRoute("/mapas/$slug")({
  loader: ({ params, context }) => carregarArtigo(context.queryClient, params.slug),
  head: ({ loaderData }) => ({
    meta: [{ title: tituloDaPagina(loaderData?.h1, "Mapa investigativo") }],
  }),
  component: MapaDetalhe,
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl">Mapa não encontrado</h1>
      <p className="text-sm text-muted-foreground mt-2">
        Esse mapa pode ter sido despublicado ou nunca existiu.
      </p>
      <Link to="/mapas" className="text-accent underline text-sm mt-4 inline-block">
        ← Voltar para os mapas
      </Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl">Erro ao carregar</h1>
      <p className="text-sm text-muted-foreground mt-2">{(error as Error).message}</p>
    </div>
  ),
});

function MapaDetalhe() {
  const { artigo } = Route.useLoaderData();
  return <ArtigoDetalhe artigo={artigo} voltarTo="/mapas" voltarLabel="Mapas investigativos" />;
}
