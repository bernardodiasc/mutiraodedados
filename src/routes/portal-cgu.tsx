import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { coberturaPublica } from "@/lib/data/cobertura-publica.functions";
import { iconFor } from "@/lib/nav-groups";
import { ExternalLink } from "lucide-react";

export const Route = createFileRoute("/portal-cgu")({
  component: PortalCguPage,
  head: () => ({
    meta: [
      { title: "Portal da Transparência (CGU) — Auditoria Cidadã" },
      {
        name: "description",
        content:
          "O que o Portal da Transparência da CGU cobre na Auditoria Cidadã: contratos, licitações, convênios, emendas e transferências do Executivo Federal.",
      },
    ],
  }),
});

// Temas alimentados pelo Portal CGU (eixo "Por tema"). O ícone é derivado da
// navegação (iconFor) para manter consistência visual com o menu.
const TEMAS: Array<{
  to: string;
  label: string;
  desc: string;
  count: (m: Map<string, number>) => number | null;
}> = [
  {
    to: "/contratos",
    label: "Contratos",
    desc: "Acordos firmados com empresas após a licitação.",
    count: (m) => m.get("cgu") ?? null,
  },
  {
    to: "/licitacoes",
    label: "Licitações",
    desc: "A disputa pública que escolhe quem contratar.",
    count: (m) => m.get("cgu_licitacoes") ?? null,
  },
  {
    to: "/convenios",
    label: "Convênios",
    desc: "Repasses da União para estados, municípios e OSCs.",
    count: (m) => m.get("cgu_convenios") ?? null,
  },
  {
    to: "/emendas",
    label: "Emendas parlamentares",
    desc: "Indicações de deputados/senadores, com as 3 fases da despesa.",
    count: (m) => m.get("cgu_emendas") ?? null,
  },
];

function PortalCguPage() {
  const fetchCob = useServerFn(coberturaPublica);
  const { data } = useQuery({ queryKey: ["cobertura-publica"], queryFn: () => fetchCob() });
  const totalPorId = new Map((data?.fontes ?? []).map((f) => [f.id, f.totalRegistros] as const));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      <header>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          Por fonte de dados
        </div>
        <h1 className="font-display text-4xl mt-1">Portal da Transparência (CGU)</h1>
        <p className="text-muted-foreground mt-3 max-w-3xl leading-relaxed">
          O grande livro-caixa do Executivo Federal, gerido pela Controladoria-Geral da União. Uma
          única API alimenta vários temas da plataforma. Para a camada jurídica das contratações
          (edital, termo de referência), o destino é o{" "}
          <Link to="/pncp" className="text-accent underline">
            PNCP
          </Link>
          .{" "}
          <a
            href="https://portaldatransparencia.gov.br"
            target="_blank"
            rel="noreferrer"
            className="text-accent underline"
          >
            portaldatransparencia.gov.br <ExternalLink className="inline size-3" />
          </a>
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {TEMAS.map((t) => {
          const Icon = iconFor(t.to);
          const total = t.count(totalPorId);
          return (
            <Link
              key={t.to}
              to={t.to}
              className="rounded-2xl border border-border bg-card p-5 hover:border-accent transition-colors"
            >
              <div className="flex items-center gap-2 font-medium">
                <Icon className="size-4 text-muted-foreground" /> {t.label}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{t.desc}</p>
              <div className="text-xs text-muted-foreground mt-3">
                {total != null ? `${total.toLocaleString("pt-BR")} registros em cache` : "—"}
              </div>
            </Link>
          );
        })}
      </section>

      <p className="text-[11px] text-muted-foreground border-t border-border pt-4">
        Cobertura detalhada por órgão e mês em{" "}
        <Link to="/cobertura" className="text-accent underline">
          /cobertura
        </Link>
        . Detalhes técnicos da fonte em <code>docs/fontes/portal-cgu.md</code>.
      </p>
    </div>
  );
}
