import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Check, Copy, Download, Eye, EyeOff, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { AdminHeader } from "@/components/AdminHeader";
import { FormColapsavel } from "@/components/FormColapsavel";
import { IconeAcao } from "@/components/IconeAcao";
import { ListaOrdenavel } from "@/components/ListaOrdenavel";
import type { RoadmapItem, RoadmapStatus } from "@/lib/data/roadmap.functions";
import {
  type Aba,
  type FormRoadmap,
  STATUS_LABEL,
  contarPorStatus,
  itensVisiveis,
} from "@/lib/admin-roadmap/logic";

export type AdminRoadmapViewProps = {
  isLoading: boolean;
  sorted: RoadmapItem[];
  busy: boolean;
  aba: Aba;
  setAba: (a: Aba) => void;
  criarAberto: boolean;
  setCriarAberto: (v: boolean) => void;
  criarForm: FormRoadmap;
  setCriarForm: React.Dispatch<React.SetStateAction<FormRoadmap>>;
  onCriarSubmit: (e: React.FormEvent) => void;
  editandoId: string | null;
  editForm: FormRoadmap;
  setEditForm: React.Dispatch<React.SetStateAction<FormRoadmap>>;
  onEditSubmit: (e: React.FormEvent) => void;
  onStartEdit: (it: RoadmapItem) => void;
  onCancelEdit: () => void;
  onReordenar: (visiveisNaNovaOrdem: string[]) => void;
  onTogglePublicar: (it: RoadmapItem) => void;
  onDelete: (it: RoadmapItem) => void;
  onDownloadLista: () => void;
  onCopiarItem: (it: RoadmapItem) => void;
};

export function AdminRoadmapView(props: AdminRoadmapViewProps) {
  const {
    sorted,
    busy,
    aba,
    setAba,
    isLoading,
    criarAberto,
    setCriarAberto,
    criarForm,
    setCriarForm,
    onCriarSubmit,
    editandoId,
    editForm,
    setEditForm,
    onEditSubmit,
    onStartEdit,
    onCancelEdit,
    onReordenar,
    onTogglePublicar,
    onDownloadLista,
    onCopiarItem,
  } = props;
  const contagens = contarPorStatus(sorted);
  const visiveis = itensVisiveis(sorted, aba);
  const podeArrastar = editandoId === null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-8">
      <AdminHeader titulo="Roadmap">
        Itens exibidos publicamente em{" "}
        <Link to="/sobre" className="text-accent underline">
          /sobre
        </Link>
        .
      </AdminHeader>

      <FormColapsavel titulo="Novo item" aberto={criarAberto} onAbertoChange={setCriarAberto}>
        <form onSubmit={onCriarSubmit} className="space-y-3">
          <CamposRoadmap form={criarForm} setForm={setCriarForm} busy={busy} idPrefixo="novo" />
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Plus className="size-4 mr-2" />
              )}
              Adicionar
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
                ["tudo", "Tudo", contagens.tudo],
                ["em_andamento", "Em andamento", contagens.em_andamento],
                ["planejado", "Planejado", contagens.planejado],
                ["concluido", "Concluídos", contagens.concluido],
              ] as const
            ).map(([k, l, qtd]) => (
              <button
                data-flat
                key={k}
                onClick={() => setAba(k)}
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
            disabled={visiveis.length === 0}
          >
            <Download className="size-3.5 mr-1.5" /> Baixar CSV
          </Button>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Carregando…
          </div>
        ) : visiveis.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum item nesta aba.</p>
        ) : (
          <ListaOrdenavel
            itens={visiveis}
            getId={(it) => it.id}
            onReordenar={onReordenar}
            desabilitado={!podeArrastar}
            renderItem={(it) =>
              editandoId === it.id ? (
                <div className="rounded-xl border border-accent bg-card p-5">
                  <form onSubmit={onEditSubmit} className="space-y-3">
                    <h3 className="font-display text-base">Editar: {it.titulo}</h3>
                    <CamposRoadmap
                      form={editForm}
                      setForm={setEditForm}
                      busy={busy}
                      idPrefixo={`ed-${it.id}`}
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
                      <span className="font-medium">{it.titulo}</span>
                      <span
                        className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          it.status === "concluido"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            : it.status === "em_andamento"
                              ? "bg-accent/15 text-accent"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {STATUS_LABEL[it.status]}
                      </span>
                      {!it.publico && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          interno
                        </span>
                      )}
                      {it.concluido_em && (
                        <span className="text-[10px] text-muted-foreground">{it.concluido_em}</span>
                      )}
                    </div>
                    {it.descricao && (
                      <p className="text-xs text-muted-foreground mt-1">{it.descricao}</p>
                    )}
                    {it.notas && (
                      <p className="text-xs text-muted-foreground/80 mt-1 whitespace-pre-line">
                        📝 {it.notas}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5">
                    <IconeAcao
                      icon={Copy}
                      label="Copiar texto do item"
                      onClick={() => onCopiarItem(it)}
                      disabled={busy}
                    />
                    <IconeAcao
                      icon={it.publico ? Eye : EyeOff}
                      label={it.publico ? "Despublicar" : "Publicar"}
                      onClick={() => onTogglePublicar(it)}
                      disabled={busy}
                    />
                    <IconeAcao
                      icon={Pencil}
                      label="Editar"
                      onClick={() => onStartEdit(it)}
                      disabled={busy}
                    />
                    <IconeAcao
                      icon={Trash2}
                      label="Excluir"
                      tone="destructive"
                      onClick={() => props.onDelete(it)}
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

AdminRoadmapView.displayName = "AdminRoadmapView";

function CamposRoadmap({
  form,
  setForm,
  busy,
  idPrefixo,
}: {
  form: FormRoadmap;
  setForm: React.Dispatch<React.SetStateAction<FormRoadmap>>;
  busy: boolean;
  idPrefixo: string;
}) {
  return (
    <>
      <div>
        <Label className="text-xs">Título</Label>
        <Input
          value={form.titulo}
          onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
          maxLength={300}
          disabled={busy}
          placeholder="Ex.: Integração com Tribunais de Contas estaduais"
        />
      </div>
      <div>
        <Label className="text-xs">Descrição (opcional)</Label>
        <Textarea
          value={form.descricao}
          onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
          maxLength={2000}
          disabled={busy}
          rows={3}
        />
      </div>
      <div>
        <Label className="text-xs">Status</Label>
        <select
          className="mt-1 block rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          value={form.status}
          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as RoadmapStatus }))}
          disabled={busy}
        >
          <option value="planejado">Planejado</option>
          <option value="em_andamento">Em andamento</option>
          <option value="concluido">Concluído</option>
        </select>
      </div>
      {form.status === "concluido" && (
        <div>
          <Label className="text-xs">Concluído em</Label>
          <Input
            type="date"
            value={form.concluido_em}
            onChange={(e) => setForm((f) => ({ ...f, concluido_em: e.target.value }))}
            disabled={busy}
            className="max-w-[180px]"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Aparece como nota de versão na página pública. Deixe vazio para usar a data de hoje.
          </p>
        </div>
      )}
      <div>
        <Label className="text-xs">Notas internas (opcional)</Label>
        <Textarea
          value={form.notas}
          onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
          maxLength={4000}
          disabled={busy}
          rows={3}
          placeholder="Notas técnicas internas (escopo, decisões de arquitetura, contexto para a IA). NÃO aparecem na página pública."
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
          Público — aparece na página <code>/roadmap</code>
        </Label>
      </div>
    </>
  );
}
