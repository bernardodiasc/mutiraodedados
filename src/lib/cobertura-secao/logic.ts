/**
 * Funções puras extraídas de CoberturaSecao.
 * Toda função que depende de "agora" recebe `nowMs` como parâmetro.
 */
import type { CelulaEstado, EstadoCobertura } from "@/lib/data/cobertura-estado";

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

/**
 * Aparência de cada estado de cobertura nas células e na barra. A paleta só
 * tem tinta (`primary`), vermelho e neutros, e o vermelho de marca (`accent`)
 * se confunde com o de erro: os estados bons ficam em tinta, só o erro em
 * vermelho, e o resto se distingue por opacidade e borda — a legenda e o
 * `title` sempre dizem o nome.
 */
export const CLASSE_ESTADO: Record<EstadoCobertura, string> = {
  concluido: "bg-primary border border-primary",
  concluido_sem_total: "bg-primary/45 border border-primary/50",
  vazio_confirmado: "bg-transparent border border-primary",
  processando: "bg-primary/15 border border-primary/40 animate-pulse",
  parcial: "bg-primary/15 border border-dashed border-primary",
  indisponivel: "bg-muted-foreground/30 border border-muted-foreground/40",
  erro: "bg-destructive border border-destructive",
  nao_consultado: "bg-transparent border border-dashed border-border",
};

/** Estados presentes, na ordem da legenda (do melhor ao pior), com a contagem. */
export function legendaDosEstados(
  porEstado: Record<EstadoCobertura, number>,
): { estado: EstadoCobertura; qtd: number }[] {
  const ordem: EstadoCobertura[] = [
    "concluido",
    "concluido_sem_total",
    "vazio_confirmado",
    "processando",
    "parcial",
    "indisponivel",
    "erro",
    "nao_consultado",
  ];
  return ordem
    .filter((e) => porEstado[e] > 0)
    .map((estado) => ({ estado, qtd: porEstado[estado] }));
}

/** Estado de cada mês de um ano, quando a fonte tem uma janela só por mês. */
export function estadosDoAno(
  celulas: readonly CelulaEstado[],
  ano: number,
): Map<number, EstadoCobertura> {
  const m = new Map<number, EstadoCobertura>();
  for (const c of celulas) if (c.ano === ano && c.escopo === "") m.set(c.mes, c.estado);
  return m;
}
