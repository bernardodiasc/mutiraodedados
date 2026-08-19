import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listarContestacoesAdmin,
  atualizarContestacao,
  listarMarcacoesAdmin,
  deletarMarcacao,
  agregadoMarcacoes,
} from "@/lib/data/marcacoes.functions";
import { AdminMarcacoesView } from "@/components/AdminMarcacoesView";
import type { Aba, EntidadeTipo, StatusContestacao } from "@/lib/admin-marcacoes/logic";

export function AdminMarcacoesContainer() {
  const qc = useQueryClient();
  const fetchAgg = useServerFn(agregadoMarcacoes);
  const fetchContestacoes = useServerFn(listarContestacoesAdmin);
  const mutContestacao = useServerFn(atualizarContestacao);
  const fetchMarcacoes = useServerFn(listarMarcacoesAdmin);
  const mutDeletar = useServerFn(deletarMarcacao);

  const [aba, setAba] = React.useState<Aba>("contestacoes");
  const [statusCt, setStatusCt] = React.useState<string>("aberta");
  const [tipoFlag, setTipoFlag] = React.useState<string>("");
  const [statusFlag, setStatusFlag] = React.useState<string>("aberto");

  const { data: agg } = useQuery({
    queryKey: ["marc-agg"],
    queryFn: () => fetchAgg(),
  });

  const ctsQuery = useQuery({
    queryKey: ["marc-ct", statusCt],
    queryFn: () =>
      fetchContestacoes({
        data: statusCt ? { status: statusCt as StatusContestacao } : {},
      }),
    enabled: aba === "contestacoes",
  });

  const flQuery = useQuery({
    queryKey: ["marc-fl", tipoFlag],
    queryFn: () =>
      fetchMarcacoes({
        data: tipoFlag ? { entidade_tipo: tipoFlag as EntidadeTipo } : {},
      }),
    enabled: aba === "marcacoes",
  });

  const invalidar = () => {
    qc.refetchQueries({ queryKey: ["marc-ct"] });
    qc.refetchQueries({ queryKey: ["marc-fl"] });
    qc.refetchQueries({ queryKey: ["marc-agg"] });
  };

  return (
    <AdminMarcacoesView
      agg={agg}
      aba={aba}
      setAba={setAba}
      statusCt={statusCt}
      setStatusCt={setStatusCt}
      tipoFlag={tipoFlag}
      setTipoFlag={setTipoFlag}
      statusFlag={statusFlag}
      setStatusFlag={setStatusFlag}
      contestacoes={{ isLoading: ctsQuery.isLoading, data: ctsQuery.data }}
      marcacoes={{ isLoading: flQuery.isLoading, data: flQuery.data }}
      onSalvarContestacao={async (c, status, resposta) => {
        try {
          await mutContestacao({ data: { id: c.id, status, resposta } });
          toast.success("Contestação atualizada.");
          invalidar();
        } catch (e) {
          toast.error((e as Error).message);
        }
      }}
      onDeletarMarcacao={async (f) => {
        try {
          await mutDeletar({ data: { id: f.id } });
          toast.success("Marcação removida.");
          invalidar();
        } catch (e) {
          toast.error((e as Error).message);
        }
      }}
    />
  );
}
