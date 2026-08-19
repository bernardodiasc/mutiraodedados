import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  CandidatosListaContainer,
  type CandidatosListaSearch,
} from "@/containers/CandidatosListaContainer";

export const Route = createFileRoute("/eleicoes/candidatos/")({
  component: CandidatosPage,
  validateSearch: (search: Record<string, unknown>): CandidatosListaSearch => ({
    ano: typeof search.ano === "number" ? search.ano : undefined,
    uf: typeof search.uf === "string" && search.uf ? search.uf : undefined,
    cargo: typeof search.cargo === "number" ? search.cargo : undefined,
    q: typeof search.q === "string" && search.q ? search.q : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Candidatos — Eleições — Mutirão de Dados" },
      {
        name: "description",
        content:
          "Busque candidatos por eleição, UF e nome. Cada ficha traz bens declarados, votação por município e histórico eleitoral (dados do TSE).",
      },
      { property: "og:title", content: "Busca de candidatos (TSE)" },
      {
        property: "og:description",
        content:
          "Candidaturas de 1998 em diante com bens, votos e situação — dados oficiais do TSE.",
      },
      { property: "og:url", content: "https://mutiraodedados.com.br/eleicoes/candidatos" },
    ],
    links: [{ rel: "canonical", href: "https://mutiraodedados.com.br/eleicoes/candidatos" }],
  }),
  errorComponent: () => (
    <div className="mx-auto max-w-6xl px-4 py-10 text-destructive">
      Não consegui carregar a busca de candidatos. Tente recarregar a página.
    </div>
  ),
});

function CandidatosPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-4xl">Candidatos</h1>
      <p className="text-muted-foreground mt-2 max-w-2xl">
        Todas as candidaturas registradas no TSE para as eleições importadas. Filtre por eleição, UF
        e nome; clique num candidato para ver bens, votos e histórico.
      </p>
      <div className="mt-8">
        <CandidatosListaContainer
          search={search}
          onSearchChange={(next) => void navigate({ search: next, replace: true })}
        />
      </div>
    </div>
  );
}
