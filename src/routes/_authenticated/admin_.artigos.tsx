import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff, Loader2, Plus, Trash2 } from "lucide-react";
import { ensureAdminBeforeLoad } from "@/lib/admin-guard";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { AdminNav } from "@/components/AdminNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ArtigoRenderer } from "@/components/ArtigoRenderer";
import { FLUXOS } from "@/components/fluxos";
import {
  listarArtigos,
  salvarArtigo,
  excluirArtigo,
  type Artigo,
  type ArtigoCategoria,
  type ArtigoDificuldade,
} from "@/lib/data/artigos.functions";

export const Route = createFileRoute("/_authenticated/admin_/artigos")({
  beforeLoad: ensureAdminBeforeLoad,
  component: ArtigosAdminPage,
  head: () => ({ meta: [{ title: "Artigos — Admin" }] }),
});

type Aba = "tudo" | "mapa" | "tutorial" | "nota";
const CATEGORIA_LABEL: Record<ArtigoCategoria, string> = {
  mapa: "Mapa investigativo",
  tutorial: "Tutorial",
  nota: "Nota",
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 160);
}

type FormState = {
  slug: string;
  titulo: string;
  resumo: string;
  conteudo_md: string;
  categoria: ArtigoCategoria;
  dificuldade: ArtigoDificuldade | "";
  tempo_estimado_min: string;
  fontes_usadas: string;
  notas_internas: string;
  publico: boolean;
};

const FORM_INICIAL: FormState = {
  slug: "",
  titulo: "",
  resumo: "",
  conteudo_md: "",
  categoria: "mapa",
  dificuldade: "",
  tempo_estimado_min: "",
  fontes_usadas: "",
  notas_internas: "",
  publico: false,
};

function ArtigosAdminPage() {
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

  const reset = () => {
    setEditing(null);
    setForm(FORM_INICIAL);
    setPreviewOpen(false);
  };

  const startEdit = (a: Artigo) => {
    setEditing(a);
    setForm({
      slug: a.slug,
      titulo: a.titulo,
      resumo: a.resumo ?? "",
      conteudo_md: a.conteudo_md ?? "",
      categoria: a.categoria,
      dificuldade: a.dificuldade ?? "",
      tempo_estimado_min: a.tempo_estimado_min != null ? String(a.tempo_estimado_min) : "",
      fontes_usadas: (a.fontes_usadas ?? []).join(", "),
      notas_internas: a.notas_internas ?? "",
      publico: a.publico,
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) return toast.error("Informe um título.");
    const slug = (form.slug || slugify(form.titulo)).trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return toast.error("Slug inválido — use letras minúsculas, números e hífens.");
    }
    setBusy(true);
    try {
      await save({
        data: {
          ...(editing ? { id: editing.id } : {}),
          slug,
          titulo: form.titulo.trim(),
          resumo: form.resumo.trim() || null,
          conteudo_md: form.conteudo_md,
          categoria: form.categoria,
          dificuldade:
            form.categoria === "nota"
              ? null
              : ((form.dificuldade || null) as ArtigoDificuldade | null),
          tempo_estimado_min:
            form.categoria === "nota"
              ? null
              : form.tempo_estimado_min
                ? Number(form.tempo_estimado_min)
                : null,
          fontes_usadas: form.fontes_usadas
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          notas_internas: form.notas_internas.trim() || null,
          publico: form.publico,
        },
      });
      toast.success(editing ? "Artigo atualizado." : "Artigo criado.");
      reset();
      await qc.invalidateQueries({ queryKey: ["admin-artigos"] });
      await qc.invalidateQueries({ queryKey: ["mapas-publicos"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const del = async (a: Artigo) => {
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
  };

  if (loading) return <div className="p-10 text-muted-foreground">Verificando permissões…</div>;

  const filtrados = aba === "tudo" ? items : items.filter((a) => a.categoria === aba);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="size-3.5" /> voltar ao painel
      </Link>
      <header>
        <h1 className="font-display text-4xl">Artigos</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Conteúdo editorial: mapas investigativos, tutoriais e notas. Cada categoria é
          publicada em sua própria seção (<code className="mx-1">/mapas</code>,
          <code className="mx-1">/tutoriais</code>, <code className="mx-1">/notas</code>).
        </p>
      </header>
      <AdminNav />

      <form onSubmit={submit} className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">{editing ? `Editar: ${editing.titulo}` : "Novo artigo"}</h2>
          {editing && (
            <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={busy}>
              Cancelar edição
            </Button>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Título</Label>
            <Input
              value={form.titulo}
              onChange={(e) => {
                const v = e.target.value;
                setForm((f) => ({
                  ...f,
                  titulo: v,
                  slug: !editing && !f.slug ? slugify(v) : f.slug,
                }));
              }}
              maxLength={300}
              disabled={busy}
              placeholder="Ex.: Como rastrear um contrato suspeito do PNCP"
            />
          </div>
          <div>
            <Label className="text-xs">Slug (URL)</Label>
            <Input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              maxLength={160}
              disabled={busy}
              placeholder="ex-rastrear-contrato-pncp"
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Resumo (até 600 caracteres)</Label>
          <Textarea
            value={form.resumo}
            onChange={(e) => setForm({ ...form, resumo: e.target.value })}
            maxLength={600}
            disabled={busy}
            rows={2}
          />
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Categoria</Label>
            <select
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value as ArtigoCategoria })}
              disabled={busy}
            >
              <option value="mapa">Mapa investigativo</option>
              <option value="tutorial">Tutorial</option>
              <option value="nota">Nota</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Dificuldade</Label>
            <select
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              value={form.dificuldade}
              onChange={(e) => setForm({ ...form, dificuldade: e.target.value as ArtigoDificuldade | "" })}
              disabled={busy}
            >
              <option value="">—</option>
              <option value="iniciante">Iniciante</option>
              <option value="intermediario">Intermediário</option>
              <option value="avancado">Avançado</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Tempo estimado (min)</Label>
            <Input
              type="number"
              min={0}
              max={1000}
              value={form.tempo_estimado_min}
              onChange={(e) => setForm({ ...form, tempo_estimado_min: e.target.value })}
              disabled={busy}
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Fontes usadas (separe por vírgula)</Label>
          <Input
            value={form.fontes_usadas}
            onChange={(e) => setForm({ ...form, fontes_usadas: e.target.value })}
            disabled={busy}
            placeholder="PNCP, Portal da Transparência, SICONFI"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Conteúdo (Markdown)</Label>
            <button
              type="button"
              data-flat
              onClick={() => setPreviewOpen((p) => !p)}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              {previewOpen ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              {previewOpen ? "Ocultar pré-visualização" : "Pré-visualizar"}
            </button>
          </div>
          <Textarea
            value={form.conteudo_md}
            onChange={(e) => setForm({ ...form, conteudo_md: e.target.value })}
            maxLength={100_000}
            disabled={busy}
            rows={16}
            className="font-mono text-xs"
            placeholder={`## Introdução\n\nTexto em **markdown**. Use o shortcode para embutir um fluxo:\n\n:::fluxo{nome="contrato-pncp"}:::\n\nFluxos disponíveis: ${Object.keys(FLUXOS).join(", ")}`}
          />
          {previewOpen && (
            <div className="mt-3 rounded-lg border border-border bg-background p-4 max-h-[600px] overflow-auto">
              <ArtigoRenderer conteudo={form.conteudo_md || "_Sem conteúdo._"} />
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            Fluxos embutíveis: {Object.keys(FLUXOS).map((n) => <code key={n} className="mx-1">{n}</code>)}
          </p>
        </div>

        <div>
          <Label className="text-xs">Notas internas (opcional)</Label>
          <Textarea
            value={form.notas_internas}
            onChange={(e) => setForm({ ...form, notas_internas: e.target.value })}
            maxLength={8000}
            disabled={busy}
            rows={3}
            placeholder="Notas técnicas internas. NÃO aparecem na página pública."
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Switch
            checked={form.publico}
            onCheckedChange={(v) => setForm({ ...form, publico: v })}
            disabled={busy}
            id="artigo-publico"
          />
          <Label htmlFor="artigo-publico" className="text-xs cursor-pointer">
            Publicado — aparece em{" "}
            <code>
              {form.categoria === "mapa"
                ? "/mapas"
                : form.categoria === "tutorial"
                  ? "/tutoriais"
                  : "/notas"}
            </code>
          </Label>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Plus className="size-4 mr-2" />}
            {editing ? "Salvar" : "Criar"}
          </Button>
        </div>
      </form>

      <section className="space-y-2">
        <h2 className="font-display text-lg">Itens</h2>
        <nav className="inline-flex flex-wrap rounded-lg border border-border bg-card/50 p-1 text-xs">
          {([
            ["tudo", "Tudo", items.length],
            ["mapa", "Mapas", items.filter((i) => i.categoria === "mapa").length],
            ["tutorial", "Tutoriais", items.filter((i) => i.categoria === "tutorial").length],
            ["nota", "Notas", items.filter((i) => i.categoria === "nota").length],
          ] as const).map(([k, l, qtd]) => (
            <button
              data-flat
              key={k}
              onClick={() => setAba(k)}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                aba === k ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {l}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                aba === k ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"
              }`}>{qtd}</span>
            </button>
          ))}
        </nav>

        {isLoading ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Carregando…
          </div>
        ) : filtrados.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum artigo nesta categoria.</p>
        ) : (
          <ul className="space-y-2">
            {filtrados.map((a) => (
              <li key={a.id} className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{a.titulo}</span>
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {CATEGORIA_LABEL[a.categoria]}
                    </span>
                    {a.publico ? (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                        público
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        rascunho
                      </span>
                    )}
                    <code className="text-[10px] text-muted-foreground">/{a.slug}</code>
                  </div>
                  {a.resumo && <p className="text-xs text-muted-foreground mt-1">{a.resumo}</p>}
                  {a.notas_internas && (
                    <p className="text-xs text-muted-foreground/80 mt-1 whitespace-pre-line">📝 {a.notas_internas}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(a)} disabled={busy}>
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => del(a)}
                    disabled={busy}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}