/**
 * Funções puras extraídas de CoberturaMatrix.
 */
import type { Fonte, Linha } from "@/lib/data/cobertura.functions";

export const MESES_CURTO = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

export type Granularidade = Fonte["granularidade"];

/** Lista de colunas a renderizar conforme a granularidade da fonte. */
export function colunasDeGranularidade(g: Granularidade): number[] {
  if (g === "periodo") return [1, 2, 3, 4, 5, 6];
  if (g === "ano") return [1];
  return Array.from({ length: 12 }, (_, i) => i + 1);
}

/** Header curto de coluna (ex.: "Jan", "P1", "Ano"). */
export function colHeader(g: Granularidade, m: number): string {
  if (g === "periodo") return `P${m}`;
  if (g === "ano") return "Ano";
  return MESES_CURTO[m - 1] ?? String(m);
}

/** Label longo de coluna (ex.: "Jan/2024", "P1", "Ano 2024"). */
export function colLabelLong(g: Granularidade, m: number, ano: number): string {
  if (g === "periodo") return `P${m}`;
  if (g === "ano") return `Ano ${ano}`;
  return `${MESES_CURTO[m - 1] ?? m}/${ano}`;
}

/**
 * Intensidade de cor (0..1) para uma célula com `qtd` registros, dado o
 * máximo da coluna/seção. Mantém piso de 0.18 quando há dados, 0 quando vazia.
 */
export function intensidadeCelula(qtd: number, max: number): number {
  if (qtd <= 0) return 0;
  const m = Math.max(1, max);
  return Math.max(0.18, Math.min(1, qtd / m));
}

/**
 * Indica se a última atualização da célula está "antiga" (default: >90 dias).
 */
export function isStale(
  ultimoIso: string | null | undefined,
  agoraMs: number,
  diasLimite = 90,
): boolean {
  if (!ultimoIso) return false;
  const t = new Date(ultimoIso).getTime();
  if (!Number.isFinite(t)) return false;
  return agoraMs - t > diasLimite * 86400 * 1000;
}

/** Soma de registros (`qtd`) das células de uma linha para um dado ano. */
export function totalLinhaAno(linha: Linha, ano: number): number {
  return linha.celulas.filter((c) => c.ano === ano).reduce((s, c) => s + c.qtd, 0);
}

/** Maior `qtd` (>=1) entre todas as células de `linhas` no `ano` dado. */
export function colMaxQtd(linhas: Linha[], ano: number): number {
  let max = 1;
  for (const l of linhas) {
    for (const c of l.celulas) {
      if (c.ano === ano && c.qtd > max) max = c.qtd;
    }
  }
  return max;
}

/**
 * Meses (1..12) ainda não tentados para a linha no ano dado.
 * "Tentado" = `qtd > 0` ou flag `tentado` setada.
 */
export function lacunasMesesDaLinha(linha: Linha, ano: number): number[] {
  const tentados = new Set(
    linha.celulas.filter((c) => c.ano === ano && (c.qtd > 0 || c.tentado)).map((c) => c.mes),
  );
  const out: number[] = [];
  for (let m = 1; m <= 12; m++) if (!tentados.has(m)) out.push(m);
  return out;
}

/**
 * Intersecta um Set anterior com a lista atual de fontes — preserva apenas
 * as fontes que ainda existem.
 */
export function intersectarSelecionadas(
  prev: ReadonlySet<string>,
  fonteIdsAtuais: readonly string[],
): Set<string> {
  const next = new Set<string>();
  for (const id of fonteIdsAtuais) if (prev.has(id)) next.add(id);
  return next;
}
