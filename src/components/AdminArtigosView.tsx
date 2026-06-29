import * as React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Eye, EyeOff, ImageIcon, Loader2, Plus, Trash2 } from "lucide-react";
import { AdminNav } from "@/components/AdminNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ArtigoRenderer } from "@/components/ArtigoRenderer";
import { FLUXOS } from "@/components/fluxos";
import { RichTextEditor } from "@/components/RichTextEditor";
import { GaleriaImagensDialog } from "@/components/GaleriaImagensDialog";
import type {
  Artigo,
  ArtigoCategoria,
  ArtigoDificuldade,
} from "@/lib/data/artigos.functions";
import {
  CATEGORIA_LABEL,
  rotaPublicaCategoria,
  type Aba,
  type FormState,
} from "@/lib/admin-artigos/logic";

export type AdminArtigosViewProps = {
  isLoading: boolean;
  busy: boolean;
  items: Artigo[];
  filtrados: Artigo[];
  counts: { tudo: number; mapa: number; tutorial: number; nota: number };
  aba: Aba;
  onAbaChange: (a: Aba) => void;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  editing: Artigo | null;
  previewOpen: boolean;
  setPreviewOpen: React.Dispatch<React.SetStateAction<boolean>>;
  galeriaAberta: boolean;
  setGaleriaAberta: (v: boolean) => void;
  onTituloChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onReset: () => void;
  onStartEdit: (a: Artigo) => void;
  onDelete: (a: Artigo) => void;
};

export function AdminArtigosView({
  isLoading,
  busy,
  items: _items,
  filtrados,
  counts,
  aba,
  onAbaChange,
  form,
  setForm,
  editing,
  previewOpen,
  setPreviewOpen,
  galeriaAberta,
  setGaleriaAberta,
  onTituloChange,
  onSubmit,
  onReset,
  onStartEdit,
  onDelete,
}: AdminArtigosViewProps) {
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

      <form onSubmit={onSubmit} className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">{editing ? `Editar: ${editing.titulo}` : "Novo artigo"}</h2>
          {editing && (
            <Button type="button" variant="ghost" size="sm" onClick={onReset} disabled={busy}>
              Cancelar edição
            </Button>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Título</Label>
            <Input
              value={form.titulo}
              onChange={(e) => onTituloChange(e.target.value)}
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
            <Label className="text-xs">Conteúdo</Label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                data-flat
                onClick={() => setGaleriaAberta(true)}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <ImageIcon className="size-3.5" /> Galeria
              </button>
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
          </div>
          <RichTextEditor
            value={form.conteudo_md}
            onChange={(md) => setForm((f) => ({ ...f, conteudo_md: md }))}
            disabled={busy}
          />
          {previewOpen && (
            <div className="mt-3 rounded-lg border border-border bg-background p-4 max-h-[600px] overflow-auto">
              <ArtigoRenderer conteudo={form.conteudo_md || "_Sem conteúdo._"} />
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            Texto salvo como Markdown. Fluxos embutíveis via toolbar ou shortcode <code>:::fluxo{`{nome="..."}`}:::</code> — disponíveis: {Object.keys(FLUXOS).map((n) => <code key={n} className="mx-1">{n}</code>)}
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
            Publicado — aparece em <code>{rotaPublicaCategoria(form.categoria)}</code>
          </Label>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Plus className="size-4 mr-2" />}
            {editing ? "Salvar" : "Criar"}
          </Button>
        </div>
      </form>

      <GaleriaImagensDialog open={galeriaAberta} onOpenChange={setGaleriaAberta} />

      <section className="space-y-2">
        <h2 className="font-display text-lg">Itens</h2>
        <nav className="inline-flex flex-wrap rounded-lg border border-border bg-card/50 p-1 text-xs">
          {([
            ["tudo", "Tudo", counts.tudo],
            ["mapa", "Mapas", counts.mapa],
            ["tutorial", "Tutoriais", counts.tutorial],
            ["nota", "Notas", counts.nota],
          ] as const).map(([k, l, qtd]) => (
            <button
              data-flat
              key={k}
              onClick={() => onAbaChange(k)}
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
                  <Button size="sm" variant="outline" onClick={() => onStartEdit(a)} disabled={busy}>
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(a)}
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