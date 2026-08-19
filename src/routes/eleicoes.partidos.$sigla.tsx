import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Landmark, Loader2 } from "lucide-react";
import { resumoPartidoTse } from "@/lib/data/tse/queries.functions";
import { EmptyState } from "@/components/EmptyState";
import { fmtBRL, fmtNum } from "@/lib/fmt";
import { capitalizarCargo, rotuloEleicao } from "@/lib/eleicoes-hub/logic";

export const Route = createFileRoute("/eleicoes/partidos/$sigla")({
  component: PartidoPage,
  head: ({ params }) => ({
    meta: [
      { title: `${params.sigla.toUpperCase()} nas urnas — Eleições — Mutirão de Dados` },
      {
        name: "description",
        content: `Panorama eleitoral do ${params.sigla.toUpperCase()}: candidaturas, eleitos e bens médios por eleição e cargo (dados oficiais do TSE, 1998 em diante).`,
      },
      { property: "og:title", content: `${params.sigla.toUpperCase()} nas urnas` },
      {
        property: "og:description",
        content: "Candidaturas, eleitos e bens médios por eleição — dados oficiais do TSE.",
      },
      {
        property: "og:url",
        content: `https://mutiraodedados.com.br/eleicoes/partidos/${params.sigla}`,
      },
    ],
    links: [
      {
        rel: "canonical",
        href: `https://mutiraodedados.com.br/eleicoes/partidos/${params.sigla}`,
      },
    ],
  }),
  errorComponent: () => (
    <div className="mx-auto max-w-4xl px-4 py-10 text-destructive">
      Não consegui carregar o panorama deste partido. Tente recarregar a página.
    </div>
  ),
});

function PartidoPage() {
  const { sigla } = Route.useParams();
  const siglaUpper = sigla.toUpperCase();
  const fn = useServerFn(resumoPartidoTse);
  const { data, isLoading, error } = useQuery({
    queryKey: ["tse", "partido", siglaUpper],
    queryFn: () => fn({ data: { sigla: siglaUpper } }),
  });

  // Agrupa por ano para exibir um bloco por eleição.
  const porAno = new Map<number, NonNullable<typeof data>>();
  for (const r of data ?? []) {
    porAno.set(r.ano_eleicao, [...(porAno.get(r.ano_eleicao) ?? []), r]);
  }
  const anos = [...porAno.keys()].sort((a, b) => b - a);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <nav className="text-sm text-muted-foreground mb-4">
        <Link to="/eleicoes" className="hover:text-accent">
          Eleições
        </Link>
        {" / Partidos / "}
        {siglaUpper}
      </nav>
      <h1 className="font-display text-4xl flex items-center gap-2">
        <Landmark className="size-7 text-accent" /> {siglaUpper} nas urnas
      </h1>
      <p className="text-muted-foreground mt-2 max-w-2xl">
        Quantas candidaturas o partido lançou, quantas se elegeram e o patrimônio médio declarado
        dos candidatos, eleição a eleição. Dados oficiais do TSE para as eleições importadas.
      </p>

      <div className="mt-8 grid gap-4">
        {isLoading && (
          <p className="text-muted-foreground flex items-center gap-2 py-10 justify-center">
            <Loader2 className="size-4 animate-spin" /> Carregando panorama…
          </p>
        )}
        {error && <p className="text-destructive py-10 text-center">Não consegui carregar.</p>}
        {!isLoading && !error && anos.length === 0 && (
          <EmptyState
            title={`Nenhuma candidatura do ${siglaUpper} no cache`}
            hint="Confira a sigla (partidos mudam de nome) ou aguarde a importação da eleição correspondente."
          />
        )}
        {anos.map((ano) => {
          const linhas = porAno.get(ano)!;
          const totalAno = linhas.reduce((s, l) => s + l.total, 0);
          const eleitosAno = linhas.reduce((s, l) => s + l.eleitos, 0);
          return (
            <section key={ano} className="border border-border rounded-xl p-5 bg-card">
              <header className="flex items-baseline justify-between gap-3 flex-wrap">
                <h2 className="font-display text-xl">{rotuloEleicao(ano)}</h2>
                <span className="text-sm text-muted-foreground font-mono">
                  {fmtNum(totalAno)} candidaturas · {fmtNum(eleitosAno)} eleitos
                </span>
              </header>
              <table className="w-full text-sm mt-4">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left py-1">Cargo</th>
                    <th className="text-right py-1">Candidatos</th>
                    <th className="text-right py-1">Eleitos</th>
                    <th className="text-right py-1 hidden sm:table-cell">Bens médios</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l, i) => (
                    <tr key={i} className="border-t border-border/60">
                      <td className="py-1.5">{capitalizarCargo(l.cargo_nome ?? "")}</td>
                      <td className="py-1.5 text-right font-mono">{fmtNum(l.total)}</td>
                      <td className="py-1.5 text-right font-mono">{fmtNum(l.eleitos)}</td>
                      <td className="py-1.5 text-right font-mono text-muted-foreground hidden sm:table-cell">
                        {l.bens_medio != null ? fmtBRL(Number(l.bens_medio)) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>
    </div>
  );
}
