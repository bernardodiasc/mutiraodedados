import { createFileRoute, Link } from "@tanstack/react-router";
import { ArtigoDetalhe } from "@/components/ArtigoDetalhe";

export const Route = createFileRoute("/tutoriais/$slug")({
  component: TutorialDetalhe,
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl">Tutorial não encontrado</h1>
      <Link to="/tutoriais" className="text-accent underline text-sm mt-4 inline-block">
        ← Voltar para os tutoriais
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

function TutorialDetalhe() {
  const { slug } = Route.useParams();
  return <ArtigoDetalhe slug={slug} voltarTo="/tutoriais" voltarLabel="Tutoriais" />;
}
