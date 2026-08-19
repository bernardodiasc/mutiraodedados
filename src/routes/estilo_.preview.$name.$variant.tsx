import { createFileRoute } from "@tanstack/react-router";
import { composicoesRegistry } from "@/lib/style-guide/registry";

export const Route = createFileRoute("/estilo_/preview/$name/$variant")({
  component: PreviewPage,
  head: () => ({
    meta: [{ title: "Preview — Estilo" }, { name: "robots", content: "noindex" }],
  }),
});

function PreviewPage() {
  const { name, variant } = Route.useParams();
  const entry = composicoesRegistry.find((e) => e.name === name);
  if (!entry) {
    return (
      <div className="p-4 text-sm text-muted-foreground">Composição "{name}" não encontrada.</div>
    );
  }
  const idx = Number(variant);
  const v = entry.variants[idx];
  if (!v) {
    return <div className="p-4 text-sm text-muted-foreground">Variante {variant} não existe.</div>;
  }
  const View = entry.View as React.ComponentType<unknown>;
  return (
    <div className="min-h-screen bg-background p-4">
      <View {...(v.props as object)} />
    </div>
  );
}
