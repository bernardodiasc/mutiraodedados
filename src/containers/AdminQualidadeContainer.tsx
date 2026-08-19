import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AdminQualidadeView } from "@/components/AdminQualidadeView";
import {
  listarQualidadeAdmin,
  agregadoQualidade,
  marcarStatusFinding,
  salvarReporteFinding,
  salvarNotaFinding,
  revalidarFindingCgu,
} from "@/lib/data/qa.functions";

export function AdminQualidadeContainer() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listarQualidadeAdmin);
  const fetchAgg = useServerFn(agregadoQualidade);
  const mutStatus = useServerFn(marcarStatusFinding);
  const mutReporte = useServerFn(salvarReporteFinding);
  const mutNota = useServerFn(salvarNotaFinding);
  const mutRevalUm = useServerFn(revalidarFindingCgu);

  const [fonte, setFonte] = React.useState<string | undefined>(undefined);
  const [status, setStatus] = React.useState<string | undefined>("aberto");
  const [regra, setRegra] = React.useState<string | undefined>(undefined);
  const [tipo, setTipo] = React.useState<string | undefined>(undefined);

  const { data: aggData = { fontes: [], regras: [] } } = useQuery({
    queryKey: ["qa-agg"],
    queryFn: () => fetchAgg(),
  });
  const { data: findings = [], isLoading } = useQuery({
    queryKey: ["qa-list", fonte, status, regra, tipo],
    queryFn: () =>
      fetchList({
        data: {
          fonte,
          status,
          regra,
          tipo: tipo as "qualidade" | "lacuna" | "investigativo" | undefined,
          limit: 200,
        },
      }),
  });

  const invalidar = () => {
    qc.refetchQueries({ queryKey: ["qa-list"] });
    qc.refetchQueries({ queryKey: ["qa-agg"] });
  };

  return (
    <AdminQualidadeView
      fonte={fonte}
      status={status}
      regra={regra}
      tipo={tipo}
      onChangeFonte={setFonte}
      onChangeStatus={setStatus}
      onChangeRegra={setRegra}
      onChangeTipo={setTipo}
      agg={aggData.fontes}
      findings={findings}
      isLoading={isLoading}
      actions={{
        onRevalidarCgu: async (id) => {
          const r = await mutRevalUm({ data: { id } });
          const sufixoLista = r.lista?.achado ? ` (lista pág. ${r.lista.pagina})` : "";
          if (r.resultado === "confirmado") {
            toast.success(
              `Divergência confirmada${sufixoLista}: cache R$${r.valor_armazenado} → Portal R$${r.valor_detalhe}. Erro real na origem, segue para reporte.`,
            );
          } else if (r.resultado === "corrigido_origem") {
            toast.success(
              `Cache corrigido${sufixoLista}: valor errado R$${r.valor_armazenado} → valor oficial R$${r.valor_detalhe}.`,
            );
          } else if (r.resultado === "inconclusivo") {
            toast.warning(
              `Inconclusivo: só o detalhe pôde ser lido (R$${r.valor_detalhe}) e ele diverge do cache. Nada foi alterado — repita a re-checagem.`,
            );
          } else {
            toast.message(
              `Falso positivo${sufixoLista}: a fonte oficial não sustenta a suspeita. Portal retorna R$${r.valor_detalhe}.`,
            );
          }
          invalidar();
          return r;
        },
        onReportar: async (id, canal, protocolo) => {
          await mutReporte({ data: { id, canal, protocolo: protocolo || undefined } });
          invalidar();
        },
        onConfirmar: async (id) => {
          await mutStatus({ data: { id, status: "confirmado" } });
          invalidar();
        },
        onMarcarCorrigido: async (id) => {
          await mutStatus({ data: { id, status: "corrigido_origem" } });
          invalidar();
        },
        onMarcarFalsoPositivo: async (id) => {
          await mutStatus({ data: { id, status: "falso_positivo" } });
          invalidar();
        },
        onSalvarNota: async (id, nota) => {
          await mutNota({ data: { id, nota } });
          invalidar();
        },
      }}
    />
  );
}
