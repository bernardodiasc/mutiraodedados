import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { findingsPorEntidade } from "@/lib/data/qa.functions";

const STATUS_LABEL: Record<string, string> = {
  aberto: "em análise",
  confirmado: "divergência confirmada",
  reportado: "reportada ao órgão",
};

export function QualidadeBanner({
  fonte,
  entidadeTipo,
  entidadeId,
}: {
  fonte: string;
  entidadeTipo: string;
  entidadeId: string;
}) {
  const fetchFn = useServerFn(findingsPorEntidade);
  const { data: findings = [] } = useQuery({
    queryKey: ["qa-banner", fonte, entidadeTipo, entidadeId],
    queryFn: () =>
      fetchFn({ data: { fonte, entidade_tipo: entidadeTipo, entidade_id: entidadeId } }),
    staleTime: 5 * 60_000,
  });

  if (findings.length === 0) return null;
  const principal = findings[0];

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
      <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div className="text-sm">
        <div className="font-medium text-foreground">
          Inconsistência sinalizada nesta página
          {findings.length > 1 ? ` (${findings.length})` : ""}.
        </div>
        <p className="text-muted-foreground mt-1">
          {STATUS_LABEL[principal.status] ?? principal.status} — regra{" "}
          <code className="text-xs">{principal.regra}</code>.{" "}
          <Link
            to="/qualidade/$id"
            params={{ id: principal.id }}
            className="text-accent underline"
          >
            Ver registro público
          </Link>
          .
        </p>
      </div>
    </div>
  );
}