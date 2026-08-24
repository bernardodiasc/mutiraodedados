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
        title="Nenhuma eleição no acervo ainda"
        hint="Os dados vêm do portal de dados abertos do TSE e entram no acervo eleição a eleição — volte em breve."
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
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground">
              Panorama por estado — cargos, candidaturas e eleitos de uma UF nesta eleição
            </summary>
            <ul className="flex flex-wrap gap-1.5 mt-2">
              {UFS_PANORAMA.map((uf) => (
                <li key={uf}>
                  <Link
                    to="/eleicoes/$ano/$uf"
                    params={{ ano: String(bloco.ano), uf }}
                    data-flat
                    className="inline-block rounded border border-border bg-background px-2 py-0.5 text-xs font-mono hover:border-accent hover:text-accent"
                  >
                    {uf}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        </section>
      ))}
    </div>
  );
}
EleicoesHubView.displayName = "EleicoesHubView";

// Chips do panorama por estado — BR cobre os cargos nacionais (presidente).
const UFS_PANORAMA = [
  "BR",
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
];
