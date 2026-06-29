/**
 * Funções puras extraídas de CoberturaSecao.
 * Toda função que depende de "agora" recebe `nowMs` como parâmetro.
 */

export function diasDesde(iso: string | null, nowMs: number = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((nowMs - t) / 86_400_000));
}

export function fmtRelativo(iso: string | null, nowMs: number = Date.now()): string {
  const d = diasDesde(iso, nowMs);
  if (d === null) return "—";
  if (d === 0) return "hoje";
  if (d === 1) return "ontem";
  if (d < 30) return `há ${d} dias`;
  if (d < 60) return "há 1 mês";
  if (d < 365) return `há ${Math.floor(d / 30)} meses`;
  const anos = Math.floor(d / 365);
  return anos === 1 ? "há 1 ano" : `há ${anos} anos`;
}

export function fmtAnoMes(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 7);
}

export type Freshness = "fresh" | "warn" | "stale" | "none";

export function freshness(iso: string | null, nowMs: number = Date.now()): Freshness {
  const d = diasDesde(iso, nowMs);
  if (d === null) return "none";
  if (d <= 30) return "fresh";
  if (d <= 90) return "warn";
  return "stale";
}

export function corFresh(f: Freshness): string {
  return f === "fresh"
    ? "text-emerald-400"
    : f === "warn"
      ? "text-amber-400"
      : f === "stale"
        ? "text-rose-400"
        : "text-muted-foreground";
}