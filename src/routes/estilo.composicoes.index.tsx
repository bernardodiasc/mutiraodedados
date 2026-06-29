import { createFileRoute, Link } from "@tanstack/react-router";
import { composicoesRegistry } from "@/lib/style-guide/registry";

export const Route = createFileRoute("/estilo/composicoes/")({
  component: () => (
    <>
      <header>
        <h1 className="font-display text-3xl">Composições</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cada composição é renderizada em iframe para isolar modais, portais e
          estado global. Selecione uma para ver todas as variantes.
        </p>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {composicoesRegistry.map((e) => (
          <Link
            key={e.name}
            to="/estilo/composicoes/$name"
            params={{ name: e.name }}
            className="rounded-xl border border-border bg-card p-4 hover:bg-muted/40 transition-colors"
          >
            <div className="font-medium text-sm">{e.name}</div>
            {e.description && (
              <div className="text-xs text-muted-foreground mt-1 line-clamp-3">{e.description}</div>
            )}
            <div className="text-[10px] font-mono uppercase text-muted-foreground mt-2">
              {e.variants.length} variante{e.variants.length === 1 ? "" : "s"}
            </div>
          </Link>
        ))}
      </div>
    </>
  ),
});