import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { coberturaPublica } from "@/lib/data/cobertura-publica.functions";
import { iconFor } from "@/lib/nav-groups";
import { ExternalLink } from "lucide-react";

export const Route = createFileRoute("/transferegov")({
  component: TransferegovPage,
  head: () => ({
    meta: [
      { title: "Transferegov — Mutirão de Dados" },
      {
        name: "description",
        content:
          "O que o Transferegov cobre no Mutirão de Dados: convênios/contratos de repasse (SICONV) e as transferências diretas da EC 105 (emendas Pix).",
      },
    ],
  }),
});

const MODALIDADES: Array<{
  to: string;
  search?: Record<string, string>;
  label: string;
  desc: string;
  count: (m: Map<string, number>) => number | null;
}> = [
  {
    // O acervo do Transferegov vive na página do TIPO de dado, sob a aba da
    // fonte — mesmo padrão de /contratos. Sem o `?fonte=`, o visitante caía
    // no recorte da CGU e via a página vazia.
    to: "/convenios",
    search: { fonte: "transferegov" as const },
    label: "Convênios e contratos de repasse",
    desc: "Instrumentos clássicos (SICONV) com plano de trabalho, contrapartida e prestação de contas.",
    count: (m) => m.get("transferegov") ?? null,
  },
  {
    // EC 105 são um tipo de EMENDA — a página é /emendas (filtre por tipo).
    to: "/emendas",
    label: "Emendas Pix (EC 105)",
    desc: "Especiais (livre aplicação) e com finalidade definida (carimbadas), repassadas direto ao ente. São um tipo de emenda — abra em Emendas e filtre por tipo.",
    count: (m) => m.get("cgu_emendas") ?? null,
  },
];

function TransferegovPage() {
  const fetchCob = useServerFn(coberturaPublica);
  const { data } = useQuery({ queryKey: ["cobertura-publica"], queryFn: () => fetchCob() });
  const totalPorId = new Map((data?.fontes ?? []).map((f) => [f.id, f.totalRegistros] as const));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      <header>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          Por fonte de dados
        </div>
        <h1 className="font-display text-4xl mt-1">Transferegov</h1>
        <p className="text-muted-foreground mt-3 max-w-3xl leading-relaxed">
          Sistema federal das transferências voluntárias da União a estados, municípios e OSCs
          (ex-SICONV/+Brasil). Convênios chegam pelo espelho da CGU; as transferências diretas da EC
          105/2019 ("emendas Pix") pela API do Transferegov e pelo Portal da Transparência.{" "}
          <a
            href="https://www.gov.br/transferegov"
            target="_blank"
            rel="noreferrer"
            className="text-accent underline"
          >
            gov.br/transferegov <ExternalLink className="inline size-3" />
          </a>
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {MODALIDADES.map((m) => {
          const Icon = iconFor(m.to);
          const total = m.count(totalPorId);
          return (
            <Link
              key={m.to}
              to={m.to}
              search={m.search}
              className="rounded-2xl border border-border bg-card p-5 hover:border-accent transition-colors"
            >
              <div className="flex items-center gap-2 font-medium">
                <Icon className="size-4 text-muted-foreground" /> {m.label}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{m.desc}</p>
              <div className="text-xs text-muted-foreground mt-3">
                {total != null ? `${total.toLocaleString("pt-BR")} registros em cache` : "—"}
              </div>
            </Link>
          );
        })}
      </section>

      <p className="text-[11px] text-muted-foreground border-t border-border pt-4">
        As emendas Pix têm baixa rastreabilidade do uso final — ponto crítico de fiscalização da EC
        105. Cobertura por mês em{" "}
        <Link to="/cobertura" className="text-accent underline">
          /cobertura
        </Link>
        . Detalhes em <code>docs/fontes/transferegov.md</code>.
      </p>
    </div>
  );
}
