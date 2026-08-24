import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AnomaliaInvestigacao } from "@/components/AnomaliaInvestigacao";
import { detalheQualidadePublico } from "@/lib/data/qa.functions";
import { TrilhaDeNavegacao } from "@/components/TrilhaDeNavegacao";
import { rotaDaEntidade } from "@/lib/secao-vinculos/logic";
import { FONTE_SINAL_LABEL, SINAIS_CATALOGO } from "@/lib/sinais-catalogo";

export const Route = createFileRoute("/qualidade/$id")({
  component: QualidadeDetalhePage,
  head: () => ({
    meta: [
      { title: "Alerta de qualidade — Mutirão de Dados" },
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
      <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-muted-foreground">Carregando…</div>
    );
  if (!data) throw notFound();

  const fonteLabel = FONTE_SINAL_LABEL[data.fonte] ?? data.fonte;
  const regraLabel = SINAIS_CATALOGO.find((s) => s.slug === data.regra)?.label ?? data.regra;
  const rotaEntidade = rotaDaEntidade(data.entidade.tipo, data.entidade.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-6">
      <TrilhaDeNavegacao
        itens={[{ label: "Qualidade dos dados", to: "/qualidade" }, { label: "Alerta" }]}
      />
      <header>
        <span className="inline-block text-xs font-semibold tracking-widest text-accent uppercase">
          Registro público de qualidade
        </span>
        <h1 className="font-display text-3xl mt-1">Alerta de qualidade</h1>
        <p className="text-sm mt-3">
          Registro afetado:{" "}
          {rotaEntidade ? (
            <Link
              to={rotaEntidade.to as never}
              params={rotaEntidade.params as never}
              className="text-accent hover:underline"
            >
              <span className="font-medium">{data.entidade.tipo}</span>{" "}
              <code className="text-xs">{data.entidade.id}</code>
            </Link>
          ) : (
            <>
              <span className="font-medium">{data.entidade.tipo}</span>{" "}
              <code className="text-xs">{data.entidade.id}</code>
            </>
          )}
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Inconsistência detectada nos dados de <strong>{fonteLabel}</strong> pela regra "
          {regraLabel}". Esta página é o registro público do processo de verificação — da detecção
          ao reporte à fonte oficial.
        </p>
      </header>
      <AnomaliaInvestigacao anomalia={data} modo="publico" />
    </div>
  );
}
