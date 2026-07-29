import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { AnomaliaInvestigacao } from "@/components/AnomaliaInvestigacao";
import { detalheQualidadePublico } from "@/lib/data/qa.functions";

export const Route = createFileRoute("/qualidade/$id")({
  component: QualidadeDetalhePage,
  head: () => ({
    meta: [
      { title: "Defeito auditado — Mutirão de Dados" },
      {
        name: "description",
        content:
          "Registro público de uma inconsistência detectada nas bases oficiais, com trilha completa de detecção, revalidação e reporte.",
      },
    ],
  }),
});

function QualidadeDetalhePage() {
  const { id } = Route.useParams();
  const fetchDet = useServerFn(detalheQualidadePublico);
  const { data, isLoading } = useQuery({
    queryKey: ["qa-detalhe-pub", id],
    queryFn: () => fetchDet({ data: { id } }),
    staleTime: 60_000,
  });

  if (isLoading)
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  if (!data) throw notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-6">
      <Link
        to="/qualidade"
        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="size-3.5" /> voltar para qualidade
      </Link>
      <header>
        <span className="inline-block text-xs font-semibold tracking-widest text-accent uppercase">
          Defeito auditado
        </span>
        <h1 className="font-display text-3xl mt-1">
          {data.entidade.tipo} {data.entidade.id}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Inconsistência detectada na base <strong>{data.fonte}</strong> pela
          regra <code className="text-xs">{data.regra}</code>. Esta página é o
          registro público — sem dados internos nem ações administrativas.
        </p>
      </header>
      <AnomaliaInvestigacao anomalia={data} modo="publico" />
    </div>
  );
}