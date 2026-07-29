import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { statsContratosPNCP } from "@/lib/data/pncp/queries.functions";
import { ScrollText, Scale, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/pncp")({
  component: PNCPPage,
  head: () => ({
    meta: [
      { title: "PNCP — Portal Nacional de Contratações Públicas — Mutirão de Dados" },
      {
        name: "description",
        content:
          "O que o PNCP cobre no Mutirão de Dados: contratos e licitações sob a Lei 14.133, de todos os entes (União, estados, municípios).",
      },
    ],
  }),
});

function PNCPPage() {
  const stats = useServerFn(statsContratosPNCP);
  const { data } = useQuery({ queryKey: ["pncp-stats"], queryFn: () => stats() });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      <header>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          Por fonte de dados
        </div>
        <h1 className="font-display text-4xl mt-1">
          Portal Nacional de Contratações Públicas (PNCP)
        </h1>
        <p className="text-muted-foreground mt-3 max-w-3xl leading-relaxed">
          Repositório jurídico das contratações sob a Lei 14.133/2021, obrigatório para{" "}
          <strong>todos os entes</strong> — União, 26 estados, DF e 5.570 municípios — desde 2021. É
          a fonte autoritativa do edital, termo de referência e contrato.{" "}
          <a
            href="https://pncp.gov.br"
            target="_blank"
            rel="noreferrer"
            className="text-accent underline"
          >
            pncp.gov.br <ExternalLink className="inline size-3" />
          </a>
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/contratos"
          search={{ fonte: "pncp" }}
          className="rounded-2xl border border-border bg-card p-5 hover:border-accent transition-colors"
        >
          <div className="flex items-center gap-2 font-medium">
            <ScrollText className="size-4 text-muted-foreground" /> Contratos
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Contratos de todos os entes federados. Abre em Contratos com a fonte PNCP selecionada.
          </p>
          <div className="text-xs text-muted-foreground mt-3">
            {data ? `${data.total.toLocaleString("pt-BR")} contratos em cache` : "—"}
          </div>
        </Link>

        <Link
          to="/licitacoes"
          className="rounded-2xl border border-border bg-card p-5 hover:border-accent transition-colors"
        >
          <div className="flex items-center gap-2 font-medium">
            <Scale className="size-4 text-muted-foreground" /> Licitações / Editais
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            O PNCP hospeda os editais e atas. Hoje exibimos as licitações pelo Portal CGU; o
            cross-link por órgão/número leva ao PNCP em cada licitação.
          </p>
          <div className="text-xs text-muted-foreground mt-3">via Portal CGU + busca no PNCP</div>
        </Link>
      </section>

      <p className="text-[11px] text-muted-foreground border-t border-border pt-4">
        Cobertura por mês em{" "}
        <Link to="/cobertura" className="text-accent underline">
          /cobertura
        </Link>
        . Detalhes em <code>docs/fontes/pncp.md</code>.
      </p>
    </div>
  );
}
