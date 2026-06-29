import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { findingsPorEntidade } from "@/lib/data/qa.functions";
import { QualidadeBannerView } from "@/components/QualidadeBannerView";

export type QualidadeBannerContainerProps = {
  fonte: string;
  entidadeTipo: string;
  entidadeId: string;
};

export function QualidadeBannerContainer({
  fonte,
  entidadeTipo,
  entidadeId,
}: QualidadeBannerContainerProps) {
  const fetchFn = useServerFn(findingsPorEntidade);
  const { data: findings = [], isLoading } = useQuery({
    queryKey: ["qa-banner", fonte, entidadeTipo, entidadeId],
    queryFn: () =>
      fetchFn({ data: { fonte, entidade_tipo: entidadeTipo, entidade_id: entidadeId } }),
    staleTime: 5 * 60_000,
  });

  const findingsCount = findings.length;
  const principalFinding = findingsCount > 0 ? findings[0] : null;

  return (
    <QualidadeBannerView
      findingsCount={findingsCount}
      principalFinding={principalFinding}
      isLoading={isLoading}
    />
  );
}
QualidadeBannerContainer.displayName = "QualidadeBannerContainer";
