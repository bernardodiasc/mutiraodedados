import { createFileRoute, notFound } from "@tanstack/react-router";
import { uiRegistry } from "@/lib/style-guide/ui-registry";

export const Route = createFileRoute("/estilo/ui/$slug")({
  component: UIDetail,
  notFoundComponent: () => (
    <div className="text-sm text-muted-foreground">Componente não encontrado.</div>
  ),
});

function UIDetail() {
  const { slug } = Route.useParams();
  const entry = uiRegistry.find((e) => e.slug === slug);
  if (!entry) throw notFound();

  return (
    <>
      <header>
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          UI · {entry.group}
        </div>
        <h1 className="font-display text-3xl mt-1">{entry.name}</h1>
        {entry.description && (
          <p className="text-sm text-muted-foreground mt-1">{entry.description}</p>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {entry.variants.map((v, i) => (
          <div key={`${v.label}-${i}`} className="space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
              {v.label}
            </div>
            <div className="rounded-lg border border-dashed border-border bg-card/30 p-4 flex items-start">
              {v.render()}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
