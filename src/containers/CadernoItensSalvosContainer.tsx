import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listarMeusItens,
  excluirItem,
  verificarSnapshotItem,
  type ItemSalvo,
} from "@/lib/itens-salvos.functions";
import { CadernoItensSalvosView } from "@/components/CadernoItensSalvosView";

export function CadernoItensSalvosContainer() {
  const listar = useServerFn(listarMeusItens);
  const excluir = useServerFn(excluirItem);
  const verificarFn = useServerFn(verificarSnapshotItem);
  const queryClient = useQueryClient();
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [verificandoId, setVerificandoId] = React.useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["itens-salvos", "minhas"],
    queryFn: () => listar(),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => excluir({ data: { id } }),
    onMutate: (id) => setRemovingId(id),
    onSuccess: () => {
      toast.success("Item removido do caderno");
      queryClient.invalidateQueries({ queryKey: ["itens-salvos", "minhas"] });
      queryClient.invalidateQueries({ queryKey: ["itens-salvos", "verificar"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao remover"),
    onSettled: () => setRemovingId(null),
  });

  const verificar = useMutation({
    mutationFn: async (args: { id: string; substituir?: boolean }) => verificarFn({ data: args }),
    onMutate: ({ id }) => setVerificandoId(id),
    onSuccess: (res, args) => {
      if (args.substituir) {
        toast.success("Snapshot atualizado com o dado ao vivo");
      } else if (!res.encontrado) {
        toast.warning("O registro não foi encontrado na base — pode ter sido removido da fonte");
      } else if (res.mudou) {
        toast.warning("O dado mudou desde o seu snapshot — item marcado");
      } else {
        toast.success("Sem mudanças: o dado ao vivo confere com o snapshot");
      }
      queryClient.invalidateQueries({ queryKey: ["itens-salvos", "minhas"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao verificar"),
    onSettled: () => setVerificandoId(null),
  });

  return (
    <CadernoItensSalvosView
      itens={(data ?? []) as ItemSalvo[]}
      isLoading={isLoading}
      errorMsg={error instanceof Error ? error.message : null}
      removingId={removingId}
      onRemover={(id) => {
        if (confirm("Remover este item do seu caderno?")) remover.mutate(id);
      }}
      verificandoId={verificandoId}
      onVerificar={(id) => verificar.mutate({ id })}
      onAtualizarSnapshot={(id) => {
        if (
          confirm("Substituir o snapshot pelo dado ao vivo? O valor de prova antigo será perdido.")
        )
          verificar.mutate({ id, substituir: true });
      }}
    />
  );
}

CadernoItensSalvosContainer.displayName = "CadernoItensSalvosContainer";
