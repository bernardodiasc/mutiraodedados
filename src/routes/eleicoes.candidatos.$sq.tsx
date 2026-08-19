import { createFileRoute, Link } from "@tanstack/react-router";
import { CandidatoFichaContainer } from "@/containers/CandidatoFichaContainer";

export const Route = createFileRoute("/eleicoes/candidatos/$sq")({
  component: CandidatoPage,
  // `ano` é opcional de propósito. Antes havia um default fixo (2024), o que
  // fazia a URL canônica desta rota — que não carrega o ano — abrir em
  // "candidatura não encontrada" para qualquer ficha de outro ano. O sq já
  // identifica a candidatura; quem não informa o ano recebe o do registro.
  validateSearch: (search: Record<string, unknown>): { ano?: number } =>
    typeof search.ano === "number" ? { ano: search.ano } : {},
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
      {/* Os banners de sinais vivem no Container: o `entidade_id` deles é
          "<sq>-<ano>", e só depois de carregar a ficha se sabe qual é o ano
          quando a URL não o informa. */}
      <CandidatoFichaContainer sq={sq} ano={ano} />
    </div>
  );
}
