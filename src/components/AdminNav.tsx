import { Link } from "@tanstack/react-router";
import {
  Database,
  Map as MapIcon,
  FileText,
  BarChart3,
  Bell,
  Bookmark,
  ShieldCheck,
  HelpCircle,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type AdminSection = {
  to:
    | "/admin/dados"
    | "/admin/qualidade"
    | "/admin/roadmap"
    | "/admin/artigos"
    | "/admin/analises"
    | "/admin/sinais"
    | "/admin/marcacoes"
    | "/admin/perguntas"
    | "/admin/prompts";
  label: string;
  description: string;
  icon: LucideIcon;
  status?: "em_breve";
};

export const ADMIN_SECTIONS: AdminSection[] = [
  {
    to: "/admin/analises",
    label: "Análises",
    description: "Cruzamentos e relatórios prontos para a equipe.",
    icon: BarChart3,
    status: "em_breve",
  },
  {
    to: "/admin/artigos",
    label: "Artigos",
    description: "Edição de conteúdo editorial e páginas dinâmicas.",
    icon: FileText,
  },
  {
    to: "/admin/dados",
    label: "Dados",
    description: "Ingestão multi-fonte, cobertura, governança e manutenção do banco.",
    icon: Database,
  },
  {
    to: "/admin/marcacoes",
    label: "Marcações",
    description: "Curadoria de marcações e contestações da comunidade.",
    icon: Bookmark,
  },
  {
    to: "/admin/perguntas",
    label: "Perguntas",
    description: "Modelos curados e moderação de investigações publicadas.",
    icon: HelpCircle,
  },
  {
    to: "/admin/prompts",
    label: "Prompts",
    description: "Prompts do Kit de investigação, vinculados aos mapas.",
    icon: Sparkles,
  },
  {
    to: "/admin/qualidade",
    label: "Qualidade",
    description: "Defeitos detectados nas bases, revalidação e reporte aos órgãos oficiais.",
    icon: ShieldCheck,
  },
  {
    to: "/admin/roadmap",
    label: "Roadmap",
    description: "Itens públicos exibidos em /roadmap.",
    icon: MapIcon,
  },
  {
    to: "/admin/sinais",
    label: "Sinais",
    description: "Alertas, anomalias e gatilhos para revisão humana.",
    icon: Bell,
  },
];

export function AdminNav() {
  return (
    <nav className="flex flex-wrap gap-1.5 rounded-lg border border-border bg-card/50 p-1.5">
      {ADMIN_SECTIONS.map((s) => {
        const Icon = s.icon;
        return (
          <Link
            key={s.to}
            to={s.to}
            activeOptions={{ exact: true }}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 data-[status=active]:bg-accent/15 data-[status=active]:text-accent"
          >
            <Icon className="size-3.5" />
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
