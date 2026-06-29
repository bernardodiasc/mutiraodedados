import { ORGAOS_BASE } from "@/lib/data/catalog";
import type { CoberturaResult, Fonte } from "@/lib/data/cobertura.functions";

/**
 * Formata uma duração em ms como "Ns", "Nmin" ou "NhMmin".
 */
export function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h${rem}min` : `${h}h`;
}

/**
 * Conjunto de chaves `${fonte}|${linhaId}|${ano}|${mes}` para células que já
 * têm dado ou já foram tentadas (vazias). Usado para pular chamadas.
 */
export function buildTriedSet(data: CoberturaResult): Set<string> {
  const tried = new Set<string>();
  for (const f of data.fontes) {
    for (const l of f.linhas) {
      for (const c of l.celulas) {
        if (c.qtd > 0 || c.tentado) tried.add(`${f.fonte}|${l.id}|${c.ano}|${c.mes}`);
      }
    }
  }
  return tried;
}

export type SyncSlot = {
  fonte: Fonte["fonte"];
  linhaId: string;
  ano: number;
  mes: number;
};

/**
 * Resolve a lista de "linhas" (entidades/órgãos) elegíveis para uma fonte
 * dentro de uma `CoberturaResult`. CGU usa o catálogo base; demais usam o que
 * a fonte declarou (ou o próprio nome da fonte como linha única).
 */
export function resolveLinhasIds(fonte: Fonte): string[] {
  if (fonte.fonte === "cgu") {
    return ORGAOS_BASE.filter((o) => o.disponivelPortal).map((o) => o.cod);
  }
  return fonte.linhas.length > 0 ? fonte.linhas.map((l) => l.id) : [fonte.fonte];
}

/**
 * Enumera todos os slots (fonte+linha+ano+mes) candidatos no intervalo,
 * respeitando as fontes selecionadas. SICONFI fica fora (precisa código IBGE).
 */
export function enumerateSlots(opts: {
  data: CoberturaResult;
  yIni: number;
  yFim: number;
  selecionadas: Set<string>;
}): SyncSlot[] {
  const { data, yIni, yFim, selecionadas } = opts;
  const out: SyncSlot[] = [];
  for (let y = yIni; y <= yFim; y++) {
    for (const f of data.fontes) {
      if (f.fonte === "siconfi") continue;
      if (!selecionadas.has(f.fonte)) continue;
      for (const lid of resolveLinhasIds(f)) {
        for (let m = 1; m <= 12; m++) {
          out.push({ fonte: f.fonte, linhaId: lid, ano: y, mes: m });
        }
      }
    }
  }
  return out;
}

/** Slot está no futuro em relação a `now` (mesmo ano, mês depois). */
export function isFutureSlot(slot: SyncSlot, now: Date): boolean {
  const ano = now.getFullYear();
  const mes = now.getMonth() + 1;
  return slot.ano === ano && slot.mes > mes;
}

/** Agrupa rótulos de jobs por prefixo (antes de " · ") e conta ocorrências. */
export function countByLabelPrefix(labels: string[]): Map<string, number> {
  const porFonte = new Map<string, number>();
  for (const label of labels) {
    const k = label.split(" · ")[0];
    porFonte.set(k, (porFonte.get(k) ?? 0) + 1);
  }
  return porFonte;
}