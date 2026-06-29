import * as React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { RoadmapItem, RoadmapStatus } from "@/lib/data/roadmap.functions";
import {
  type Aba,
  type FormRoadmap,
  STATUS_LABEL,
  contarPorStatus,
  filtrarPorAba,
} from "@/lib/admin-roadmap/logic";

export type AdminRoadmapViewProps = {
  isLoading: boolean;
  sorted: RoadmapItem[];
  editing: RoadmapItem | null;
  form: FormRoadmap;
  setForm: (f: FormRoadmap) => void;
  busy: boolean;
  aba: Aba;
  setAba: (a: Aba) => void;
  onSubmit: (e: React.FormEvent) => void;
  onReset: () => void;
  onStartEdit: (it: RoadmapItem) => void;
  onMove: (it: RoadmapItem, dir: -1 | 1) => void;
  onDelete: (it: RoadmapItem) => void;
};

export function AdminRoadmapView(props: AdminRoadmapViewProps) {
  const { sorted, editing, form, setForm, busy, aba, setAba, isLoading } = props;
  const contagens = contarPorStatus(sorted);
  const visiveis = filtrarPorAba(sorted, aba);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      <div className="flex items-center gap-3">
        <Link
          to="/admin"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="size-3.5" /> voltar
        </Link>
      </div>
      <header>
        <h1 className="font-display text-4xl">Roadmap</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Itens exibidos publicamente em{" "}
          <Link to="/sobre" className="text-accent underline">/sobre</Link>.
        </p>
      </header>

      <form
        onSubmit={props.onSubmit}
        className="rounded-xl border border-border bg-card p-5 space-y-3"
      >
        <h2 className="font-display text-lg">{editing ? "Editar item" : "Novo item"}</h2>
        <div>
          <Label className="text-xs">Título</Label>
          <Input
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            maxLength={300}
            disabled={busy}
            placeholder="Ex.: Integração com Tribunais de Contas estaduais"
          />
        </div>
        <div>
          <Label className="text-xs">Descrição (opcional)</Label>
          <Textarea
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
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
            onChange={(e) =>
              setForm({ ...form, status: e.target.value as RoadmapStatus })
            }
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
              onChange={(e) => setForm({ ...form, concluido_em: e.target.value })}
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
            onChange={(e) => setForm({ ...form, notas: e.target.value })}
            maxLength={4000}
            disabled={busy}
            rows={3}
            placeholder="Notas técnicas internas (escopo, decisões de arquitetura, contexto para a IA). NÃO aparecem na página pública."
          />
        </div>
        <div className="flex items-center gap-3 pt-1">
          <Switch
            checked={form.publico}
            onCheckedChange={(v) => setForm({ ...form, publico: v })}
            disabled={busy}
            id="publico-switch"
          />
          <Label htmlFor="publico-switch" className="text-xs cursor-pointer">
            Público — aparece na página <code>/roadmap</code>
          </Label>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Plus className="size-4 mr-2" />
            )}
            {editing ? "Salvar" : "Adicionar"}
          </Button>
          {editing && (
            <Button type="button" variant="ghost" onClick={props.onReset} disabled={busy}>
              Cancelar
            </Button>
          )}
        </div>
      </form>

      <section className="space-y-2">
        <h2 className="font-display text-lg">Itens</h2>

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
                  aba === k
                    ? "bg-accent/20 text-accent"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {qtd}
              </span>
            </button>
          ))}
        </nav>

        {isLoading ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Carregando…
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum item ainda.</p>
        ) : (
          <ul className="space-y-2">
            {visiveis.map((it, i, arr) => (
              <li
                key={it.id}
                className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-start gap-3"
              >
                <div className="flex flex-col gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => props.onMove(it, -1)}
                    disabled={busy || i === 0}
                  >
                    <ChevronUp className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => props.onMove(it, 1)}
                    disabled={busy || i === arr.length - 1}
                  >
                    <ChevronDown className="size-3.5" />
                  </Button>
                </div>
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
                      <span className="text-[10px] text-muted-foreground">
                        {it.concluido_em}
                      </span>
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
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => props.onStartEdit(it)}
                    disabled={busy}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => props.onDelete(it)}
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