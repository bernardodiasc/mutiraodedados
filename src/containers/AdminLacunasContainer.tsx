import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AdminLacunasView, type FindingConversivel } from "@/components/AdminLacunasView";
import {
  listarLacunasAdmin,
  criarLacuna,
  atualizarLacuna,
  converterFindingEmLacuna,
  type LacunaTipo,
  type LacunaCiclo,
} from "@/lib/lacunas.functions";
import { listarQualidadeAdmin } from "@/lib/data/qa.functions";

export function AdminLacunasContainer() {
  const qc = useQueryClient();
  const fetchLacunas = useServerFn(listarLacunasAdmin);
  const fetchFindings = useServerFn(listarQualidadeAdmin);
  const mutCriar = useServerFn(criarLacuna);
  const mutAtualizar = useServerFn(atualizarLacuna);
  const mutConverter = useServerFn(converterFindingEmLacuna);

  const [filtroTipo, setFiltroTipo] = React.useState("");
  const [filtroCiclo, setFiltroCiclo] = React.useState("");

  const { data: lacunas = [], isLoading } = useQuery({
    queryKey: ["admin-lacunas", filtroTipo, filtroCiclo],
    queryFn: () =>
      fetchLacunas({
        data: {
          tipo: (filtroTipo || undefined) as LacunaTipo | undefined,
          ciclo: (filtroCiclo || undefined) as LacunaCiclo | undefined,
        },
      }),
  });

  // Candidatos à conversão: abertos e confirmados. O filtro "ainda sem
  // lacuna" é feito aqui, cruzando com origem_qa_finding_id das lacunas.
  const { data: brutos = [], isLoading: findingsLoading } = useQuery({
    queryKey: ["admin-lacunas-findings"],
    queryFn: async () => {
      const [abertos, confirmados] = await Promise.all([
        fetchFindings({ data: { status: "aberto", limit: 100 } }),
        fetchFindings({ data: { status: "confirmado", limit: 100 } }),
      ]);
      return [...confirmados, ...abertos];
    },
  });

  const { data: todasLacunas = [] } = useQuery({
    queryKey: ["admin-lacunas-todas"],
    queryFn: () => fetchLacunas({ data: {} }),
  });
  const jaConvertidos = React.useMemo(
    () => new Set(todasLacunas.map((l) => l.origem_qa_finding_id).filter(Boolean)),
    [todasLacunas],
  );
  const findings: FindingConversivel[] = React.useMemo(
    () =>
      brutos
        .filter((f) => !jaConvertidos.has(f.id))
        .map((f) => ({
          id: f.id,
          fonte: f.fonte,
          regra: f.regra,
          severidade: f.severidade,
          status: f.status,
          entidade_tipo: f.entidade.tipo,
          entidade_id: f.entidade.id,
        })),
    [brutos, jaConvertidos],
  );

  const invalidar = () => {
    qc.refetchQueries({ queryKey: ["admin-lacunas"] });
    qc.refetchQueries({ queryKey: ["admin-lacunas-todas"] });
    qc.refetchQueries({ queryKey: ["admin-lacunas-findings"] });
  };

  return (
    <AdminLacunasView
      lacunas={lacunas}
      isLoading={isLoading}
      filtroTipo={filtroTipo}
      setFiltroTipo={setFiltroTipo}
      filtroCiclo={filtroCiclo}
      setFiltroCiclo={setFiltroCiclo}
      findings={findings}
      findingsLoading={findingsLoading}
      onCriar={async (dados) => {
        try {
          await mutCriar({ data: dados });
          toast.success("Lacuna criada.");
          invalidar();
        } catch (e) {
          toast.error((e as Error).message);
          throw e;
        }
      }}
      onAtualizar={async (id, patch) => {
        try {
          await mutAtualizar({ data: { id, ...patch } });
          toast.success("Lacuna atualizada.");
          invalidar();
        } catch (e) {
          toast.error((e as Error).message);
        }
      }}
      onConverter={async (findingId, dados) => {
        try {
          await mutConverter({ data: { finding_id: findingId, ...dados } });
          toast.success("Finding convertido em lacuna.");
          invalidar();
        } catch (e) {
          toast.error((e as Error).message);
          throw e;
        }
      }}
    />
  );
}
