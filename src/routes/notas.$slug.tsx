import { createFileRoute, Link } from "@tanstack/react-router";
import { ArtigoDetalheView } from "@/components/ArtigoDetalheView";

export const Route = createFileRoute("/notas/$slug")({
  component: () => {
    const { slug } = Route.useParams();
    return <ArtigoDetalheView slug={slug} voltarTo="/notas" voltarLabel="Notas" />;
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl">Nota não encontrada</h1>
      <Link to="/notas" className="text-accent underline text-sm mt-4 inline-block">
        ← Voltar para as notas
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