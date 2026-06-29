import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { criarPergunta } from "@/lib/perguntas.functions";
import {
  deriveBotaoEstado,
  normalizarPayloadPergunta,
} from "@/lib/botao-salvar-pergunta/logic";
import { BotaoSalvarPerguntaView } from "@/components/BotaoSalvarPerguntaView";

export type BotaoSalvarPerguntaContainerProps = {
  texto: string;
  contexto?: string;
  origemUrl?: string;
  className?: string;
};

export function BotaoSalvarPerguntaContainer({
  texto,
  contexto,
  origemUrl,
  className,
}: BotaoSalvarPerguntaContainerProps) {
  const { user } = useAuth();
  const criar = useServerFn(criarPergunta);
  const queryClient = useQueryClient();
  const [justSaved, setJustSaved] = React.useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = normalizarPayloadPergunta({ texto, contexto });
      return criar({ data: payload });
    },
    onSuccess: () => {
      setJustSaved(true);
      toast.success("Pergunta salva no seu caderno");
      queryClient.invalidateQueries({ queryKey: ["perguntas", "minhas"] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Não consegui salvar a pergunta");
    },
  });

  const estado = deriveBotaoEstado({
    hasUser: !!user,
    justSaved,
    isPending: mutation.isPending,
  });

  return (
    <BotaoSalvarPerguntaView
      estado={estado}
      onSave={() => mutation.mutate()}
      className={className}
    />
  );
}

BotaoSalvarPerguntaContainer.displayName = "BotaoSalvarPerguntaContainer";