import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DiagnosticoBuscaView, type RecorteReindexar } from "@/components/DiagnosticoBuscaView";
import { diagnosticoBusca, reindexarBusca } from "@/lib/data/diagnostico-busca.functions";
import { lerIds } from "@/lib/diagnostico-busca/logic";

export function DiagnosticoBuscaContainer() {
  const diagnosticoFn = useServerFn(diagnosticoBusca);
  const reindexarFn = useServerFn(reindexarBusca);
  const diagnostico = useQuery({
    queryKey: ["admin", "diagnostico-busca"],
    queryFn: () => diagnosticoFn(),
    staleTime: 60 * 1000,
  });

  const [recorte, setRecorte] = React.useState<RecorteReindexar | null>(null);
  const [reindexando, setReindexando] = React.useState(false);
  const [resultado, setResultado] = React.useState<{ colecao: string; texto: string } | null>(null);

  const reindexar = async () => {
    if (!recorte) return;
    const ids = lerIds(recorte.idsTexto);
    setReindexando(true);
    try {
      const r = await reindexarFn({
        data: { colecao: recorte.colecao, ids: ids.length ? ids : undefined },
      });
      setResultado({
        colecao: recorte.colecao,
        texto: `${r.alteradas.toLocaleString("pt-BR")} linhas gravadas ou retiradas do índice.`,
      });
      setRecorte(null);
      await diagnostico.refetch();
    } catch (e) {
      setResultado({ colecao: recorte.colecao, texto: (e as Error).message });
    } finally {
      setReindexando(false);
    }
  };

  return (
    <DiagnosticoBuscaView
      estado={diagnostico.isPending ? "carregando" : diagnostico.isError ? "erro" : "pronto"}
      linhas={diagnostico.data ?? []}
      mensagemErro={diagnostico.error instanceof Error ? diagnostico.error.message : null}
      atualizando={diagnostico.isFetching && !diagnostico.isPending}
      onAtualizar={() => void diagnostico.refetch()}
      recorte={recorte}
      onAbrirRecorte={(colecao) => {
        setRecorte({ colecao, idsTexto: "" });
        setResultado(null);
      }}
      onIdsTexto={(idsTexto) => setRecorte((r) => (r ? { ...r, idsTexto } : r))}
      onCancelarRecorte={() => setRecorte(null)}
      onReindexar={() => void reindexar()}
      reindexando={reindexando}
      resultado={resultado}
    />
  );
}
