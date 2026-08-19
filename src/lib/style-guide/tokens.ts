// Tokens declarados em src/styles.css. Mantenha sincronizado ao adicionar tokens.
export const COLOR_TOKENS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
  "demo",
  "demo-foreground",
  "demo-muted",
] as const;

export const CHART_TOKENS = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"] as const;

export const SIDEBAR_TOKENS = [
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
] as const;

export const RADIUS_TOKENS = ["sm", "md", "lg", "xl", "2xl", "3xl", "4xl"] as const;

export const SPACING_SAMPLES = [1, 2, 3, 4, 6, 8, 12, 16, 24] as const;

export const SEVERIDADE_BADGE: Record<string, { label: string; cls: string }> = {
  critico: { label: "crítico", cls: "bg-destructive text-destructive-foreground" },
  aviso: { label: "aviso", cls: "bg-accent text-accent-foreground" },
  info: { label: "info", cls: "bg-secondary text-secondary-foreground" },
};
