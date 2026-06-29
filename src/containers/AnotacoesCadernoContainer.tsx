import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  criarAnotacao,
  atualizarAnotacao,
  listarMinhasAnotacoes,
  excluirAnotacao,
  type Anotacao,
} from "@/lib/anotacoes.functions";
import {
  type AnotacaoDraft,
  DRAFT_INICIAL,
  draftDeAnotacao,
} from "@/lib/anotacoes-caderno/logic";
import { AnotacoesCadernoView } from "@/components/AnotacoesCadernoView";

export function AnotacoesCadernoContainer() {
  const listar = useServerFn(listarMinhasAnotacoes);
  const criar = useServerFn(criarAnotacao);
  const atualizar = useServerFn(atualizarAnotacao);
  const excluir = useServerFn(excluirAnotacao);
  const queryClient = useQueryClient();
  const [draft, setDraft] = React.useState<AnotacaoDraft | null>(null);
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["anotacoes", "minhas"],
    queryFn: () => listar(),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["anotacoes", "minhas"] });

  const salvarMutation = useMutation({
    mutationFn: async (d: AnotacaoDraft) => {
      if (d.id === "new") {
        return criar({
          data: { titulo: d.titulo || null, conteudo_md: d.conteudo_md },
        });
      }
      return atualizar({
        data: { id: d.id, titulo: d.titulo || null, conteudo_md: d.conteudo_md },
      });
    },
    onSuccess: () => {
      toast.success("Anotação salva");
      setDraft(null);
      invalidate();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  const removerMutation = useMutation({
    mutationFn: async (id: string) => excluir({ data: { id } }),
    onMutate: (id) => setRemovingId(id),
    onSuccess: () => {
      toast.success("Anotação removida");
      invalidate();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao remover"),
    onSettled: () => setRemovingId(null),
  });

  return (
    <AnotacoesCadernoView
      anotacoes={(data ?? []) as Anotacao[]}
      isLoading={isLoading}
      errorMsg={error instanceof Error ? error.message : null}
      draft={draft}
      isSaving={salvarMutation.isPending}
      removingId={removingId}
      onComecarNova={() => setDraft({ ...DRAFT_INICIAL })}
      onComecarEditar={(a) => setDraft(draftDeAnotacao(a))}
      onCancelar={() => setDraft(null)}
      onAlterarDraft={(patch) =>
        setDraft((prev) => (prev ? { ...prev, ...patch } : prev))
      }
      onSalvarDraft={() => {
        if (draft) salvarMutation.mutate(draft);
      }}
      onRemover={(id) => {
        if (confirm("Remover esta anotação?")) removerMutation.mutate(id);
      }}
    />
  );
}

AnotacoesCadernoContainer.displayName = "AnotacoesCadernoContainer";