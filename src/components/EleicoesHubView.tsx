import { Link } from "@tanstack/react-router";
import { Loader2, Vote } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { fmtNum } from "@/lib/fmt";
import type { AnoResumo, Estado } from "@/lib/eleicoes-hub/logic";
import { rotuloEleicao } from "@/lib/eleicoes-hub/logic";

export type EleicoesHubViewProps = {
  estado: Estado;
  anos: AnoResumo[];
};

export function EleicoesHubView({ estado, anos }: EleicoesHubViewProps) {
  if (estado === "carregando") {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-10 justify-center">
        <Loader2 className="size-4 animate-spin" /> Carregando eleições…
      </div>
    );
  }
  if (estado === "erro") {
    return (
      <div className="text-destructive py-10 text-center">Não consegui carregar as eleições.</div>
    );
  }
  if (estado === "vazio") {
    return (
      <EmptyState
        title="Nenhuma eleição importada ainda"
        hint="O administrador importa os dados do TSE em /admin/dados (aba TSE). Depois disso, os anos aparecem aqui."
      />
    );
  }
  return (
    <div className="grid gap-6">
      {anos.map((bloco) => (
        <section key={bloco.ano} className="border border-border rounded-xl p-5 bg-card">
          <header className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 className="font-display text-xl flex items-center gap-2">
              <Vote className="size-5 text-accent" />
              {rotuloEleicao(bloco.ano)}
            </h2>
            <span className="text-sm text-muted-foreground font-mono">
              {fmtNum(bloco.totalCandidatos)} candidaturas
            </span>
          </header>
          <ul className="grid gap-2 mt-4 sm:grid-cols-2 lg:grid-cols-3">
            {bloco.cargos.map((c) => (
              <li key={c.cargoCod} className="border border-border rounded-md p-3 bg-background">
                <Link
                  to="/eleicoes/candidatos"
                  search={{ ano: bloco.ano, cargo: c.cargoCod }}
                  className="font-medium hover:text-accent"
                >
                  {c.cargoNome}
                </Link>
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  {fmtNum(c.total)} candidatos · {fmtNum(c.eleitos)} eleitos · {c.ufs} UF
                  {c.ufs > 1 ? "s" : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
EleicoesHubView.displayName = "EleicoesHubView";
