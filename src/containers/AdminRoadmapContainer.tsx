import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/use-is-admin";
import {
  listarRoadmap,
  salvarItemRoadmap,
  excluirItemRoadmap,
  type RoadmapItem,
} from "@/lib/data/roadmap.functions";
import { AdminRoadmapView } from "@/components/AdminRoadmapView";
import {
  type Aba,
  type FormRoadmap,
  FORM_INICIAL,
  buildSavePayload,
  formFromItem,
  ordenarItens,
  vizinhoParaTroca,
} from "@/lib/admin-roadmap/logic";

export function AdminRoadmapContainer() {
  const { isAdmin, loading } = useIsAdmin();
  const qc = useQueryClient();
  const fetchAll = useServerFn(listarRoadmap);
  const save = useServerFn(salvarItemRoadmap);
  const remove = useServerFn(excluirItemRoadmap);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-roadmap"],
    queryFn: () => fetchAll(),
    enabled: isAdmin,
  });

  const [editing, setEditing] = React.useState<RoadmapItem | null>(null);
  const [form, setForm] = React.useState<FormRoadmap>(FORM_INICIAL);
  const [busy, setBusy] = React.useState(false);
  const [aba, setAba] = React.useState<Aba>("tudo");

  const reset = () => {
    setEditing(null);
    setForm(FORM_INICIAL);
  };

  const startEdit = (it: RoadmapItem) => {
    setEditing(it);
    setForm(formFromItem(it));
  };

  const invalidar = async () => {
    await qc.invalidateQueries({ queryKey: ["admin-roadmap"] });
    await qc.invalidateQueries({ queryKey: ["admin-roadmap-summary"] });
    await qc.invalidateQueries({ queryKey: ["roadmap-publico"] });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) {
      toast.error("Informe um título.");
      return;
    }
    setBusy(true);
    try {
      await save({ data: buildSavePayload(form, editing, items.length) });
      toast.success(editing ? "Item atualizado." : "Item adicionado.");
      reset();
      await invalidar();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const move = async (it: RoadmapItem, dir: -1 | 1) => {
    const sorted = ordenarItens(items);
    const swap = vizinhoParaTroca(sorted, it.id, dir);
    if (!swap) return;
    setBusy(true);
    try {
      await save({
        data: {
          id: it.id,
          titulo: it.titulo,
          descricao: it.descricao,
          status: it.status,
          ordem: swap.ordem,
          publico: it.publico,
          notas: it.notas,
          concluido_em: it.concluido_em,
        },
      });
      await save({
        data: {
          id: swap.id,
          titulo: swap.titulo,
          descricao: swap.descricao,
          status: swap.status,
          ordem: it.ordem,
          publico: swap.publico,
          notas: swap.notas,
          concluido_em: swap.concluido_em,
        },
      });
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
      if (editing?.id === it.id) reset();
      await invalidar();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
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
      editing={editing}
      form={form}
      setForm={setForm}
      busy={busy}
      aba={aba}
      setAba={setAba}
      onSubmit={submit}
      onReset={reset}
      onStartEdit={startEdit}
      onMove={move}
      onDelete={del}
    />
  );
}