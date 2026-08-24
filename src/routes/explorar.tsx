import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MapPinned } from "lucide-react";
import { IbgeCombobox } from "@/components/IbgeCombobox";
import { PainelExplicar } from "@/components/PainelExplicar";
import { UF_NOMES } from "@/lib/ente/logic";

export const Route = createFileRoute("/explorar")({
  component: ExplorarPage,
  head: () => ({
    meta: [
      { title: "Por estado ou município — Mutirão de Dados" },
      {
        name: "description",
        content:
          "Escolha um estado ou município e veja, no mesmo lugar, contratações (PNCP), relatórios fiscais (SICONFI) e convênios recebidos da União.",
      },
      { property: "og:title", content: "Por estado ou município — Mutirão de Dados" },
      {
        property: "og:description",
        content:
          "Escolha um estado ou município e veja, no mesmo lugar, contratações, relatórios fiscais e convênios recebidos da União.",
      },
    ],
  }),
});

function ExplorarPage() {
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      <header>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          Descoberta por lugar
        </div>
        <h1 className="font-display text-4xl mt-1">Por estado ou município</h1>
        <p className="text-muted-foreground mt-3 max-w-3xl leading-relaxed">
          Cada estado e cada município tem uma página própria — com endereço compartilhável — que
          reúne o que a União contrata, repassa e registra sobre aquele lugar, em três fontes
          conectadas pelo código IBGE.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <label className="block text-sm font-medium" htmlFor="busca-municipio">
          Busque seu município
        </label>
        <div className="max-w-md" id="busca-municipio">
          <IbgeCombobox
            value=""
            onChange={(cod) => {
              if (cod) void navigate({ to: "/entes/$codigo", params: { codigo: cod } });
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Digite o nome (ex.: "São Paulo", "Recife") e escolha na lista — você vai direto para a
          página do município.
        </p>
      </section>

      <section>
        <h2 className="font-display text-2xl flex items-center gap-2">
          <MapPinned className="size-5 text-accent" aria-hidden /> Ou escolha um estado
        </h2>
        <ul className="mt-4 grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {Object.entries(UF_NOMES).map(([sigla, nome]) => (
            <li key={sigla}>
              <Link
                to="/entes/$codigo"
                params={{ codigo: sigla.toLowerCase() }}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:border-accent hover:text-accent"
              >
                <span className="font-mono text-xs text-muted-foreground w-6">{sigla}</span>
                <span className="truncate">{nome}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <PainelExplicar titulo="O que tem na página de um ente?">
        <p>
          Três fontes lado a lado: <strong>contratações</strong> publicadas no PNCP por órgãos do
          próprio ente, os <strong>relatórios fiscais</strong> que o ente declara ao Tesouro
          Nacional (SICONFI) e os <strong>convênios</strong> que o ente recebe da União. Cada fonte
          cobre um recorte diferente do mesmo lugar — juntas, elas dão a visão que nenhuma dá
          sozinha.
        </p>
      </PainelExplicar>
    </div>
  );
}
