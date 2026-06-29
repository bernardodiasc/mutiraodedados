import { createFileRoute, Link } from "@tanstack/react-router";
import { uiRegistry } from "@/lib/style-guide/ui-registry";
import { composicoesRegistry } from "@/lib/style-guide/registry";

export const Route = createFileRoute("/estilo/")({
  component: EstiloHome,
});

function Card({ to, params, title, sub }: { to: string; params?: Record<string, string>; title: string; sub: string }) {
  return (
    <Link
      to={to}
      params={params as never}
      className="rounded-xl border border-border bg-card p-4 hover:bg-muted/40 transition-colors block"
    >
      <div className="font-medium text-sm">{title}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </Link>
  );
}

function EstiloHome() {
  return (
    <>
      <header>
        <h1 className="font-display text-3xl">Style guide</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Tokens visuais definidos em <code>src/styles.css</code>, tipografia,
          componentes UI base e composições do projeto — todos isolados,
          renderizados com dados mockados. Composições rodam em iframes para
          isolar modais e estado.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Fundamentos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card to="/estilo/tokens" title="Tokens visuais" sub="Cores, radius, sombras, espaçamento" />
          <Card to="/estilo/tipografia" title="Tipografia" sub="Famílias e escala" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Componentes UI · {uiRegistry.length}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {uiRegistry.map((e) => (
            <Card
              key={e.slug}
              to="/estilo/ui/$slug"
              params={{ slug: e.slug }}
              title={e.name}
              sub={`${e.group} · ${e.variants.length} variante${e.variants.length === 1 ? "" : "s"}`}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Composições · {composicoesRegistry.length}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {composicoesRegistry.map((e) => (
            <Card
              key={e.name}
              to="/estilo/composicoes/$name"
              params={{ name: e.name }}
              title={e.name}
              sub={`${e.variants.length} variante${e.variants.length === 1 ? "" : "s"}`}
            />
          ))}
        </div>
      </section>
    </>
  );
}