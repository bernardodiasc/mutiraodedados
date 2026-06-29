import { Section } from "./SectionPrimitives";
import { COLOR_TOKENS, CHART_TOKENS, SIDEBAR_TOKENS, RADIUS_TOKENS, SPACING_SAMPLES } from "@/lib/style-guide/tokens";

function ComputedVar({ name }: { name: string }) {
  if (typeof window === "undefined") return <span>oklch(…)</span>;
  const val = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  return <span>{val || "—"}</span>;
}

function ColorSwatch({ name }: { name: string }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden bg-card">
      <div className="h-16 w-full" style={{ background: `var(--${name})` }} />
      <div className="p-2 text-xs">
        <div className="font-mono">--{name}</div>
        <div className="text-muted-foreground font-mono text-[10px] truncate" id={`val-${name}`}>
          <ComputedVar name={name} />
        </div>
      </div>
    </div>
  );
}

export function TokensSection() {
  return (
    <>
      <Section title="Cores semânticas" description="Tokens light/dark. Use sempre via classes Tailwind (bg-primary, text-foreground). Nunca cores diretas.">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {COLOR_TOKENS.map((c) => <ColorSwatch key={c} name={c} />)}
        </div>
      </Section>

      <Section title="Cores de gráfico">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {CHART_TOKENS.map((c) => <ColorSwatch key={c} name={c} />)}
        </div>
      </Section>

      <Section title="Sidebar" description="Tokens dedicados ao componente Sidebar do shadcn.">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SIDEBAR_TOKENS.map((c) => <ColorSwatch key={c} name={c} />)}
        </div>
      </Section>

      <Section title="Radius" description="Escala derivada de --radius (0.625rem).">
        <div className="flex flex-wrap gap-4">
          {RADIUS_TOKENS.map((r) => (
            <div key={r} className="text-center">
              <div
                className="size-20 bg-accent/20 border border-accent/40"
                style={{ borderRadius: `var(--radius-${r})` }}
              />
              <div className="mt-1 text-xs font-mono">{r}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Sombras e elevação" description="Definidas globalmente em @layer base para links/role=button com borda e rounded.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border p-6 bg-card">Painel estático (sem sombra)</div>
          <a href="#" className="rounded-xl border border-border p-6 bg-card block">Card clicável (sombra padrão + lift)</a>
          <button className="rounded-xl p-6 text-left">Botão "nu" (sombra padrão)</button>
        </div>
      </Section>

      <Section title="Espaçamento" description="Escala base do Tailwind (1 unidade = 0.25rem = 4px).">
        <div className="space-y-1">
          {SPACING_SAMPLES.map((n) => (
            <div key={n} className="flex items-center gap-3">
              <div className="w-10 text-xs font-mono text-muted-foreground text-right">{n}</div>
              <div className="h-3 bg-accent/40" style={{ width: `${n * 0.25}rem` }} />
              <div className="text-xs text-muted-foreground font-mono">{n * 0.25}rem · {n * 4}px</div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}