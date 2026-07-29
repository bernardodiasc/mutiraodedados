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
  HeartHandshake,
  HelpCircle,
  Bookmark,
  CircleDashed,
  Megaphone,
  MapPinned,
  Paintbrush,
  ScrollText,
  Scale,
  Banknote,
  Share2,
  Calculator,
  Vote,
  type LucideIcon,
} from "lucide-react";

/**
 * Modos do produto. Eixo paralelo à navegação por fonte/tema.
 * - aprender: páginas para compreender.
 * - perguntar: páginas para formular perguntas.
 * - investigar: páginas para apurar evidências.
 * - explorar: dados brutos (modo transversal — alimenta os três).
 * - sobre: meta-informação do projeto.
 */
export type NavMode = "aprender" | "perguntar" | "investigar" | "explorar" | "sobre";

export type NavLink = { to: string; label: string; icon: LucideIcon; mode?: NavMode };
export type NavSubgroup = { label: string; links: NavLink[] };
export type NavGroup = {
  label: string;
  icon: LucideIcon;
  mode?: NavMode;
  /** Link em destaque no topo do grupo (mega-menu). */
  featured?: NavLink & { description?: string };
  /** Subgrupos dentro do grupo. Use isso OU `links`, não ambos. */
  subgroups?: NavSubgroup[];
  /** Lista plana de links (compatibilidade com grupos simples). */
  links?: NavLink[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Aprender",
    icon: BookOpen,
    mode: "aprender",
    subgroups: [
      {
        label: "Compreender",
        links: [
          { to: "/aprender", label: "Primeiros passos", icon: BookOpen, mode: "aprender" },
          { to: "/metodologia", label: "Critérios dos sinais", icon: Microscope, mode: "aprender" },
          { to: "/trilhas", label: "Trilhas", icon: RouteIcon, mode: "aprender" },
        ],
      },
      {
        label: "Estudar a ferramenta",
        links: [
          { to: "/tutoriais", label: "Tutoriais", icon: GraduationCap, mode: "aprender" },
          { to: "/mapas", label: "Mapas investigativos", icon: Map, mode: "aprender" },
          { to: "/notas", label: "Notas de campo", icon: StickyNote, mode: "aprender" },
        ],
      },
    ],
  },
  {
    label: "Investigar",
    icon: AlertTriangle,
    mode: "investigar",
    subgroups: [
      {
        label: "O que está em debate",
        links: [
          { to: "/perguntas", label: "Perguntas", icon: HelpCircle, mode: "perguntar" },
          { to: "/afirmacoes", label: "Afirmações públicas", icon: Megaphone, mode: "perguntar" },
        ],
      },
      {
        label: "Sinais e contestação",
        links: [
          { to: "/anomalias", label: "Sinais investigativos", icon: Flame, mode: "investigar" },
          {
            to: "/transparencia-institucional",
            label: "Transparência institucional",
            icon: Eye,
            mode: "investigar",
          },
          {
            to: "/contestar",
            label: "Contestar análise",
            icon: MessageSquareWarning,
            mode: "investigar",
          },
        ],
      },
      {
        label: "Confiabilidade dos dados",
        links: [
          { to: "/qualidade", label: "Qualidade dos dados", icon: ShieldCheck, mode: "investigar" },
          { to: "/cobertura", label: "Cobertura dos dados", icon: Activity, mode: "investigar" },
          { to: "/lacunas", label: "Informação que falta", icon: CircleDashed, mode: "investigar" },
        ],
      },
    ],
  },
  {
    label: "Explorar",
    icon: Compass,
    mode: "explorar",
    subgroups: [
      {
        label: "Ferramentas",
        links: [
          { to: "/buscar", label: "Busca unificada", icon: Search, mode: "explorar" },
          { to: "/explorar", label: "Explorar por ente", icon: MapPinned, mode: "explorar" },
          { to: "/orgaos", label: "Órgãos federais", icon: Building2, mode: "explorar" },
        ],
      },
      {
        label: "Parlamento",
        links: [
          { to: "/congresso", label: "Congresso Nacional", icon: Landmark, mode: "explorar" },
          { to: "/camara", label: "Câmara dos Deputados", icon: Users, mode: "explorar" },
          { to: "/senado", label: "Senado Federal", icon: Gavel, mode: "explorar" },
        ],
      },
      {
        label: "Por fonte de dados",
        links: [
          {
            to: "/portal-cgu",
            label: "Portal da Transparência (CGU)",
            icon: Banknote,
            mode: "explorar",
          },
          {
            to: "/pncp",
            label: "Portal Nacional de Contratações Públicas (PNCP)",
            icon: FileText,
            mode: "explorar",
          },
          {
            to: "/siconfi",
            label: "Sistema de Informações Contábeis e Fiscais (SICONFI)",
            icon: PieChart,
            mode: "explorar",
          },
          { to: "/transferegov", label: "Transferegov", icon: Share2, mode: "explorar" },
          {
            to: "/tse",
            label: "Tribunal Superior Eleitoral (TSE)",
            icon: Vote,
            mode: "explorar",
          },
        ],
      },
      {
        label: "Por tipo de dados",
        links: [
          { to: "/contratos", label: "Contratos", icon: ScrollText, mode: "explorar" },
          { to: "/licitacoes", label: "Licitações", icon: Scale, mode: "explorar" },
          { to: "/convenios", label: "Convênios", icon: FileSignature, mode: "explorar" },
          { to: "/emendas", label: "Emendas parlamentares", icon: HandCoins, mode: "explorar" },
          { to: "/eleicoes", label: "Eleições", icon: Megaphone, mode: "explorar" },
          {
            to: "/relatorios-fiscais",
            label: "Relatórios fiscais",
            icon: Calculator,
            mode: "explorar",
          },
        ],
      },
    ],
  },
  {
    label: "Sobre",
    icon: Info,
    mode: "sobre",
    links: [
      { to: "/sobre", label: "Sobre o projeto", icon: Info, mode: "sobre" },
      { to: "/roadmap", label: "Roadmap & novidades", icon: ListChecks, mode: "sobre" },
      {
        to: "/referencias",
        label: "Referências & projetos similares",
        icon: Library,
        mode: "sobre",
      },
      { to: "/tratamento-de-dados", label: "Tratamento de dados", icon: Database, mode: "sobre" },
      { to: "/privacidade", label: "Privacidade (LGPD)", icon: Shield, mode: "sobre" },
      { to: "/termos", label: "Termos de uso", icon: Scroll, mode: "sobre" },
      { to: "/contribuir", label: "Contribuir com o projeto", icon: HeartHandshake, mode: "sobre" },
      { to: "/estilo", label: "Guia de estilo", icon: Paintbrush, mode: "sobre" },
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
