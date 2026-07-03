import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/use-is-admin";
import {
  listarRoadmap,
  salvarItemRoadmap,
  excluirItemRoadmap,
  reordenarRoadmap,
  type RoadmapItem,
} from "@/lib/data/roadmap.functions";
import { downloadCSV } from "@/lib/csv";
import { mesclarOrdemFiltrada } from "@/lib/lista-ordenavel/logic";
import { AdminRoadmapView } from "@/components/AdminRoadmapView";
import {
  type Aba,
  type FormRoadmap,
  CSV_COLUNAS_ROADMAP,
  FORM_INICIAL,
  buildSavePayload,
  formFromItem,
  itemParaTextoCopiavel,
  itensParaCsv,
  itensVisiveis,
  ordenarItens,
} from "@/lib/admin-roadmap/logic";

export function AdminRoadmapContainer() {
  const { isAdmin, loading } = useIsAdmin();
  const qc = useQueryClient();
  const fetchAll = useServerFn(listarRoadmap);
  const save = useServerFn(salvarItemRoadmap);
  const remove = useServerFn(excluirItemRoadmap);
  const reordenar = useServerFn(reordenarRoadmap);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-roadmap"],
    queryFn: () => fetchAll(),
    enabled: isAdmin,
  });

  const [criarAberto, setCriarAberto] = React.useState(false);
  const [criarForm, setCriarForm] = React.useState<FormRoadmap>(FORM_INICIAL);
  const [editandoId, setEditandoId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<FormRoadmap>(FORM_INICIAL);
  const [busy, setBusy] = React.useState(false);
  const [aba, setAba] = React.useState<Aba>("tudo");

  const startEdit = (it: RoadmapItem) => {
    setEditandoId(it.id);
    setEditForm(formFromItem(it));
  };

  const cancelEdit = () => {
    setEditandoId(null);
    setEditForm(FORM_INICIAL);
  };

  const invalidar = async () => {
    await qc.invalidateQueries({ queryKey: ["admin-roadmap"] });
    await qc.invalidateQueries({ queryKey: ["admin-roadmap-summary"] });
    await qc.invalidateQueries({ queryKey: ["roadmap-publico"] });
  };

  const salvar = async (form: FormRoadmap, editing: RoadmapItem | null): Promise<boolean> => {
    if (!form.titulo.trim()) {
      toast.error("Informe um título.");
      return false;
    }
    setBusy(true);
    try {
      await save({ data: buildSavePayload(form, editing, items.length) });
      toast.success(editing ? "Item atualizado." : "Item adicionado.");
      await invalidar();
      return true;
    } catch (err) {
      toast.error((err as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onCriarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await salvar(criarForm, null)) {
      setCriarForm(FORM_INICIAL);
      setCriarAberto(false);
    }
  };

  const onEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const editing = items.find((x) => x.id === editandoId) ?? null;
    if (!editing) return;
    if (await salvar(editForm, editing)) cancelEdit();
  };

  const onReordenar = async (visiveisNaNovaOrdem: string[]) => {
    const completos = ordenarItens(items).map((it) => it.id);
    const ids = mesclarOrdemFiltrada(completos, visiveisNaNovaOrdem);
    setBusy(true);
    try {
      await reordenar({ data: { ids } });
      await invalidar();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onTogglePublicar = async (it: RoadmapItem) => {
    setBusy(true);
    try {
      await save({
        data: {
          id: it.id,
          titulo: it.titulo,
          descricao: it.descricao,
          status: it.status,
          ordem: it.ordem,
          publico: !it.publico,
          notas: it.notas,
          concluido_em: it.concluido_em,
        },
      });
      toast.success(it.publico ? "Item despublicado." : "Item publicado.");
      await invalidar();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const del = async (it: RoadmapItem) => {
    if (!confirm(`Excluir "${it.titulo}"?`)) return;
    setBusy(true);
    try {
      await remove({ data: { id: it.id } });
      toast.success("Item excluído.");
      if (editandoId === it.id) cancelEdit();
      await invalidar();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onDownloadLista = () => {
    const visiveis = itensVisiveis(ordenarItens(items), aba);
    downloadCSV(`roadmap_${aba}`, itensParaCsv(visiveis), CSV_COLUNAS_ROADMAP);
  };

  const onCopiarItem = async (it: RoadmapItem) => {
    try {
      await navigator.clipboard.writeText(itemParaTextoCopiavel(it));
      toast.success("Texto do item copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  if (loading) {
    return <div className="p-10 text-muted-foreground">Verificando permissões…</div>;
  }

  const sorted = ordenarItens(items);

  return (
    <AdminRoadmapView
      isLoading={isLoading}
      sorted={sorted}
      busy={busy}
      aba={aba}
      setAba={setAba}
      criarAberto={criarAberto}
      setCriarAberto={setCriarAberto}
      criarForm={criarForm}
      setCriarForm={setCriarForm}
      onCriarSubmit={onCriarSubmit}
      editandoId={editandoId}
      editForm={editForm}
      setEditForm={setEditForm}
      onEditSubmit={onEditSubmit}
      onStartEdit={startEdit}
      onCancelEdit={cancelEdit}
      onReordenar={onReordenar}
      onTogglePublicar={onTogglePublicar}
      onDelete={del}
      onDownloadLista={onDownloadLista}
      onCopiarItem={onCopiarItem}
    />
  );
}

AdminRoadmapContainer.displayName = "AdminRoadmapContainer";
