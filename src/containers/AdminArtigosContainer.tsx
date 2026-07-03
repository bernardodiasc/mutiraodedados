import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/use-is-admin";
import {
  listarArtigos,
  salvarArtigo,
  excluirArtigo,
  reordenarArtigos,
  type Artigo,
} from "@/lib/data/artigos.functions";
import {
  CSV_COLUNAS,
  FORM_INICIAL,
  aplicarTituloNoForm,
  artigoParaTextoCopiavel,
  artigosParaCsv,
  buildSavePayload,
  contarPorCategoria,
  filtrarPorAba,
  formFromArtigo,
  isValidSlug,
  slugify,
  type Aba,
  type FormState,
} from "@/lib/admin-artigos/logic";
import { downloadCSV } from "@/lib/csv";
import { mesclarOrdemFiltrada } from "@/lib/lista-ordenavel/logic";
import { AdminArtigosView } from "@/components/AdminArtigosView";

export function AdminArtigosContainer() {
  const { loading, isAdmin } = useIsAdmin();
  const qc = useQueryClient();
  const fetchAll = useServerFn(listarArtigos);
  const save = useServerFn(salvarArtigo);
  const remove = useServerFn(excluirArtigo);
  const reordenar = useServerFn(reordenarArtigos);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-artigos"],
    queryFn: () => fetchAll(),
    enabled: isAdmin,
  });

  const [criarAberto, setCriarAberto] = React.useState(false);
  const [criarForm, setCriarForm] = React.useState<FormState>(FORM_INICIAL);
  const [editandoId, setEditandoId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<FormState>(FORM_INICIAL);
  const [aba, setAba] = React.useState<Aba>("tudo");
  const [busy, setBusy] = React.useState(false);

  const onCriarTituloChange = React.useCallback(
    (v: string) => setCriarForm((f) => aplicarTituloNoForm(f, v, false)),
    [],
  );
  const onEditTituloChange = React.useCallback(
    (v: string) => setEditForm((f) => aplicarTituloNoForm(f, v, true)),
    [],
  );

  const startEdit = React.useCallback((a: Artigo) => {
    setEditandoId(a.id);
    setEditForm(formFromArtigo(a));
  }, []);

  const cancelEdit = React.useCallback(() => {
    setEditandoId(null);
    setEditForm(FORM_INICIAL);
  }, []);

  const invalidar = React.useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["admin-artigos"] });
    await qc.invalidateQueries({ queryKey: ["mapas-publicos"] });
  }, [qc]);

  const salvar = React.useCallback(
    async (form: FormState, id?: string): Promise<boolean> => {
      if (!form.titulo.trim()) {
        toast.error("Informe um título.");
        return false;
      }
      const slug = (form.slug || slugify(form.titulo)).trim();
      if (!isValidSlug(slug)) {
        toast.error("Slug inválido — use letras minúsculas, números e hífens.");
        return false;
      }
      setBusy(true);
      try {
        await save({ data: buildSavePayload(form, id) });
        toast.success(id ? "Artigo atualizado." : "Artigo criado.");
        await invalidar();
        return true;
      } catch (err) {
        toast.error((err as Error).message);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [invalidar, save],
  );

  const onCriarSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (await salvar(criarForm)) {
        setCriarForm(FORM_INICIAL);
        setCriarAberto(false);
      }
    },
    [criarForm, salvar],
  );

  const onEditSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editandoId) return;
      if (await salvar(editForm, editandoId)) cancelEdit();
    },
    [editForm, editandoId, cancelEdit, salvar],
  );

  const onDownloadLista = React.useCallback(() => {
    downloadCSV(`artigos_${aba}`, artigosParaCsv(filtrarPorAba(items, aba)), CSV_COLUNAS);
  }, [aba, items]);

  const onReordenar = React.useCallback(
    async (visiveisNaNovaOrdem: string[]) => {
      const completos = items.map((a) => a.id);
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
    },
    [items, invalidar, reordenar],
  );

  const onTogglePublicar = React.useCallback(
    async (a: Artigo) => {
      setBusy(true);
      try {
        await save({ data: buildSavePayload({ ...formFromArtigo(a), publico: !a.publico }, a.id) });
        toast.success(a.publico ? "Artigo despublicado." : "Artigo publicado.");
        await invalidar();
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [invalidar, save],
  );

  const onCopiarArtigo = React.useCallback(async (a: Artigo) => {
    try {
      await navigator.clipboard.writeText(artigoParaTextoCopiavel(a));
      toast.success("Texto do artigo copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }, []);

  const del = React.useCallback(
    async (a: Artigo) => {
      if (!confirm(`Excluir "${a.titulo}"?`)) return;
      setBusy(true);
      try {
        await remove({ data: { id: a.id } });
        toast.success("Artigo excluído.");
        if (editandoId === a.id) cancelEdit();
        await qc.invalidateQueries({ queryKey: ["admin-artigos"] });
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [editandoId, qc, remove, cancelEdit],
  );

  if (loading) return <div className="p-10 text-muted-foreground">Verificando permissões…</div>;

  const filtrados = filtrarPorAba(items, aba);
  const counts = contarPorCategoria(items);

  return (
    <AdminArtigosView
      isLoading={isLoading}
      busy={busy}
      filtrados={filtrados}
      counts={counts}
      aba={aba}
      onAbaChange={setAba}
      criarAberto={criarAberto}
      setCriarAberto={setCriarAberto}
      criarForm={criarForm}
      setCriarForm={setCriarForm}
      onCriarTituloChange={onCriarTituloChange}
      onCriarSubmit={onCriarSubmit}
      editandoId={editandoId}
      editForm={editForm}
      setEditForm={setEditForm}
      onEditTituloChange={onEditTituloChange}
      onEditSubmit={onEditSubmit}
      onStartEdit={startEdit}
      onCancelEdit={cancelEdit}
      onReordenar={onReordenar}
      onTogglePublicar={onTogglePublicar}
      onDelete={del}
      onDownloadLista={onDownloadLista}
      onCopiarArtigo={onCopiarArtigo}
    />
  );
}

AdminArtigosContainer.displayName = "AdminArtigosContainer";
