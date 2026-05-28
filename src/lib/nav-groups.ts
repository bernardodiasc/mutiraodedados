import {
  Search,
  Map,
  Building2,
  Landmark,
  Users,
  Gavel,
  FileText,
  PieChart,
  FileSignature,
  HandCoins,
  Flame,
  Eye,
  MessageSquareWarning,
  Info,
  BookOpen,
  Microscope,
  Database,
  Shield,
  Scroll,
  Compass,
  AlertTriangle,
  ListChecks,
  Library,
  Route as RouteIcon,
  GraduationCap,
  StickyNote,
  Activity,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export type NavLink = { to: string; label: string; icon: LucideIcon };
export type NavSubgroup = { label: string; links: NavLink[] };
export type NavGroup = {
  label: string;
  icon: LucideIcon;
  /** Link em destaque no topo do grupo (mega-menu). */
  featured?: NavLink & { description?: string };
  /** Subgrupos dentro do grupo. Use isso OU `links`, não ambos. */
  subgroups?: NavSubgroup[];
  /** Lista plana de links (compatibilidade com grupos simples). */
  links?: NavLink[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Explorar",
    icon: Compass,
    featured: {
      to: "/orgaos",
      label: "Órgãos federais",
      icon: Building2,
      description:
        "Hub do universo federal: ministérios, autarquias, Legislativo, Judiciário e MPU.",
    },
    subgroups: [
      {
        label: "Parlamento",
        links: [
          { to: "/congresso", label: "Congresso Nacional", icon: Landmark },
          { to: "/camara", label: "Câmara dos Deputados", icon: Users },
          { to: "/senado", label: "Senado Federal", icon: Gavel },
        ],
      },
      {
        label: "Por fonte de dados",
        links: [
          { to: "/pncp", label: "Contratos (PNCP)", icon: FileText },
          { to: "/siconfi", label: "Relatórios fiscais (SICONFI)", icon: PieChart },
          { to: "/convenios", label: "Convênios (Transferegov)", icon: FileSignature },
          { to: "/transferencias", label: "Transferências diretas (EC 105)", icon: HandCoins },
        ],
      },
      {
        label: "Ferramentas",
        links: [
          { to: "/buscar", label: "Busca unificada", icon: Search },
          { to: "/explorar", label: "Explorar por ente", icon: Map },
        ],
      },
    ],
  },
  {
    label: "Investigar",
    icon: AlertTriangle,
    subgroups: [
      {
        label: "Análise e contestação",
        links: [
          { to: "/anomalias", label: "Sinais investigativos", icon: Flame },
          { to: "/transparencia-institucional", label: "Transparência institucional", icon: Eye },
          { to: "/contestar", label: "Contestar análise", icon: MessageSquareWarning },
        ],
      },
      {
        label: "Aprender",
        links: [
          { to: "/aprender", label: "Primeiros passos", icon: BookOpen },
          { to: "/metodologia", label: "Critérios dos sinais", icon: Microscope },
          { to: "/mapas", label: "Mapas investigativos", icon: RouteIcon },
          { to: "/tutoriais", label: "Tutoriais da ferramenta", icon: GraduationCap },
          { to: "/notas", label: "Notas de campo", icon: StickyNote },
        ],
      },
    ],
  },
  {
    label: "Sobre",
    icon: Info,
    links: [
      { to: "/sobre", label: "Sobre o projeto", icon: Info },
      { to: "/roadmap", label: "Roadmap & novidades", icon: ListChecks },
      { to: "/cobertura", label: "Cobertura dos dados", icon: Activity },
      { to: "/qualidade", label: "Qualidade dos dados", icon: ShieldCheck },
      { to: "/referencias", label: "Referências & projetos similares", icon: Library },
      { to: "/tratamento-de-dados", label: "Tratamento de dados", icon: Database },
      { to: "/privacidade", label: "Privacidade (LGPD)", icon: Shield },
      { to: "/termos", label: "Termos de uso", icon: Scroll },
    ],
  },
];

/** Achata todos os links de um grupo (featured + subgroups + links). */
export function flattenGroupLinks(g: NavGroup): NavLink[] {
  const out: NavLink[] = [];
  if (g.featured) out.push({ to: g.featured.to, label: g.featured.label, icon: g.featured.icon });
  if (g.subgroups) for (const s of g.subgroups) out.push(...s.links);
  if (g.links) out.push(...g.links);
  return out;
}

// Lookup map: path → icon. Use this anywhere outside the nav (home page cards,
// breadcrumbs, etc.) so the visual identity of each page stays consistent.
export const PAGE_ICONS: Record<string, LucideIcon> = Object.fromEntries(
  NAV_GROUPS.flatMap((g) => flattenGroupLinks(g).map((l) => [l.to, l.icon] as const)),
);

export function iconFor(path: string): LucideIcon {
  return PAGE_ICONS[path] ?? Info;
}
