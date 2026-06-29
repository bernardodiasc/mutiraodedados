import { createFileRoute, Link } from "@tanstack/react-router";
import { uiRegistry } from "@/lib/style-guide/ui-registry";

export const Route = createFileRoute("/estilo/ui/")({
  component: () => (
    <>
      <header>
        <h1 className="font-display text-3xl">Componentes UI</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Escolha um componente para ver todas as variantes.
        </p>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {uiRegistry.map((e) => (
          <Link
            key={e.slug}
            to="/estilo/ui/$slug"
            params={{ slug: e.slug }}
            className="rounded-xl border border-border bg-card p-4 hover:bg-muted/40 transition-colors"
          >
            <div className="font-medium text-sm">{e.name}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {e.group} · {e.variants.length} variante{e.variants.length === 1 ? "" : "s"}
            </div>
          </Link>
        ))}
      </div>
    </>
  ),
});