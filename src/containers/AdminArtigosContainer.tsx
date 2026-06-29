import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/use-is-admin";
import {
  listarArtigos,
  salvarArtigo,
  excluirArtigo,
  type Artigo,
} from "@/lib/data/artigos.functions";
import {
  FORM_INICIAL,
  aplicarTituloNoForm,
  buildSavePayload,
  contarPorCategoria,
  filtrarPorAba,
  formFromArtigo,
  isValidSlug,
  slugify,
  type Aba,
  type FormState,
} from "@/lib/admin-artigos/logic";
import { AdminArtigosView } from "@/components/AdminArtigosView";

export function AdminArtigosContainer() {
  const { loading, isAdmin } = useIsAdmin();
  const qc = useQueryClient();
  const fetchAll = useServerFn(listarArtigos);
  const save = useServerFn(salvarArtigo);
  const remove = useServerFn(excluirArtigo);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-artigos"],
    queryFn: () => fetchAll(),
    enabled: isAdmin,
  });

  const [editing, setEditing] = React.useState<Artigo | null>(null);
  const [form, setForm] = React.useState<FormState>(FORM_INICIAL);
  const [aba, setAba] = React.useState<Aba>("tudo");
  const [busy, setBusy] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [galeriaAberta, setGaleriaAberta] = React.useState(false);

  const reset = React.useCallback(() => {
    setEditing(null);
    setForm(FORM_INICIAL);
    setPreviewOpen(false);
  }, []);

  const startEdit = React.useCallback((a: Artigo) => {
    setEditing(a);
    setForm(formFromArtigo(a));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const onTituloChange = React.useCallback(
    (v: string) => setForm((f) => aplicarTituloNoForm(f, v, !!editing)),
    [editing],
  );

  const submit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!form.titulo.trim()) {
        toast.error("Informe um título.");
        return;
      }
      const slug = (form.slug || slugify(form.titulo)).trim();
      if (!isValidSlug(slug)) {
        toast.error("Slug inválido — use letras minúsculas, números e hífens.");
        return;
      }
      setBusy(true);
      try {
        await save({ data: buildSavePayload(form, editing?.id) });
        toast.success(editing ? "Artigo atualizado." : "Artigo criado.");
        reset();
        await qc.invalidateQueries({ queryKey: ["admin-artigos"] });
        await qc.invalidateQueries({ queryKey: ["mapas-publicos"] });
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [editing, form, qc, reset, save],
  );

  const del = React.useCallback(
    async (a: Artigo) => {
      if (!confirm(`Excluir "${a.titulo}"?`)) return;
      setBusy(true);
      try {
        await remove({ data: { id: a.id } });
        toast.success("Artigo excluído.");
        if (editing?.id === a.id) reset();
        await qc.invalidateQueries({ queryKey: ["admin-artigos"] });
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [editing, qc, remove, reset],
  );

  if (loading) return <div className="p-10 text-muted-foreground">Verificando permissões…</div>;

  const filtrados = filtrarPorAba(items, aba);
  const counts = contarPorCategoria(items);

  return (
    <AdminArtigosView
      isLoading={isLoading}
      busy={busy}
      items={items}
      filtrados={filtrados}
      counts={counts}
      aba={aba}
      onAbaChange={setAba}
      form={form}
      setForm={setForm}
      editing={editing}
      previewOpen={previewOpen}
      setPreviewOpen={setPreviewOpen}
      galeriaAberta={galeriaAberta}
      setGaleriaAberta={setGaleriaAberta}
      onTituloChange={onTituloChange}
      onSubmit={submit}
      onReset={reset}
      onStartEdit={startEdit}
      onDelete={del}
    />
  );
}

AdminArtigosContainer.displayName = "AdminArtigosContainer";