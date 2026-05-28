import { Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, Loader2 } from "lucide-react";
import { obterArtigoPublico } from "@/lib/data/artigos.functions";
import { ArtigoRenderer } from "@/components/ArtigoRenderer";

const DIFICULDADE_LABEL: Record<string, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

export function ArtigoDetalheView({
  slug,
  voltarTo,
  voltarLabel,
}: {
  slug: string;
  voltarTo: "/mapas" | "/tutoriais" | "/notas";
  voltarLabel: string;
}) {
  const fetchArtigo = useServerFn(obterArtigoPublico);
  const { data, isLoading, error } = useQuery({
    queryKey: ["artigo-publico", slug],
    queryFn: () => fetchArtigo({ data: { slug } }),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="size-4 animate-spin" /> Carregando…
      </div>
    );
  }
  if (error) throw error;
  if (!data) throw notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <Link
        to={voltarTo}
        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="size-3.5" /> {voltarLabel}
      </Link>

      <header className="space-y-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          {data.dificuldade && (
            <span className="px-1.5 py-0.5 rounded bg-muted">
              {DIFICULDADE_LABEL[data.dificuldade] ?? data.dificuldade}
            </span>
          )}
          {data.tempo_estimado_min != null && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" /> {data.tempo_estimado_min} min
            </span>
          )}
        </div>
        <h1 className="font-display text-4xl leading-tight">{data.titulo}</h1>
        {data.resumo && (
          <p className="text-base text-muted-foreground leading-relaxed">{data.resumo}</p>
        )}
        {data.fontes_usadas.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {data.fontes_usadas.map((f) => (
              <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                {f}
              </span>
            ))}
          </div>
        )}
      </header>

      <ArtigoRenderer conteudo={data.conteudo_md} />
    </article>
  );
}