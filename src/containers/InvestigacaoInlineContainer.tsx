import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  findingPorChave,
  promoverParaFinding,
  marcarStatusFinding,
  salvarReporteFinding,
  salvarNotaFinding,
} from "@/lib/data/qa.functions";
import {
  chaveQueryKey,
  candidatoParaPromocao,
  passaStatusFilter,
  type CandidatoInvestigacao,
} from "@/lib/investigacao-inline/logic";
import { InvestigacaoInlineView } from "@/components/InvestigacaoInlineView";
import type { AnomaliaInvestigacaoCurl } from "@/lib/anomalia-investigacao/types";

export type InvestigacaoInlineContainerProps = {
  candidato: CandidatoInvestigacao;
  children: React.ReactNode;
  statusFilter?: string;
  curls?: AnomaliaInvestigacaoCurl[];
};

export function InvestigacaoInlineContainer({
  candidato,
  children,
  statusFilter,
  curls,
}: InvestigacaoInlineContainerProps) {
  const qc = useQueryClient();
  const fetchFinding = useServerFn(findingPorChave);
  const mutPromover = useServerFn(promoverParaFinding);
  const mutStatus = useServerFn(marcarStatusFinding);
  const mutReporte = useServerFn(salvarReporteFinding);
  const mutNota = useServerFn(salvarNotaFinding);

  const chave = chaveQueryKey(candidato);

  const { data: finding, isLoading } = useQuery({
    queryKey: chave,
    queryFn: () =>
      fetchFinding({
        data: {
          fonte: candidato.fonte,
          entidade_tipo: candidato.entidade_tipo,
          entidade_id: candidato.entidade_id,
          regra: candidato.regra,
          origem: candidato.origem,
        },
      }),
  });

  const [promovendo, setPromovendo] = React.useState(false);
  const invalidar = React.useCallback(() => qc.refetchQueries({ queryKey: chave }), [qc, chave]);

  const autoTried = React.useRef(false);
  React.useEffect(() => {
    if (isLoading || finding || autoTried.current) return;
    autoTried.current = true;
    setPromovendo(true);
    mutPromover({ data: candidatoParaPromocao(candidato) })
      .then(() => invalidar())
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setPromovendo(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, finding]);

  if (!passaStatusFilter(finding?.status, statusFilter)) return null;

  const onPromover = async () => {
    setPromovendo(true);
    try {
      await mutPromover({ data: candidatoParaPromocao(candidato) });
      toast.success("Investigação aberta.");
      invalidar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPromovendo(false);
    }
  };

  const actions = finding
    ? {
        onReportar: async (canal: string, protocolo: string) => {
          await mutReporte({ data: { id: finding.id, canal, protocolo: protocolo || undefined } });
          invalidar();
        },
        onConfirmar: async () => {
          await mutStatus({ data: { id: finding.id, status: "confirmado" } });
          invalidar();
        },
        onMarcarCorrigido: async () => {
          await mutStatus({ data: { id: finding.id, status: "corrigido_origem" } });
          invalidar();
        },
        onMarcarFalsoPositivo: async () => {
          await mutStatus({ data: { id: finding.id, status: "falso_positivo" } });
          invalidar();
        },
        onSalvarNota: async (nota: string) => {
          await mutNota({ data: { id: finding.id, nota } });
          invalidar();
        },
      }
    : undefined;

  return (
    <InvestigacaoInlineView
      isLoading={isLoading}
      finding={finding ?? null}
      promovendo={promovendo}
      onPromover={onPromover}
      curls={curls}
      actions={actions}
      notaInicial={finding?.notas_admin ?? null}
    >
      {children}
    </InvestigacaoInlineView>
  );
}

InvestigacaoInlineContainer.displayName = "InvestigacaoInlineContainer";