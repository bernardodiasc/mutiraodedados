import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { downloadCSV } from "@/lib/csv";
import { mesclarOrdemFiltrada } from "@/lib/lista-ordenavel/logic";
import {
  CSV_COLUNAS_MODELO,
  MODELO_DRAFT_VAZIO,
  contarModelos,
  draftFromModelo,
  filtrarModelos,
  modeloParaTextoCopiavel,
  modelosParaCsv,
  patchModelo,
  payloadCriarModelo,
  type AbaModelo,
  type ModeloDraft,
} from "@/lib/admin-perguntas/logic";
import {
  listarTodosModelos,
  criarModelo,
  atualizarModelo,
  excluirModelo,
  reordenarModelos,
  type PerguntaModelo,
} from "@/lib/pergunta-modelos.functions";
import { AdminPerguntasModelosView } from "@/components/AdminPerguntasModelosView";

const CHAVE = ["admin", "pergunta-modelos"];

export function PerguntasModelosContainer() {
  const listar = useServerFn(listarTodosModelos);
  const criar = useServerFn(criarModelo);
  const atualizar = useServerFn(atualizarModelo);
  const excluir = useServerFn(excluirModelo);
  const reordenar = useServerFn(reordenarModelos);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: CHAVE, queryFn: () => listar() });
  const invalidar = () => qc.invalidateQueries({ queryKey: CHAVE });
  const erro = (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro");

  const [criarDraft, setCriarDraft] = React.useState<ModeloDraft>(MODELO_DRAFT_VAZIO);
  const [criarAberto, setCriarAberto] = React.useState(false);
  const [editandoId, setEditandoId] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState<ModeloDraft>(MODELO_DRAFT_VAZIO);
  const [filtro, setFiltro] = React.useState<AbaModelo>("tudo");

  const filtrados = React.useMemo(() => filtrarModelos(data ?? [], filtro), [data, filtro]);
  const contagens = React.useMemo(() => contarModelos(data ?? []), [data]);

  const acaoCriar = useMutation({
    mutationFn: async () => criar({ data: payloadCriarModelo(criarDraft) }),
    onSuccess: () => {
      toast.success("Modelo criado");
      setCriarDraft(MODELO_DRAFT_VAZIO);
      setCriarAberto(false);
      invalidar();
    },
    onError: erro,
  });
  const acaoEditar = useMutation({
    mutationFn: async () => {
      const alvo = (data ?? []).find((m) => m.id === editandoId);
      if (!alvo) return;
      return atualizar({ data: { id: alvo.id, ...patchModelo(alvo, editDraft) } });
    },
    onSuccess: () => {
      toast.success("Modelo atualizado");
      setEditandoId(null);
      setEditDraft(MODELO_DRAFT_VAZIO);
      invalidar();
    },
    onError: erro,
  });
  const acaoToggle = useMutation({
    mutationFn: async (m: PerguntaModelo) => atualizar({ data: { id: m.id, ativo: !m.ativo } }),
    onSuccess: invalidar,
    onError: erro,
  });
  const acaoExcluir = useMutation({
    mutationFn: async (id: string) => excluir({ data: { id } }),
    onSuccess: () => {
      toast.success("Modelo excluído");
      invalidar();
    },
    onError: erro,
  });
  const acaoReordenar = useMutation({
    mutationFn: async (visiveisNaNovaOrdem: string[]) => {
      const completos = (data ?? []).map((m) => m.id);
      return reordenar({ data: { ids: mesclarOrdemFiltrada(completos, visiveisNaNovaOrdem) } });
    },
    onSuccess: invalidar,
    onError: erro,
  });

  const onCopiar = async (m: PerguntaModelo) => {
    try {
      await navigator.clipboard.writeText(modeloParaTextoCopiavel(m));
      toast.success("Texto do modelo copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <AdminPerguntasModelosView
      isLoading={isLoading}
      filtro={filtro}
      onFiltroChange={setFiltro}
      contagens={contagens}
      filtrados={filtrados}
      podeArrastar={editandoId === null}
      onReordenar={(ids) => acaoReordenar.mutate(ids)}
      onBaixarCsv={() =>
        downloadCSV(`perguntas_modelos_${filtro}`, modelosParaCsv(filtrados), CSV_COLUNAS_MODELO)
      }
      criarAberto={criarAberto}
      onCriarAbertoChange={setCriarAberto}
      criarDraft={criarDraft}
      setCriarDraft={setCriarDraft}
      onCriar={() => acaoCriar.mutate()}
      criarPendente={acaoCriar.isPending}
      editandoId={editandoId}
      editDraft={editDraft}
      setEditDraft={setEditDraft}
      onStartEdit={(m) => {
        setEditandoId(m.id);
        setEditDraft(draftFromModelo(m));
      }}
      onCancelEdit={() => {
        setEditandoId(null);
        setEditDraft(MODELO_DRAFT_VAZIO);
      }}
      onEditSalvar={() => acaoEditar.mutate()}
      editSalvando={acaoEditar.isPending}
      onToggleAtivo={(m) => acaoToggle.mutate(m)}
      onCopiar={onCopiar}
      onExcluir={(m) => {
        if (confirm("Excluir modelo?")) acaoExcluir.mutate(m.id);
      }}
    />
  );
}

PerguntasModelosContainer.displayName = "PerguntasModelosContainer";
