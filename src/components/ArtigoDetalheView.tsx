import { Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Clock, Loader2 } from "lucide-react";
import { ArtigoRenderer } from "@/components/ArtigoRenderer";
import { obterRotuloDificuldade, type ArtigoDetalheViewProps } from "@/lib/artigo-detalhe/logic";

export function ArtigoDetalheView({
  isLoading,
  error,
  artigo,
  voltarTo,
  voltarLabel,
}: ArtigoDetalheViewProps) {
  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="size-4 animate-spin" /> Carregando…
      </div>
    );
  }
  if (error) throw error;
  if (!artigo) throw notFound();

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
          {artigo.dificuldade && (
            <span className="px-1.5 py-0.5 rounded bg-muted">
              {obterRotuloDificuldade(artigo.dificuldade)}
            </span>
          )}
          {artigo.tempo_estimado_min != null && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" /> {artigo.tempo_estimado_min} min
            </span>
          )}
        </div>
        <h1 className="font-display text-4xl leading-tight">{artigo.titulo}</h1>
        {artigo.resumo && (
          <p className="text-base text-muted-foreground leading-relaxed">{artigo.resumo}</p>
        )}
        {artigo.fontes_usadas.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {artigo.fontes_usadas.map((f) => (
              <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                {f}
              </span>
            ))}
          </div>
        )}
      </header>

      <ArtigoRenderer conteudo={artigo.conteudo_md} />
    </article>
  );
}
ArtigoDetalheView.displayName = "ArtigoDetalheView";