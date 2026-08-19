import type { AnomaliaSeveridade } from "@/lib/anomalia";

/** Formata número como BRL (pt-BR). Aceita null/undefined. */
export function fmtBRL(n?: number | null): string {
  if (n == null) return "—";
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Formata data ISO como string pt-BR; devolve a entrada se for inválida. */
export function fmtData(s?: string | null): string {
  if (!s) return "—";
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleString("pt-BR");
  } catch {
    return s;
  }
}

/** Classes Tailwind para o badge de severidade. */
export function severityClasses(severidade: AnomaliaSeveridade): string {
  if (severidade === "critico") return "bg-destructive/15 text-destructive";
  if (severidade === "aviso") return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  return "bg-muted text-muted-foreground";
}

export function isHttpOk(status: number): boolean {
  return status >= 200 && status < 300;
}
