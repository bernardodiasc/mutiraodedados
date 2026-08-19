import { createFileRoute, notFound } from "@tanstack/react-router";
import { composicoesRegistry } from "@/lib/style-guide/registry";

export const Route = createFileRoute("/estilo/composicoes/$name")({
  component: ComposicaoDetail,
  notFoundComponent: () => (
    <div className="text-sm text-muted-foreground">Composição não encontrada.</div>
  ),
});

function ComposicaoDetail() {
  const { name } = Route.useParams();
  const entry = composicoesRegistry.find((e) => e.name === name);
  if (!entry) throw notFound();
  const View = entry.View;

  return (
    <>
      <header>
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Composição
        </div>
        <h1 className="font-display text-3xl mt-1">{entry.name}</h1>
        {entry.description && (
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">{entry.description}</p>
        )}
      </header>

      <div className="space-y-6">
        {entry.variants.map((v, i) => {
          const src = `/estilo/preview/${encodeURIComponent(entry.name)}/${i}`;
          return (
            <section key={`${v.label}-${i}`} className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                  {v.label}
                </div>
                {entry.iframe && (
                  <a
                    href={src}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-muted-foreground hover:text-foreground underline"
                  >
                    abrir em nova aba ↗
                  </a>
                )}
              </div>
              {entry.iframe ? (
                <div className="rounded-lg border border-border bg-card/30 overflow-hidden">
                  <iframe
                    src={src}
                    title={`${entry.name} — ${v.label}`}
                    className="w-full h-[640px] border-0 bg-background"
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-card/30 p-4">
                  <View {...(v.props as object)} />
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
