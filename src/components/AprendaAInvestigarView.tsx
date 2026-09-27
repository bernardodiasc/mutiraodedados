import { GraduationCap } from "lucide-react";
import type { ArtigoQueCita } from "@/lib/data/artigos-que-citam.functions";

const ROTULO_CATEGORIA: Record<string, string> = {
  mapa: "Mapa",
  tutorial: "Tutorial",
  nota: "Nota",
};

/**
 * "Aprenda a investigar este registro": artigos publicados que citam o
 * registro da ficha. Sem artigo, não ocupa espaço.
 */
export function AprendaAInvestigarView({ artigos }: { artigos: ArtigoQueCita[] }) {
  if (artigos.length === 0) return null;
  return (
    <aside
      aria-labelledby="aprenda-titulo"
      className="rounded-xl border border-border bg-card p-4 text-sm"
    >
      <h2 id="aprenda-titulo" className="flex items-center gap-2 font-medium">
        <GraduationCap className="size-4 text-accent" aria-hidden />
        Aprenda a investigar este registro
      </h2>
      <ul className="mt-2 space-y-2">
        {artigos.map((a) => (
          <li key={a.href}>
            <a href={a.href} className="text-accent underline">
              {a.titulo}
            </a>
            <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              {ROTULO_CATEGORIA[a.categoria] ?? a.categoria}
            </span>
            {a.resumo && <p className="text-xs text-muted-foreground mt-0.5">{a.resumo}</p>}
          </li>
        ))}
      </ul>
    </aside>
  );
}
