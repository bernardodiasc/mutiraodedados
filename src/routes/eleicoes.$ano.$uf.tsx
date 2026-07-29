import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { notFound } from "@tanstack/react-router";
import { CandidatosListaContainer } from "@/containers/CandidatosListaContainer";
import { TSE_ANOS_ELEICAO, TSE_UFS } from "@/lib/data/tse/client-ckan";
import { rotuloEleicao } from "@/lib/eleicoes-hub/logic";

export const Route = createFileRoute("/eleicoes/$ano/$uf")({
  component: EleicaoUfPage,
  validateSearch: (search: Record<string, unknown>): { cargo?: number; q?: string } => ({
    cargo: typeof search.cargo === "number" ? search.cargo : undefined,
    q: typeof search.q === "string" && search.q ? search.q : undefined,
  }),
  head: ({ params }) => ({
    meta: [
      { title: `Eleições ${params.ano} — ${params.uf.toUpperCase()} — Mutirão de Dados` },
      {
        name: "description",
        content: `Candidatos da eleição de ${params.ano} em ${params.uf.toUpperCase()}: situação, bens declarados e fichas individuais (dados oficiais do TSE).`,
      },
      { property: "og:title", content: `Eleições ${params.ano} — ${params.uf.toUpperCase()}` },
      {
        property: "og:description",
        content: "Recorte por eleição e UF dos dados abertos do TSE.",
      },
      {
        property: "og:url",
        content: `https://mutiraodedados.com.br/eleicoes/${params.ano}/${params.uf}`,
      },
    ],
    links: [
      {
        rel: "canonical",
        href: `https://mutiraodedados.com.br/eleicoes/${params.ano}/${params.uf}`,
      },
    ],
  }),
  errorComponent: () => (
    <div className="mx-auto max-w-6xl px-4 py-10 text-destructive">
      Não consegui carregar este recorte. Tente recarregar a página.
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-2xl">Recorte não encontrado</h1>
      <p className="text-muted-foreground mt-2">
        Use um ano de eleição (2014–2024, pares) e uma UF válida — ex.:{" "}
        <Link
          to="/eleicoes/$ano/$uf"
          params={{ ano: "2022", uf: "SP" }}
          className="text-accent underline"
        >
          /eleicoes/2022/SP
        </Link>
        .
      </p>
    </div>
  ),
});

function EleicaoUfPage() {
  const params = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const ano = Number(params.ano);
  const uf = params.uf.toUpperCase();
  if (
    !(TSE_ANOS_ELEICAO as readonly number[]).includes(ano) ||
    !(TSE_UFS as readonly string[]).includes(uf)
  ) {
    throw notFound();
  }
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="text-sm text-muted-foreground mb-4">
        <Link to="/eleicoes" className="hover:text-accent">
          Eleições
        </Link>
        {" / "}
        {rotuloEleicao(ano)}
        {" / "}
        {uf}
      </nav>
      <h1 className="font-display text-4xl">
        {rotuloEleicao(ano)} — {uf}
      </h1>
      <p className="text-muted-foreground mt-2 max-w-2xl">
        Candidaturas registradas no TSE para esta eleição e UF. Ordene, filtre por cargo pelo hub de{" "}
        <Link to="/eleicoes" className="text-accent underline">
          Eleições
        </Link>{" "}
        ou busque por nome abaixo.
      </p>
      <div className="mt-8">
        <CandidatosListaContainer
          search={{ ano, uf, cargo: search.cargo, q: search.q }}
          onSearchChange={(next) =>
            void navigate({
              search: { cargo: next.cargo, q: next.q },
              params: {
                ano: String(next.ano ?? ano),
                uf: next.uf ?? uf,
              },
              replace: true,
            })
          }
        />
      </div>
    </div>
  );
}
