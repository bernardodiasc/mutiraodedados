import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { downloadCSV } from "@/lib/csv";
import {
  CSV_COLUNAS_PERGUNTA,
  draftFromPergunta,
  patchPergunta,
  perguntaParaTextoCopiavel,
  perguntasParaCsv,
  type PerguntaEditDraft,
} from "@/lib/admin-perguntas/logic";
import {
  listarPerguntasPublicasAdmin,
  editarPerguntaAdmin,
  despublicarPergunta,
  reordenarPerguntasPublicas,
  type Pergunta,
} from "@/lib/perguntas.functions";
import { AdminPerguntasPublicasView } from "@/components/AdminPerguntasPublicasView";

const CHAVE = ["admin", "perguntas", "publicas"];
const DRAFT_VAZIO: PerguntaEditDraft = { titulo: "", descricao: "", contexto: "", slug: "" };

export function PerguntasPublicasContainer() {
  const listar = useServerFn(listarPerguntasPublicasAdmin);
  const editar = useServerFn(editarPerguntaAdmin);
  const despublicar = useServerFn(despublicarPergunta);
  const reordenar = useServerFn(reordenarPerguntasPublicas);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: CHAVE, queryFn: () => listar() });
  const invalidar = () => qc.invalidateQueries({ queryKey: CHAVE });
  const erro = (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro");

  const [editandoId, setEditandoId] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState<PerguntaEditDraft>(DRAFT_VAZIO);

  const acaoEditar = useMutation({
    mutationFn: async () => {
      const alvo = (data ?? []).find((p) => p.id === editandoId);
      if (!alvo) return;
      return editar({ data: { id: alvo.id, ...patchPergunta(alvo, editDraft) } });
    },
    onSuccess: () => {
      toast.success("Pergunta atualizada");
      setEditandoId(null);
      setEditDraft(DRAFT_VAZIO);
      invalidar();
    },
    onError: erro,
  });
  const acaoDespublicar = useMutation({
    mutationFn: async (id: string) => despublicar({ data: { id } }),
    onSuccess: () => {
      toast.success("Pergunta despublicada");
      invalidar();
    },
    onError: erro,
  });
  const acaoReordenar = useMutation({
    mutationFn: async (ids: string[]) => reordenar({ data: { ids } }),
    onSuccess: invalidar,
    onError: erro,
  });

  const onCopiar = async (p: Pergunta) => {
    try {
      await navigator.clipboard.writeText(perguntaParaTextoCopiavel(p));
      toast.success("Texto da pergunta copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <AdminPerguntasPublicasView
      isLoading={isLoading}
      perguntas={data ?? []}
      podeArrastar={editandoId === null}
      onReordenar={(ids) => acaoReordenar.mutate(ids)}
      onBaixarCsv={() =>
        downloadCSV("perguntas_publicas", perguntasParaCsv(data ?? []), CSV_COLUNAS_PERGUNTA)
      }
      editandoId={editandoId}
      editDraft={editDraft}
      setEditDraft={setEditDraft}
      onStartEdit={(p) => {
        setEditandoId(p.id);
        setEditDraft(draftFromPergunta(p));
      }}
      onCancelEdit={() => {
        setEditandoId(null);
        setEditDraft(DRAFT_VAZIO);
      }}
      onEditSalvar={() => acaoEditar.mutate()}
      editSalvando={acaoEditar.isPending}
      onCopiar={onCopiar}
      onDespublicar={(p) => {
        if (confirm("Despublicar esta pergunta? Ela volta para o caderno do autor."))
          acaoDespublicar.mutate(p.id);
      }}
    />
  );
}

PerguntasPublicasContainer.displayName = "PerguntasPublicasContainer";
