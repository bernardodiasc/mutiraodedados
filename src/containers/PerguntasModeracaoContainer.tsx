import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listarPerguntasEmRevisao,
  aprovarPergunta,
  rejeitarPergunta,
} from "@/lib/perguntas.functions";
import { AdminPerguntasModeracaoView } from "@/components/AdminPerguntasModeracaoView";

const CHAVE = ["admin", "perguntas", "revisao"];

export function PerguntasModeracaoContainer() {
  const listar = useServerFn(listarPerguntasEmRevisao);
  const aprovar = useServerFn(aprovarPergunta);
  const rejeitar = useServerFn(rejeitarPergunta);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: CHAVE, queryFn: () => listar() });
  const invalidar = () => qc.invalidateQueries({ queryKey: CHAVE });
  const erro = (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro");

  const acaoAprovar = useMutation({
    mutationFn: async (id: string) => aprovar({ data: { id } }),
    onSuccess: () => {
      toast.success("Pergunta aprovada e publicada");
      invalidar();
    },
    onError: erro,
  });
  const acaoRejeitar = useMutation({
    mutationFn: async (m: { id: string; motivo: string }) => rejeitar({ data: m }),
    onSuccess: () => {
      toast.success("Pergunta devolvida ao autor");
      invalidar();
    },
    onError: erro,
  });

  return (
    <AdminPerguntasModeracaoView
      isLoading={isLoading}
      perguntas={data ?? []}
      onAprovar={(id) => acaoAprovar.mutate(id)}
      onRejeitar={(id, motivo) => acaoRejeitar.mutate({ id, motivo })}
    />
  );
}

PerguntasModeracaoContainer.displayName = "PerguntasModeracaoContainer";
