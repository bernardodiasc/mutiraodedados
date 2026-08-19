import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listarMinhasPerguntas, excluirPergunta, type Pergunta } from "@/lib/perguntas.functions";
import { CadernoPerguntasSalvasView } from "@/components/CadernoPerguntasSalvasView";

export function CadernoPerguntasSalvasContainer() {
  const listar = useServerFn(listarMinhasPerguntas);
  const excluir = useServerFn(excluirPergunta);
  const queryClient = useQueryClient();
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["perguntas", "minhas"],
    queryFn: () => listar(),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => excluir({ data: { id } }),
    onMutate: (id) => setRemovingId(id),
    onSuccess: () => {
      toast.success("Pergunta removida do caderno");
      queryClient.invalidateQueries({ queryKey: ["perguntas", "minhas"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao remover"),
    onSettled: () => setRemovingId(null),
  });

  return (
    <CadernoPerguntasSalvasView
      perguntas={(data ?? []) as Pergunta[]}
      isLoading={isLoading}
      errorMsg={error instanceof Error ? error.message : null}
      removingId={removingId}
      onRemover={(id) => {
        if (confirm("Remover esta pergunta do seu caderno?")) remover.mutate(id);
      }}
    />
  );
}

CadernoPerguntasSalvasContainer.displayName = "CadernoPerguntasSalvasContainer";
