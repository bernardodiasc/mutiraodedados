import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { findingsPorEntidade, findingsPorAgregado } from "@/lib/data/qa.functions";
import { QualidadeBannerView } from "@/components/QualidadeBannerView";

export type QualidadeBannerContainerProps =
  | {
      fonte: string;
      entidadeTipo: string;
      entidadeId: string;
      agregado?: undefined;
      agregadoId?: undefined;
    }
  | {
      /**
       * Modo agregado: a ficha é de uma pessoa/órgão, e os findings são dos
       * REGISTROS dela (contratos do CNPJ, despesas do parlamentar) — não de
       * uma entidade exata.
       */
      agregado: "fornecedor" | "orgao" | "deputado" | "senador";
      agregadoId: string;
      fonte?: undefined;
      entidadeTipo?: undefined;
      entidadeId?: undefined;
    };

export function QualidadeBannerContainer(props: QualidadeBannerContainerProps) {
  const fetchEntidade = useServerFn(findingsPorEntidade);
  const fetchAgregado = useServerFn(findingsPorAgregado);
  const { data: findings = [], isLoading } = useQuery({
    queryKey:
      props.agregado !== undefined
        ? ["qa-banner-agg", props.agregado, props.agregadoId]
        : ["qa-banner", props.fonte, props.entidadeTipo, props.entidadeId],
    queryFn: () =>
      props.agregado !== undefined
        ? fetchAgregado({ data: { agregado: props.agregado, id: props.agregadoId } })
        : fetchEntidade({
            data: {
              fonte: props.fonte,
              entidade_tipo: props.entidadeTipo,
              entidade_id: props.entidadeId,
            },
          }),
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
