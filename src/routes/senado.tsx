import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { senadoOverview } from "@/lib/data/senado/queries.functions";
import { AvisoMetodologico } from "@/components/AvisoMetodologico";
import { fmtBRL } from "@/lib/fmt";
import { Building2, Users, Receipt, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/senado")({
  component: SenadoHome,
  head: () => ({
    meta: [
      { title: "Senado Federal — Mutirão de Dados" },
      {
        name: "description",
        content:
          "Cadastro, despesas (CEAPS), matérias e votações dos 81 senadores — dados abertos do Senado, organizados para interpretação cidadã.",
      },
    ],
  }),
});

function SenadoHome() {
  const fn = useServerFn(senadoOverview);
  const { data, isLoading } = useQuery({ queryKey: ["senado", "overview"], queryFn: () => fn() });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-8">
      <header>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          Poder Legislativo
        </div>
        <h1 className="font-display text-4xl mt-1">Senado Federal</h1>
        <p className="text-muted-foreground mt-3 max-w-3xl leading-relaxed">
          81 senadores (três por estado) representam as unidades da federação no Congresso Nacional.
          Esta área reorganiza os dados abertos publicados pelo Senado em{" "}
          <a
            href="https://legis.senado.leg.br/dadosabertos/"
            target="_blank"
            rel="noreferrer"
            className="text-accent underline"
          >
            legis.senado.leg.br/dadosabertos
          </a>{" "}
          para que cidadãos possam interpretar — não apenas consultar — gastos, autorias e
          comportamento parlamentar.
        </p>
      </header>

      <AvisoMetodologico />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={<Users className="size-4" />}
          label="Senadores em cache"
          value={isLoading ? "…" : String(data?.totalSenadores ?? 0)}
        />
        <Stat
          icon={<Receipt className="size-4" />}
          label="Despesas CEAPS"
          value={isLoading ? "…" : String(data?.totalDespesas ?? 0)}
        />
        <Stat
          icon={<Building2 className="size-4" />}
          label="Total reembolsado"
          value={isLoading ? "…" : fmtBRL(data?.totalGasto ?? 0)}
        />
        <Stat
          icon={<ExternalLink className="size-4" />}
          label="Período coberto"
          value={
            isLoading
              ? "…"
              : data?.periodoInicio && data.periodoFim
                ? `${data.periodoInicio} → ${data.periodoFim}`
                : "—"
          }
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <CardLink
          to="/senado/senadores"
          title="Senadores"
          desc="Cadastro completo dos 81 senadores + ranking de gastos da Cota (CEAPS)."
        />
        <CardLink
          to="/senado/materias"
          title="Matérias legislativas"
          desc="PLs, PECs, MPVs e demais matérias com ementa e autoria."
        />
        <CardLink
          to="/senado/votacoes"
          title="Votações nominais"
          desc="Resultados de votações em plenário com disciplina partidária."
        />
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-display text-xl">O que é CEAPS?</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          A <strong>Cota para Exercício da Atividade Parlamentar do Senado (CEAPS)</strong> é o
          equivalente da CEAP da Câmara: um limite mensal de despesas reembolsáveis vinculadas ao
          mandato (passagem, combustível, divulgação, escritório, telefone). O valor varia conforme
          a UF do senador. Como é ressarcimento mediante nota fiscal, os dados trazem fornecedor,
          valor e detalhamento — material rico para investigação cidadã.
        </p>
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
        {icon} {label}
      </div>
      <div className="font-display text-2xl mt-2 leading-none">{value}</div>
    </div>
  );
}

function CardLink({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link
      to={to}
      className="block rounded-xl border border-border bg-card p-5 hover:border-accent transition-colors"
    >
      <div className="font-display text-lg">{title}</div>
      <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{desc}</p>
    </Link>
  );
}
