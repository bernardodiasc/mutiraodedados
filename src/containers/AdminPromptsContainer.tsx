import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { downloadCSV } from "@/lib/csv";
import { mesclarOrdemFiltrada } from "@/lib/lista-ordenavel/logic";
import {
  CSV_COLUNAS_PROMPT,
  FORM_VAZIO,
  contarPrompts,
  filtrarPrompts,
  formFromPrompt,
  payloadDoForm,
  promptParaTextoCopiavel,
  promptsParaCsv,
  type AbaPrompt,
  type FormPrompt,
} from "@/lib/admin-prompts/logic";
import {
  listarTodosPrompts,
  criarPrompt,
  atualizarPrompt,
  excluirPrompt,
  vincularPrompt,
  desvincularPrompt,
  reordenarPrompts,
  reordenarPromptsDoMapa,
  listarVinculosAdmin,
  type PromptModelo,
} from "@/lib/prompt-modelos.functions";
import { listarArtigos, type Artigo } from "@/lib/data/artigos.functions";
import { AdminPromptsView } from "@/components/AdminPromptsView";

export function AdminPromptsContainer() {
  const listar = useServerFn(listarTodosPrompts);
  const criar = useServerFn(criarPrompt);
  const atualizar = useServerFn(atualizarPrompt);
  const excluir = useServerFn(excluirPrompt);
  const vincular = useServerFn(vincularPrompt);
  const desvincular = useServerFn(desvincularPrompt);
  const reordenarGlobal = useServerFn(reordenarPrompts);
  const reordenarMapa = useServerFn(reordenarPromptsDoMapa);
  const listarVinculos = useServerFn(listarVinculosAdmin);
  const listarTodosArtigos = useServerFn(listarArtigos);
  const qc = useQueryClient();

  const { data: prompts, isLoading } = useQuery({
    queryKey: ["admin", "prompts"],
    queryFn: () => listar(),
  });
  const { data: vinculos } = useQuery({
    queryKey: ["admin", "mapa-prompts"],
    queryFn: () => listarVinculos(),
  });
  const { data: artigos } = useQuery({
    queryKey: ["admin", "artigos"],
    queryFn: () => listarTodosArtigos(),
  });

  const mapas = React.useMemo(
    () => (artigos ?? []).filter((a: Artigo) => a.categoria === "mapa"),
    [artigos],
  );
  const mapaPorId = React.useMemo(() => new Map(mapas.map((m) => [m.id, m])), [mapas]);
  const promptPorId = React.useMemo(
    () => new Map((prompts ?? []).map((p) => [p.id, p])),
    [prompts],
  );
  const vinculosPorPrompt = React.useMemo(() => {
    const m = new Map<string, string[]>();
    for (const v of vinculos ?? []) {
      m.set(v.prompt_modelo_id, [...(m.get(v.prompt_modelo_id) ?? []), v.artigo_id]);
    }
    return m;
  }, [vinculos]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "prompts"] });
    qc.invalidateQueries({ queryKey: ["admin", "mapa-prompts"] });
    qc.invalidateQueries({ queryKey: ["mapa-prompts"] });
  };
  const erro = (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro");

  const [criarForm, setCriarForm] = React.useState<FormPrompt>(FORM_VAZIO);
  const [criarAberto, setCriarAberto] = React.useState(false);
  const [editandoId, setEditandoId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<FormPrompt>(FORM_VAZIO);
  const [filtro, setFiltro] = React.useState<AbaPrompt>("tudo");

  const promptsFiltrados = React.useMemo(
    () => filtrarPrompts(prompts ?? [], filtro),
    [prompts, filtro],
  );
  const contagens = React.useMemo(() => contarPrompts(prompts ?? []), [prompts]);

  const acaoCriar = useMutation({
    mutationFn: async () => criar({ data: payloadDoForm(criarForm) }),
    onSuccess: () => {
      toast.success("Prompt criado — agora vincule a um mapa para ele aparecer no Kit");
      setCriarForm(FORM_VAZIO);
      setCriarAberto(false);
      invalidate();
    },
    onError: erro,
  });
  const acaoEditar = useMutation({
    mutationFn: async () => {
      if (!editandoId) return;
      return atualizar({ data: { id: editandoId, ...payloadDoForm(editForm) } });
    },
    onSuccess: () => {
      toast.success("Prompt atualizado");
      setEditandoId(null);
      setEditForm(FORM_VAZIO);
      invalidate();
    },
    onError: erro,
  });
  const acaoToggle = useMutation({
    mutationFn: async (p: PromptModelo) => atualizar({ data: { id: p.id, ativo: !p.ativo } }),
    onSuccess: invalidate,
    onError: erro,
  });
  const acaoExcluir = useMutation({
    mutationFn: async (id: string) => excluir({ data: { id } }),
    onSuccess: () => {
      toast.success("Prompt excluído");
      invalidate();
    },
    onError: erro,
  });
  const acaoVincular = useMutation({
    mutationFn: async (args: { artigo_id: string; prompt_modelo_id: string; ordem: number }) =>
      vincular({ data: args }),
    onSuccess: () => {
      toast.success("Prompt vinculado ao mapa");
      invalidate();
    },
    onError: erro,
  });
  const acaoDesvincular = useMutation({
    mutationFn: async (args: { artigo_id: string; prompt_modelo_id: string }) =>
      desvincular({ data: args }),
    onSuccess: () => {
      toast.success("Vínculo removido");
      invalidate();
    },
    onError: erro,
  });
  const acaoReordenar = useMutation({
    mutationFn: async (visiveisNaNovaOrdem: string[]) => {
      const completos = (prompts ?? []).map((p) => p.id);
      return reordenarGlobal({
        data: { ids: mesclarOrdemFiltrada(completos, visiveisNaNovaOrdem) },
      });
    },
    onSuccess: invalidate,
    onError: erro,
  });
  const acaoReordenarMapa = useMutation({
    mutationFn: async (args: { artigo_id: string; prompt_ids: string[] }) =>
      reordenarMapa({ data: args }),
    onSuccess: () => {
      toast.success("Ordem dos prompts do mapa atualizada");
      invalidate();
    },
    onError: erro,
  });

  const onCopiar = async (p: PromptModelo) => {
    try {
      await navigator.clipboard.writeText(promptParaTextoCopiavel(p));
      toast.success("Texto do prompt copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <AdminPromptsView
      isLoading={isLoading}
      filtro={filtro}
      onFiltroChange={setFiltro}
      contagens={contagens}
      promptsFiltrados={promptsFiltrados}
      podeArrastar={editandoId === null}
      onReordenar={(ids) => acaoReordenar.mutate(ids)}
      onBaixarCsv={() =>
        downloadCSV(`prompts_${filtro}`, promptsParaCsv(promptsFiltrados), CSV_COLUNAS_PROMPT)
      }
      criarAberto={criarAberto}
      onCriarAbertoChange={setCriarAberto}
      criarForm={criarForm}
      setCriarForm={setCriarForm}
      onCriar={() => acaoCriar.mutate()}
      criarPendente={acaoCriar.isPending}
      editandoId={editandoId}
      editForm={editForm}
      setEditForm={setEditForm}
      onStartEdit={(p) => {
        setEditandoId(p.id);
        setEditForm(formFromPrompt(p));
      }}
      onCancelEdit={() => {
        setEditandoId(null);
        setEditForm(FORM_VAZIO);
      }}
      onEditSalvar={() => acaoEditar.mutate()}
      editSalvando={acaoEditar.isPending}
      onToggleAtivo={(p) => acaoToggle.mutate(p)}
      onCopiar={onCopiar}
      onExcluir={(p) => {
        if (confirm("Excluir prompt? Os vínculos com mapas também somem."))
          acaoExcluir.mutate(p.id);
      }}
      mapas={mapas}
      mapaPorId={mapaPorId}
      vinculosPorPrompt={vinculosPorPrompt}
      onVincular={(promptId, artigoId, ordem) =>
        acaoVincular.mutate({ artigo_id: artigoId, prompt_modelo_id: promptId, ordem })
      }
      onDesvincular={(promptId, artigoId) =>
        acaoDesvincular.mutate({ artigo_id: artigoId, prompt_modelo_id: promptId })
      }
      vinculos={vinculos ?? []}
      promptPorId={promptPorId}
      onReordenarMapa={(artigoId, promptIds) =>
        acaoReordenarMapa.mutate({ artigo_id: artigoId, prompt_ids: promptIds })
      }
    />
  );
}

AdminPromptsContainer.displayName = "AdminPromptsContainer";
