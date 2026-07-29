import { Link } from "@tanstack/react-router";
import { NAV_GROUPS, type NavLink } from "@/lib/nav-groups";

export function SiteFooter() {
  return (
    <footer className="border-t border-border mt-20">
      <div className="mx-auto max-w-7xl px-4 py-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-5 text-sm">
        <div>
          <div className="font-display text-xl">Mutirão de Dados</div>
          <p className="text-muted-foreground mt-2 leading-relaxed">
            Observatório cívico de interpretação pública do Estado. Reorganiza dados
            administrativos para fortalecer o controle social responsável.
          </p>
        </div>
        {NAV_GROUPS.map((g) => {
          const GroupIcon = g.icon;
          const renderItem = (l: NavLink) => {
            const ItemIcon = l.icon;
            return (
              <li key={l.to}>
                <Link to={l.to} className="hover:text-foreground inline-flex items-center gap-2">
                  <ItemIcon className="size-3.5 opacity-70" />
                  {l.label}
                </Link>
              </li>
            );
          };
          return (
            <div key={g.label}>
              <div className="font-semibold mb-2 flex items-center gap-1.5">
                <GroupIcon className="size-4 text-accent" />
                {g.label}
              </div>
              <ul className="space-y-1 text-muted-foreground">
                {g.featured && renderItem({ to: g.featured.to, label: g.featured.label, icon: g.featured.icon })}
                {g.subgroups?.map((sg) => (
                  <li key={sg.label} className="pt-2">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground/70 mb-1">
                      {sg.label}
                    </div>
                    <ul className="space-y-1">{sg.links.map(renderItem)}</ul>
                  </li>
                ))}
                {g.links?.map(renderItem)}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 py-5 text-xs text-muted-foreground leading-relaxed">
          Plataforma experimental em evolução. Os indicadores publicados são sinais
          estatísticos baseados em dados públicos e não constituem prova jurídica, parecer
          técnico ou conclusão sobre conduta de pessoas físicas ou jurídicas. Anomalia ≠
          irregularidade.
        </div>
      </div>
    </footer>
  );
}
