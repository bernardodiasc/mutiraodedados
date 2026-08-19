import { Link } from "@tanstack/react-router";
import { Loader2, Clock, Layers, Calendar, type LucideIcon } from "lucide-react";
import type { ArtigoCategoria, Artigo } from "@/lib/data/artigos.functions";
import {
  dificuldadeLabel,
  formatDataPublicacao,
  detailPathFor,
  type ArtigoBasePath,
} from "@/lib/artigos-index/logic";

export type ArtigosIndexListViewProps = {
  categoria: ArtigoCategoria;
  titulo: string;
  descricao: string;
  icon: LucideIcon;
  basePath: ArtigoBasePath;
  emptyLabel: string;
  itens: Artigo[];
  isLoading: boolean;
};

export function ArtigosIndexListView({
  categoria,
  titulo,
  descricao,
  icon: Icon,
  basePath,
  emptyLabel,
  itens,
  isLoading,
}: ArtigosIndexListViewProps) {
  const detailPath = detailPathFor(basePath);
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 text-xs text-accent">
          <Icon className="size-4" />
          Investigar
        </div>
        <h1 className="font-display text-4xl">{titulo}</h1>
        <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">{descricao}</p>
      </header>

      {isLoading ? (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      ) : itens.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
          <Layers className="size-8 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">{emptyLabel}</p>
        </div>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-4">
          {itens.map((m) => {
            const dataFmt = formatDataPublicacao(m.publicado_em);
            const dif = dificuldadeLabel(m.dificuldade);
            return (
              <li key={m.id}>
                <Link
                  to={detailPath}
                  params={{ slug: m.slug }}
                  className="group block rounded-xl border border-border bg-card hover:border-accent/40 transition-colors p-5 h-full"
                >
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {categoria === "nota" && dataFmt && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="size-3" />
                        {dataFmt}
                      </span>
                    )}
                    {categoria !== "nota" && dif && (
                      <span className="px-1.5 py-0.5 rounded bg-muted">{dif}</span>
                    )}
                    {categoria !== "nota" && m.tempo_estimado_min != null && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        {m.tempo_estimado_min} min
                      </span>
                    )}
                  </div>
                  <h2 className="font-display text-xl mt-2 group-hover:text-accent transition-colors">
                    {m.titulo}
                  </h2>
                  {m.resumo && (
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{m.resumo}</p>
                  )}
                  {m.fontes_usadas.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {m.fontes_usadas.map((f: string) => (
                        <span
                          key={f}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

ArtigosIndexListView.displayName = "ArtigosIndexListView";
