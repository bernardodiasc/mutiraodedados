import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BuscarContainer } from "@/containers/BuscarContainer";
import { validarBuscarSearch } from "@/lib/buscar/logic";

const DESCRICAO =
  "Pesquise um assunto, nome, CNPJ ou número de processo em contratos, licitações, emendas, convênios, fornecedores, candidaturas e artigos, com filtros e contagens sobre todo o resultado.";

export const Route = createFileRoute("/buscar")({
  component: BuscarPage,
  validateSearch: validarBuscarSearch,
  head: () => ({
    meta: [
      { title: "Buscar — Mutirão de Dados" },
      { name: "description", content: DESCRICAO },
      { property: "og:title", content: "Buscar — Mutirão de Dados" },
      { property: "og:description", content: DESCRICAO },
      { property: "og:url", content: "https://mutiraodedados.com.br/buscar" },
    ],
    links: [{ rel: "canonical", href: "https://mutiraodedados.com.br/buscar" }],
  }),
  errorComponent: () => (
    <div className="mx-auto max-w-6xl px-4 py-10 text-destructive">
      Não consegui carregar a busca. Tente recarregar a página.
    </div>
  ),
});

function BuscarPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
      <header>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          Busca unificada
        </div>
        <h1 className="font-display text-4xl mt-1">Buscar</h1>
      </header>
      <BuscarContainer search={search} onSearchChange={(next) => void navigate({ search: next })} />
    </div>
  );
}
