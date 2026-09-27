import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ReferenciasArtigoView,
  type FormManual,
  type NovaReferencia,
} from "@/components/ReferenciasArtigoView";
import {
  referenciasDoArtigo,
  removerReferencia,
  salvarReferencia,
  sugerirReferencias,
  verificarReferencia,
} from "@/lib/data/artigo-referencias.functions";
import { COLECOES_DO_INDICE } from "@/lib/diagnostico-busca/logic";

export function ReferenciasArtigoContainer({ artigoId }: { artigoId: string }) {
  const qc = useQueryClient();
  const listarFn = useServerFn(referenciasDoArtigo);
  const sugerirFn = useServerFn(sugerirReferencias);
  const salvarFn = useServerFn(salvarReferencia);
  const removerFn = useServerFn(removerReferencia);
  const verificarFn = useServerFn(verificarReferencia);
  const [busy, setBusy] = React.useState(false);
  const [manual, setManual] = React.useState<FormManual>({
    tipo: "registro",
    a: COLECOES_DO_INDICE[0] ?? "",
    b: "",
  });

  const referencias = useQuery({
    queryKey: ["admin-artigo-referencias", artigoId],
    queryFn: () => listarFn({ data: { artigoId } }),
  });
  const sugestoes = useQuery({
    queryKey: ["admin-artigo-sugestoes", artigoId],
    queryFn: () => sugerirFn({ data: { artigoId } }),
  });

  const executar = async (acao: () => Promise<unknown>, sucesso: string) => {
    setBusy(true);
    try {
      await acao();
      toast.success(sucesso);
      await Promise.all([
        referencias.refetch(),
        sugestoes.refetch(),
        qc.invalidateQueries({ queryKey: ["admin-artigos-revisao"] }),
      ]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const erro = referencias.error ?? sugestoes.error;
  return (
    <ReferenciasArtigoView
      estado={
        referencias.isPending || sugestoes.isPending ? "carregando" : erro ? "erro" : "pronto"
      }
      mensagemErro={erro instanceof Error ? erro.message : null}
      referencias={referencias.data ?? []}
      sugestoes={sugestoes.data ?? []}
      colecoes={COLECOES_DO_INDICE}
      busy={busy}
      manual={manual}
      setManual={setManual}
      onConfirmar={(nova: NovaReferencia) =>
        void executar(() => salvarFn({ data: { artigoId, ...nova } }), "Referência adicionada.")
      }
      onRemover={(id) => void executar(() => removerFn({ data: { id } }), "Referência removida.")}
      onVerificar={(id) =>
        void executar(() => verificarFn({ data: { id } }), "Referência marcada como verificada.")
      }
      onAtualizarSugestoes={() => void sugestoes.refetch()}
    />
  );
}
