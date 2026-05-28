import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { camaraOverview } from "@/lib/data/camara/queries.functions";
import { AvisoMetodologico } from "@/components/AvisoMetodologico";
import { fmtBRL } from "@/lib/fmt";
import { Building2, Users, Receipt, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/camara")({
  component: CamaraHome,
  head: () => ({
    meta: [
      { title: "Câmara dos Deputados — Auditoria Cidadã" },
      {
        name: "description",
        content:
          "Cadastro, despesas (CEAP) e atividade dos 513 deputados federais — dados abertos da Câmara, organizados para interpretação cidadã.",
      },
    ],
  }),
});

function CamaraHome() {
  const fn = useServerFn(camaraOverview);
  const { data, isLoading } = useQuery({ queryKey: ["camara", "overview"], queryFn: () => fn() });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-8">
      <header>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">Poder Legislativo</div>
        <h1 className="font-display text-4xl mt-1">Câmara dos Deputados</h1>
        <p className="text-muted-foreground mt-3 max-w-3xl leading-relaxed">
          513 deputados federais, eleitos por estado, formam a Casa do povo no Congresso
          Nacional. Esta área reorganiza os dados abertos publicados pela Câmara em{" "}
          <a
            href="https://dadosabertos.camara.leg.br/"
            target="_blank"
            rel="noreferrer"
            className="text-accent underline"
          >
            dadosabertos.camara.leg.br
          </a>{" "}
          para que cidadãos possam interpretar — não apenas consultar — gastos, autorias e
          comportamento parlamentar.
        </p>
      </header>

      <AvisoMetodologico />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={<Users className="size-4" />}
          label="Deputados em cache"
          value={isLoading ? "…" : String(data?.totalDeputados ?? 0)}
        />
        <Stat
          icon={<Receipt className="size-4" />}
          label="Despesas CEAP carregadas"
          value={isLoading ? "…" : String(data?.totalDespesas ?? 0)}
        />
        <Stat
          icon={<Building2 className="size-4" />}
          label="Total reembolsado (CEAP)"
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
          to="/camara/deputados"
          title="Deputados"
          desc="Cadastro completo da legislatura: nome, partido, UF, foto e contato — com link para gastos individuais."
        />
        <CardLink
          to="/camara/proposicoes"
          title="Proposições legislativas"
          desc="PLs, PECs, MPVs e demais proposições — busca por ementa, tipo e ano, com autoria e tramitação."
        />
        <CardLink
          to="/camara/votacoes"
          title="Votações nominais"
          desc="Resultados de votações em plenário e comissões, com índice de disciplina partidária por partido e UF."
        />
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-display text-xl">O que é CEAP?</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          A <strong>Cota para Exercício da Atividade Parlamentar</strong> é um limite mensal
          de despesas que cada deputado pode <em>reembolsar</em> contra gastos do mandato —
          passagens, combustível, aluguel de escritório, telefone, divulgação. O valor varia
          por UF (a Câmara cobre o deslocamento). <strong>CEAP não é salário</strong>: é
          dinheiro público que paga fornecedores mediante apresentação de nota fiscal. É
          justamente por ser ressarcimento que os dados são tão ricos — cada despesa tem
          fornecedor, valor e, frequentemente, link direto para o documento fiscal.
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