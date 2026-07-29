import { createFileRoute, Link } from "@tanstack/react-router";
import { EleicoesHubContainer } from "@/containers/EleicoesHubContainer";
import { FontesDoTema } from "@/components/FontesDoTema";

export const Route = createFileRoute("/eleicoes/")({
  component: EleicoesPage,
  head: () => ({
    meta: [
      { title: "Eleições — Mutirão de Dados" },
      {
        name: "description",
        content:
          "Candidatos, bens declarados, votação e contas de campanha das eleições brasileiras de 2014 em diante, com dados oficiais do TSE.",
      },
      { property: "og:title", content: "Eleições — candidatos, bens e contas de campanha" },
      {
        property: "og:description",
        content:
          "Explore os dados abertos do TSE: quem se candidatou, o que declarou, quanto recebeu e de quem.",
      },
      { property: "og:url", content: "https://mutiraodedados.com.br/eleicoes" },
    ],
    links: [{ rel: "canonical", href: "https://mutiraodedados.com.br/eleicoes" }],
  }),
  errorComponent: () => (
    <div className="mx-auto max-w-6xl px-4 py-10 text-destructive">
      Não consegui carregar as eleições. Tente recarregar a página.
    </div>
  ),
});

function EleicoesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-4xl">Eleições</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Quem se candidatou, o que declarou de bens, quantos votos recebeu — e, nas fichas, de
            quem veio o dinheiro da campanha. Dados oficiais do TSE, de 2014 em diante. Comece por
            uma eleição ou vá direto à{" "}
            <Link to="/eleicoes/candidatos" className="text-accent underline">
              busca de candidatos
            </Link>
            .
          </p>
        </div>
      </div>
      <div className="mt-8">
        <EleicoesHubContainer />
      </div>
      <div className="mt-10">
        <FontesDoTema
          fontes={[
            {
              label: "Dados Abertos do TSE",
              to: "https://dadosabertos.tse.jus.br",
              nota: "Origem oficial: CSVs por eleição (candidatos, bens, votação e contas de campanha).",
            },
          ]}
        />
      </div>
    </div>
  );
}
