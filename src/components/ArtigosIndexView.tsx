import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Clock, Layers, Calendar, type LucideIcon } from "lucide-react";
import { listarArtigosPublicos, type ArtigoCategoria } from "@/lib/data/artigos.functions";

const DIFICULDADE_LABEL: Record<string, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

const DATA_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function ArtigosIndexView({
  categoria,
  titulo,
  descricao,
  icon: Icon,
  basePath,
  emptyLabel,
}: {
  categoria: ArtigoCategoria;
  titulo: string;
  descricao: string;
  icon: LucideIcon;
  /** Caminho base sem trailing slash, ex: "/investigar/mapas" */
  basePath: "/mapas" | "/tutoriais" | "/notas";
  emptyLabel: string;
}) {
  const fetchLista = useServerFn(listarArtigosPublicos);
  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["artigos-publicos", categoria],
    queryFn: () => fetchLista({ data: { categoria } }),
  });

  const detailPath = `${basePath}/$slug` as
    | "/mapas/$slug"
    | "/tutoriais/$slug"
    | "/notas/$slug";

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
          {itens.map((m) => (
            <li key={m.id}>
              <Link
                to={detailPath}
                params={{ slug: m.slug }}
                className="group block rounded-xl border border-border bg-card hover:border-accent/40 transition-colors p-5 h-full"
              >
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {categoria === "nota" && m.publicado_em && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="size-3" />
                      {DATA_FMT.format(new Date(m.publicado_em))}
                    </span>
                  )}
                  {categoria !== "nota" && m.dificuldade && (
                    <span className="px-1.5 py-0.5 rounded bg-muted">
                      {DIFICULDADE_LABEL[m.dificuldade] ?? m.dificuldade}
                    </span>
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
                    {m.fontes_usadas.map((f) => (
                      <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}