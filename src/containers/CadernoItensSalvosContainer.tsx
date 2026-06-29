import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listarMeusItens,
  excluirItem,
  type ItemSalvo,
} from "@/lib/itens-salvos.functions";
import { CadernoItensSalvosView } from "@/components/CadernoItensSalvosView";

export function CadernoItensSalvosContainer() {
  const listar = useServerFn(listarMeusItens);
  const excluir = useServerFn(excluirItem);
  const queryClient = useQueryClient();
  const [removingId, setRemovingId] = React.useState<string | null>(null);

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
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao remover"),
    onSettled: () => setRemovingId(null),
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
    />
  );
}

CadernoItensSalvosContainer.displayName = "CadernoItensSalvosContainer";