import * as React from "react";
import { Check, Copy, Download, Eye, EyeOff, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { AdminHeader } from "@/components/AdminHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { FormColapsavel } from "@/components/FormColapsavel";
import { IconeAcao } from "@/components/IconeAcao";
import { ListaOrdenavel } from "@/components/ListaOrdenavel";
import { FLUXOS } from "@/components/fluxos";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import type { Artigo, ArtigoCategoria, ArtigoDificuldade } from "@/lib/data/artigos.functions";
import {
  CATEGORIA_LABEL,
  rotaPublicaCategoria,
  type Aba,
  type FormState,
} from "@/lib/admin-artigos/logic";

export type AdminArtigosViewProps = {
  isLoading: boolean;
  busy: boolean;
  filtrados: Artigo[];
  counts: { tudo: number; mapa: number; tutorial: number; nota: number };
  aba: Aba;
  onAbaChange: (a: Aba) => void;
  // Criação
  criarAberto: boolean;
  setCriarAberto: (v: boolean) => void;
  criarForm: FormState;
  setCriarForm: React.Dispatch<React.SetStateAction<FormState>>;
  onCriarTituloChange: (v: string) => void;
  onCriarSubmit: (e: React.FormEvent) => void;
  // Edição inline
  editandoId: string | null;
  editForm: FormState;
  setEditForm: React.Dispatch<React.SetStateAction<FormState>>;
  onEditTituloChange: (v: string) => void;
  onEditSubmit: (e: React.FormEvent) => void;
  onStartEdit: (a: Artigo) => void;
  onCancelEdit: () => void;
  onReordenar: (visiveisNaNovaOrdem: string[]) => void;
  // Ações de item
  onTogglePublicar: (a: Artigo) => void;
  onDelete: (a: Artigo) => void;
  onDownloadLista: () => void;
  onCopiarArtigo: (a: Artigo) => void;
};

export function AdminArtigosView({
  isLoading,
  busy,
  filtrados,
  counts,
  aba,
  onAbaChange,
  criarAberto,
  setCriarAberto,
  criarForm,
  setCriarForm,
  onCriarTituloChange,
  onCriarSubmit,
  editandoId,
  editForm,
  setEditForm,
  onEditTituloChange,
  onEditSubmit,
  onStartEdit,
  onCancelEdit,
  onReordenar,
  onTogglePublicar,
  onDelete,
  onDownloadLista,
  onCopiarArtigo,
}: AdminArtigosViewProps) {
  const podeArrastar = editandoId === null;
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-8">
      <AdminHeader titulo="Artigos">
        Conteúdo editorial: mapas investigativos, tutoriais e notas. Cada categoria é publicada em
        sua própria seção (<code className="mx-1">/mapas</code>,
        <code className="mx-1">/tutoriais</code>, <code className="mx-1">/notas</code>).
      </AdminHeader>

      <FormColapsavel titulo="Novo artigo" aberto={criarAberto} onAbertoChange={setCriarAberto}>
        <form onSubmit={onCriarSubmit} className="space-y-3">
          <CamposArtigo
            form={criarForm}
            setForm={setCriarForm}
            busy={busy}
            onTituloChange={onCriarTituloChange}
            idPrefixo="novo"
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Plus className="size-4 mr-2" />
              )}
              Criar
            </Button>
          </div>
        </form>
      </FormColapsavel>

      <section className="space-y-2">
        <h2 className="font-display text-lg">Itens</h2>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <nav className="inline-flex flex-wrap rounded-lg border border-border bg-card/50 p-1 text-xs">
            {(
              [
                ["tudo", "Tudo", counts.tudo],
                ["mapa", "Mapas", counts.mapa],
                ["tutorial", "Tutoriais", counts.tutorial],
                ["nota", "Notas", counts.nota],
              ] as const
            ).map(([k, l, qtd]) => (
              <button
                data-flat
                key={k}
                onClick={() => onAbaChange(k)}
                className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                  aba === k
                    ? "bg-accent/15 text-accent"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {l}
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    aba === k ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {qtd}
                </span>
              </button>
            ))}
          </nav>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDownloadLista}
            disabled={filtrados.length === 0}
          >
            <Download className="size-3.5 mr-1.5" /> Baixar CSV
          </Button>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Carregando…
          </div>
        ) : filtrados.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum artigo nesta categoria.</p>
        ) : (
          <ListaOrdenavel
            itens={filtrados}
            getId={(a) => a.id}
            onReordenar={onReordenar}
            desabilitado={!podeArrastar}
            renderItem={(a) =>
              editandoId === a.id ? (
                <div className="rounded-xl border border-accent bg-card p-5">
                  <form onSubmit={onEditSubmit} className="space-y-3">
                    <h3 className="font-display text-base">Editar: {a.titulo}</h3>
                    <CamposArtigo
                      form={editForm}
                      setForm={setEditForm}
                      busy={busy}
                      onTituloChange={onEditTituloChange}
                      idPrefixo={`ed-${a.id}`}
                    />
                    <div className="flex gap-2">
                      <Button type="submit" disabled={busy}>
                        {busy ? (
                          <Loader2 className="size-4 mr-2 animate-spin" />
                        ) : (
                          <Check className="size-4 mr-2" />
                        )}
                        Salvar
                      </Button>
                      <Button type="button" variant="ghost" onClick={onCancelEdit} disabled={busy}>
                        <X className="size-4 mr-1" /> Cancelar
                      </Button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-start gap-3">
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
                      <p className="text-xs text-muted-foreground/80 mt-1 whitespace-pre-line">
                        📝 {a.notas_internas}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5">
                    <IconeAcao
                      icon={Copy}
                      label="Copiar texto do artigo"
                      onClick={() => onCopiarArtigo(a)}
                      disabled={busy}
                    />
                    <IconeAcao
                      icon={a.publico ? Eye : EyeOff}
                      label={a.publico ? "Despublicar" : "Publicar"}
                      onClick={() => onTogglePublicar(a)}
                      disabled={busy}
                    />
                    <IconeAcao
                      icon={Pencil}
                      label="Editar"
                      onClick={() => onStartEdit(a)}
                      disabled={busy}
                    />
                    <IconeAcao
                      icon={Trash2}
                      label="Excluir"
                      tone="destructive"
                      onClick={() => onDelete(a)}
                      disabled={busy}
                    />
                  </div>
                </div>
              )
            }
          />
        )}
      </section>
    </div>
  );
}

AdminArtigosView.displayName = "AdminArtigosView";

function CamposArtigo({
  form,
  setForm,
  busy,
  onTituloChange,
  idPrefixo,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  busy: boolean;
  onTituloChange: (v: string) => void;
  idPrefixo: string;
}) {
  return (
    <>
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
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
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
          onChange={(e) => setForm((f) => ({ ...f, resumo: e.target.value }))}
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
            onChange={(e) =>
              setForm((f) => ({ ...f, categoria: e.target.value as ArtigoCategoria }))
            }
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
            onChange={(e) =>
              setForm((f) => ({ ...f, dificuldade: e.target.value as ArtigoDificuldade | "" }))
            }
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
            onChange={(e) => setForm((f) => ({ ...f, tempo_estimado_min: e.target.value }))}
            disabled={busy}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs">Fontes usadas (separe por vírgula)</Label>
        <Input
          value={form.fontes_usadas}
          onChange={(e) => setForm((f) => ({ ...f, fontes_usadas: e.target.value }))}
          disabled={busy}
          placeholder="PNCP, Portal da Transparência, SICONFI"
        />
      </div>

      <div>
        <Label className="text-xs" htmlFor={`${idPrefixo}-conteudo`}>
          Conteúdo
        </Label>
        <MarkdownEditor
          value={form.conteudo_md}
          onChange={(md) => setForm((f) => ({ ...f, conteudo_md: md }))}
          disabled={busy}
          placeholder="Escreva em Markdown. Use a aba Visualizar para ver com o estilo do site."
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          Texto salvo como Markdown (tabelas GFM suportadas). Fluxos embutíveis via toolbar ou
          shortcode <code>:::fluxo{`{nome="..."}`}:::</code> — disponíveis:{" "}
          {Object.keys(FLUXOS).map((n) => (
            <code key={n} className="mx-1">
              {n}
            </code>
          ))}
        </p>
      </div>

      <div>
        <Label className="text-xs">Notas internas (opcional)</Label>
        <Textarea
          value={form.notas_internas}
          onChange={(e) => setForm((f) => ({ ...f, notas_internas: e.target.value }))}
          maxLength={8000}
          disabled={busy}
          rows={3}
          placeholder="Notas técnicas internas. NÃO aparecem na página pública."
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Switch
          checked={form.publico}
          onCheckedChange={(v) => setForm((f) => ({ ...f, publico: v }))}
          disabled={busy}
          id={`${idPrefixo}-publico`}
        />
        <Label htmlFor={`${idPrefixo}-publico`} className="text-xs cursor-pointer">
          Publicado — aparece em <code>{rotaPublicaCategoria(form.categoria)}</code>
        </Label>
      </div>
    </>
  );
}
