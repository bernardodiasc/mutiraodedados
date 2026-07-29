import { createFileRoute, Link } from "@tanstack/react-router";
import { CandidatoFichaContainer } from "@/containers/CandidatoFichaContainer";
import { QualidadeBanner } from "@/components/QualidadeBanner";

const ANO_MAIS_RECENTE = 2024;

export const Route = createFileRoute("/eleicoes/candidatos/$sq")({
  component: CandidatoPage,
  validateSearch: (search: Record<string, unknown>): { ano: number } => ({
    ano: typeof search.ano === "number" ? search.ano : ANO_MAIS_RECENTE,
  }),
  head: ({ params }) => ({
    meta: [
      { title: `Candidato ${params.sq} — Eleições — Mutirão de Dados` },
      {
        name: "description",
        content:
          "Ficha eleitoral do candidato: bens declarados, votação por município, situação e histórico de candidaturas (dados oficiais do TSE).",
      },
      { property: "og:title", content: "Ficha eleitoral do candidato" },
      {
        property: "og:description",
        content: "Bens declarados, votos e histórico eleitoral — dados oficiais do TSE.",
      },
      {
        property: "og:url",
        content: `https://mutiraodedados.com.br/eleicoes/candidatos/${params.sq}`,
      },
    ],
    links: [
      { rel: "canonical", href: `https://mutiraodedados.com.br/eleicoes/candidatos/${params.sq}` },
    ],
  }),
  errorComponent: () => (
    <div className="mx-auto max-w-4xl px-4 py-10 text-destructive">
      Não consegui carregar esta ficha. Tente recarregar a página.
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-2xl">Candidatura não encontrada</h1>
      <p className="text-muted-foreground mt-2">
        Volte para a{" "}
        <Link to="/eleicoes/candidatos" className="text-accent underline">
          busca de candidatos
        </Link>
        .
      </p>
    </div>
  ),
});

function CandidatoPage() {
  const { sq } = Route.useParams();
  const { ano } = Route.useSearch();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <nav className="text-sm text-muted-foreground mb-6">
        <Link to="/eleicoes" className="hover:text-accent">
          Eleições
        </Link>
        {" / "}
        <Link to="/eleicoes/candidatos" search={{ ano }} className="hover:text-accent">
          Candidatos
        </Link>
      </nav>
      <div className="grid gap-3 mb-6">
        {/* Sinais desta candidatura: alertas/lacunas (fonte tse) e cruzamentos
            investigativos (tse-cruzamento) — visíveis ao público, não só no admin. */}
        <QualidadeBanner fonte="tse" entidadeTipo="candidato" entidadeId={`${sq}-${ano}`} />
        <QualidadeBanner
          fonte="tse-cruzamento"
          entidadeTipo="candidato"
          entidadeId={`${sq}-${ano}`}
        />
      </div>
      <CandidatoFichaContainer sq={sq} ano={ano} />
    </div>
  );
}
