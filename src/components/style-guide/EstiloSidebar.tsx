import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { uiRegistry } from "@/lib/style-guide/ui-registry";
import { composicoesRegistry } from "@/lib/style-guide/registry";

function NavItem({
  to,
  params,
  children,
}: {
  to: string;
  params?: Record<string, string>;
  children: React.ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const target = params
    ? to.replace(/\$([a-zA-Z0-9_]+)/g, (_m, k) => encodeURIComponent(params[k] ?? ""))
    : to;
  const active = pathname === target;
  return (
    <Link
      to={to}
      params={params as never}
      className={`block rounded px-2 py-1 text-xs transition-colors ${
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2">
        {label}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export function EstiloSidebar() {
  const uiByGroup = uiRegistry.reduce<Record<string, typeof uiRegistry>>((acc, e) => {
    (acc[e.group] ??= []).push(e);
    return acc;
  }, {});

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-card/30 px-3 py-4 space-y-5 overflow-y-auto sticky top-0 max-h-screen">
      <div>
        <Link
          to="/"
          className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="size-3" /> voltar à home
        </Link>
        <h1 className="font-display text-xl mt-2">
          <Link to="/estilo">Estilo</Link>
        </h1>
      </div>

      <Group label="Fundamentos">
        <NavItem to="/estilo/tokens">Tokens visuais</NavItem>
        <NavItem to="/estilo/tipografia">Tipografia</NavItem>
      </Group>

      {Object.entries(uiByGroup).map(([group, items]) => (
        <Group key={group} label={`UI · ${group}`}>
          {items.map((e) => (
            <NavItem key={e.slug} to="/estilo/ui/$slug" params={{ slug: e.slug }}>
              {e.name}
            </NavItem>
          ))}
        </Group>
      ))}

      <Group label="Composições">
        {composicoesRegistry.map((e) => (
          <NavItem key={e.name} to="/estilo/composicoes/$name" params={{ name: e.name }}>
            {e.name}
          </NavItem>
        ))}
      </Group>
    </aside>
  );
}