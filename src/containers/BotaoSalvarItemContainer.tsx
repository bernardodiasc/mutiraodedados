import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  salvarItem,
  verificarItemSalvo,
  type EntidadeTipo,
} from "@/lib/itens-salvos.functions";
import { listarMinhasPerguntas } from "@/lib/perguntas.functions";
import {
  listarPerguntasContendoItem,
  toggleItemEmPergunta,
  PERGUNTA_ITEM_TIPOS,
  type PerguntaItemTipo,
} from "@/lib/pergunta-itens.functions";
import { deriveItemEstado } from "@/lib/botao-salvar-item/logic";
import { serializarSnapshot } from "@/lib/itens-salvos/logic";
import { BotaoSalvarItemView, type PastaOpcao } from "@/components/BotaoSalvarItemView";

export type BotaoSalvarItemContainerProps = {
  entidadeTipo: EntidadeTipo;
  entidadeId: string;
  titulo: string;
  url?: string;
  contexto?: string;
  /** Dados da entidade no momento do salvar — viram snapshot de prova
   * (serialização canônica + hash; ver src/lib/itens-salvos/logic.ts). */
  snapshotDe?: unknown;
  className?: string;
};

/** Mapeia o tipo de item salvo (caderno) para o tipo aceito por pergunta_itens.
 * Quando não existe equivalente, usamos "link". Retorna null para tipos que
 * não fazem sentido dentro de uma pergunta (ex.: a própria pergunta). */
function mapToPerguntaItemTipo(t: EntidadeTipo): PerguntaItemTipo | null {
  if (t === "pergunta") return null;
  return (PERGUNTA_ITEM_TIPOS as readonly string[]).includes(t)
    ? (t as PerguntaItemTipo)
    : "link";
}

export function BotaoSalvarItemContainer({
  entidadeTipo,
  entidadeId,
  titulo,
  url,
  contexto,
  snapshotDe,
  className,
}: BotaoSalvarItemContainerProps) {
  const { user, loading: authLoading } = useAuth();
  const salvar = useServerFn(salvarItem);
  const verificar = useServerFn(verificarItemSalvo);
  const listarPerguntas = useServerFn(listarMinhasPerguntas);
  const listarContendo = useServerFn(listarPerguntasContendoItem);
  const togglePasta = useServerFn(toggleItemEmPergunta);
  const queryClient = useQueryClient();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const queryKey = ["itens-salvos", "verificar", entidadeTipo, entidadeId];

  const { data: estadoSrv, isLoading: verificacaoLoading } = useQuery({
    queryKey,
    queryFn: () => verificar({ data: { entidade_tipo: entidadeTipo, entidade_id: entidadeId } }),
    enabled: Boolean(user),
  });

  const mutation = useMutation({
    mutationFn: async () =>
      salvar({
        data: {
          entidade_tipo: entidadeTipo,
          entidade_id: entidadeId,
          titulo,
          url: url ?? null,
          contexto: contexto ?? null,
          conteudo_snapshot:
            snapshotDe !== undefined ? serializarSnapshot(snapshotDe).slice(0, 20000) : null,
        },
      }),
    onSuccess: () => {
      toast.success("Salvo no seu caderno");
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["itens-salvos", "minhas"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    },
  });

  const perguntaTipo = mapToPerguntaItemTipo(entidadeTipo);
  const podeUsarPastas = Boolean(user) && perguntaTipo !== null;

  const perguntasQ = useQuery({
    queryKey: ["perguntas", "minhas"],
    queryFn: () => listarPerguntas(),
    enabled: podeUsarPastas,
  });

  const contendoKey = ["pergunta-itens", "contendo", perguntaTipo, entidadeId];
  const contendoQ = useQuery({
    queryKey: contendoKey,
    queryFn: () =>
      listarContendo({ data: { tipo: perguntaTipo!, ref_id: entidadeId } }),
    enabled: podeUsarPastas,
  });

  const toggleMut = useMutation({
    mutationFn: async (pergunta_id: string) => {
      setTogglingId(pergunta_id);
      return togglePasta({
        data: {
          pergunta_id,
          tipo: perguntaTipo!,
          ref_id: entidadeId,
          titulo,
          url: url ?? null,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(res.added ? "Adicionado à pasta" : "Removido da pasta");
      queryClient.invalidateQueries({ queryKey: contendoKey });
      queryClient.invalidateQueries({ queryKey: ["pergunta-itens"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar pasta");
    },
    onSettled: () => setTogglingId(null),
  });

  const presentesSet = new Set((contendoQ.data ?? []).map((r) => r.pergunta_id));
  const pastas: PastaOpcao[] | undefined = podeUsarPastas
    ? (perguntasQ.data ?? []).map((p) => ({
        id: p.id,
        titulo: p.titulo,
        status: p.status,
        presente: presentesSet.has(p.id),
      }))
    : undefined;

  const estado = deriveItemEstado({
    hasUser: !!user,
    authLoading,
    verificacaoLoading: !!user && verificacaoLoading,
    jaSalvo: estadoSrv?.salvo,
    isPending: mutation.isPending,
  });

  return (
    <BotaoSalvarItemView
      estado={estado}
      titulo={titulo}
      onSave={() => mutation.mutate()}
      className={className}
      pastas={pastas}
      pastasLoading={podeUsarPastas && (perguntasQ.isLoading || contendoQ.isLoading)}
      togglePastaId={togglingId}
      onTogglePasta={(id) => toggleMut.mutate(id)}
    />
  );
}

BotaoSalvarItemContainer.displayName = "BotaoSalvarItemContainer";